import { addLog } from '$lib/stores/logger';
import type {
  GameMode,
  GameState,
  LoadedGameResponse,
  PlayerController,
  SavedGameSummary
} from '$lib/types/game';

type ApiErrorResponse = {
  error?: string;
};

type StartGameRequest = {
  mode: GameMode;
  player1: PlayerController;
  player2: PlayerController;
  opponent: PlayerController;
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
  startGame(
    mode: GameMode,
    player1: PlayerController,
    player2: PlayerController,
    eegEnabled: boolean
  ): Promise<GameState> {
    const body: StartGameRequest = {
      mode,
      player1,
      player2,
      opponent: player2,
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

  playBotMove(sessionId: string): Promise<GameState> {
    return request<GameState>(`/api/game/${sessionId}/bot-move`, {
      method: 'POST'
    });
  },

  resetGame(sessionId: string): Promise<GameState> {
    return request<GameState>(`/api/game/${sessionId}/reset`, {
      method: 'POST'
    });
  },

  saveGame(sessionId: string): Promise<SavedGameSummary> {
    return request<SavedGameSummary>(`/api/game/${sessionId}/save`, {
      method: 'POST'
    });
  },

  listSavedGames(): Promise<SavedGameSummary[]> {
    return request<SavedGameSummary[]>('/api/saves');
  },

  loadSavedGame(saveId: string): Promise<LoadedGameResponse> {
    return request<LoadedGameResponse>(`/api/saves/${encodeURIComponent(saveId)}/load`, {
      method: 'POST'
    });
  },

  ping(): Promise<{ ok: boolean }> {
    return request<{ ok: boolean }>('/api/health');
  }
};