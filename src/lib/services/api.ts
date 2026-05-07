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
  detail?: string;
};

type StartGameRequest = {
  mode: GameMode;
  player1: PlayerController;
  player2: PlayerController;
  opponent: PlayerController;
  eegEnabled: boolean;
  thinkingTimeMsP1?: number;
  thinkingTimeMsP2?: number;
};

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_RETRIES = 2;

function cleanBase(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function getApiBase(): string {
  const envBase =
    (import.meta.env.PUBLIC_GAME_API_BASE as string | undefined)?.trim() ||
    (import.meta.env.PUBLIC_API_BASE as string | undefined)?.trim();

  if (envBase) return cleanBase(envBase);

  if (typeof window === 'undefined') return 'http://127.0.0.1:3000';

  const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
  const host = window.location.hostname || '127.0.0.1';

  if (window.location.port === '3000') return cleanBase(window.location.origin);

  return `${protocol}//${host}:3000`;
}

function timeoutMessage(ms: number): string {
  return `Request timed out after ${ms}ms`;
}

function isAbort(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: string }).name === 'AbortError';
}

function isSafeMethod(method: string): boolean {
  return method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
}

function shouldRetryStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildHeaders(init?: RequestInit): Headers {
  const headers = new Headers(init?.headers);
  headers.set('Accept', 'application/json');

  const hasBody = init?.body !== undefined && init.body !== null;
  const isFormData =
    typeof FormData !== 'undefined' && hasBody && init.body instanceof FormData;

  if (hasBody && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return headers;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

async function parseError(response: Response): Promise<string> {
  const fallback = `Request failed with ${response.status}`;

  try {
    const text = await response.text();
    if (!text) return fallback;

    try {
      const data = JSON.parse(text) as ApiErrorResponse;
      return data.detail || data.error || text;
    } catch {
      return text;
    }
  } catch {
    return fallback;
  }
}

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase();
  const url = `${getApiBase()}${path}`;
  const timeoutMs = Number(import.meta.env.PUBLIC_API_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  const retries = isSafeMethod(method)
    ? Number(import.meta.env.PUBLIC_API_RETRIES ?? DEFAULT_RETRIES)
    : 0;

  addLog('DEBUG', 'API', `${method} ${path}`, { url });

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    let response: Response;

    try {
      response = await fetchWithTimeout(
        url,
        {
          ...init,
          method,
          headers: buildHeaders(init)
        },
        timeoutMs
      );
    } catch (error) {
      const message = isAbort(error)
        ? timeoutMessage(timeoutMs)
        : error instanceof Error
          ? error.message
          : String(error);

      if (attempt < retries) {
        addLog('WARN', 'API', `${method} ${path} retrying`, {
          attempt: attempt + 1,
          retries,
          message,
          url
        });
        await delay(300 * 2 ** attempt);
        continue;
      }

      addLog('ERROR', 'API', `${method} ${path} failed`, { message, url });
      throw new TypeError(message);
    }

    if (!response.ok) {
      const message = await parseError(response);

      if (attempt < retries && shouldRetryStatus(response.status)) {
        addLog('WARN', 'API', `${method} ${path} retrying after ${response.status}`, {
          attempt: attempt + 1,
          retries,
          status: response.status,
          message,
          url
        });
        await delay(300 * 2 ** attempt);
        continue;
      }

      addLog('WARN', 'API', `${method} ${path} -> ${response.status}`, {
        status: response.status,
        error: message,
        url
      });

      throw new Error(message);
    }

    const data = await parseJson<T>(response);

    addLog('DEBUG', 'API', `${method} ${path} -> ${response.status}`, {
      status: response.status,
      url
    });

    return data;
  }

  throw new TypeError('Request failed');
}

export const apiService = {
  startGame(
    mode: GameMode,
    player1: PlayerController,
    player2: PlayerController,
    eegEnabled: boolean,
    thinkingTimeMsP1?: number,
    thinkingTimeMsP2?: number
  ): Promise<GameState> {
    const body: StartGameRequest = {
      mode,
      player1,
      player2,
      opponent: player2,
      eegEnabled,
      ...(thinkingTimeMsP1 !== undefined && { thinkingTimeMsP1 }),
      ...(thinkingTimeMsP2 !== undefined && { thinkingTimeMsP2 })
    };

    return request<GameState>('/api/game/start', {
      method: 'POST',
      body: JSON.stringify(body)
    });
  },

  getGameState(sessionId: string): Promise<GameState> {
    return request<GameState>(`/api/game/${encodeURIComponent(sessionId)}`);
  },

  submitMove(sessionId: string, moveNotation: string): Promise<GameState> {
    return request<GameState>(`/api/game/${encodeURIComponent(sessionId)}/move`, {
      method: 'POST',
      body: JSON.stringify({
        move: moveNotation.toLowerCase().trim()
      })
    });
  },

  playBotMove(sessionId: string): Promise<GameState> {
    return request<GameState>(`/api/game/${encodeURIComponent(sessionId)}/bot-move`, {
      method: 'POST'
    });
  },

  resetGame(sessionId: string): Promise<GameState> {
    return request<GameState>(`/api/game/${encodeURIComponent(sessionId)}/reset`, {
      method: 'POST'
    });
  },

  saveGame(sessionId: string): Promise<SavedGameSummary> {
    return request<SavedGameSummary>(`/api/game/${encodeURIComponent(sessionId)}/save`, {
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