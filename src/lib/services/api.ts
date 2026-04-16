import { addLog } from '$lib/stores/logger';
import type { GameMode, GameState, Opponent } from '$lib/types/game';

type ApiErrorResponse = {
  error?: string;
};

type StartGameRequest = {
  mode: GameMode;
  opponent: Opponent;
  eegEnabled: boolean;
};

function getApiBase(): string {
  const envBase = (import.meta.env.PUBLIC_API_BASE as string | undefined)?.trim();
  if (envBase) {
    return envBase.replace(/\/$/, '');
  }

  if (typeof window === 'undefined') {
    return 'http://127.0.0.1:3000';
  }

  return `http://${window.location.hostname}:3000`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method ?? 'GET';
  const url = `${getApiBase()}${path}`;

  addLog('DEBUG', 'API', `${method} ${path}`, { url });

  let response: Response;

  try {
    response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {})
      },
      ...init
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    addLog('ERROR', 'API', `${method} ${path} failed`, { message, url });
    throw new Error(message);
  }

  if (!response.ok) {
    let errorMessage = `Request failed with ${response.status}`;

    try {
      const data = (await response.json()) as ApiErrorResponse;
      if (data?.error) {
        errorMessage = data.error;
      }
    } catch {
      try {
        const text = await response.text();
        if (text) {
          errorMessage = text;
        }
      } catch {
        // ignore
      }
    }

    addLog('WARN', 'API', `${method} ${path} -> ${response.status}`, {
      status: response.status,
      error: errorMessage,
      url
    });

    throw new Error(errorMessage);
  }

  const data = (await response.json()) as T;

  addLog('DEBUG', 'API', `${method} ${path} -> ${response.status}`, {
    status: response.status,
    url
  });

  return data;
}

export const apiService = {
  startGame(mode: GameMode, opponent: Opponent, eegEnabled: boolean): Promise<GameState> {
    const body: StartGameRequest = {
      mode,
      opponent,
      eegEnabled
    };

    return request<GameState>('/api/game/start', {
      method: 'POST',
      body: JSON.stringify(body)
    });
  },

  getGameState(sessionId: string): Promise<GameState> {
    return request<GameState>(`/api/game/${sessionId}`);
  },

  submitMove(sessionId: string, moveNotation: string): Promise<GameState> {
    return request<GameState>(`/api/game/${sessionId}/move`, {
      method: 'POST',
      body: JSON.stringify({
        move: moveNotation.toLowerCase().trim()
      })
    });
  },

  resetGame(sessionId: string): Promise<GameState> {
    return request<GameState>(`/api/game/${sessionId}/reset`, {
      method: 'POST'
    });
  },

  ping(): Promise<{ ok: boolean }> {
    return request<{ ok: boolean }>('/api/health');
  }
};