import { addLog } from '$lib/stores/logger';
import type {
  GameMode,
  GameState,
  LoadedGameResponse,
  Move,
  Player,
  PlayerController,
  SavedGameSummary,
  Wall
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

type UnknownRecord = Record<string, unknown>;

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

function isBodyAlreadyRead(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /body.*(read|used|unusable)|already.*read/i.test(message);
}

async function parseJson<T>(response: Response): Promise<T> {
  if (response.status === 204 || response.status === 205) return undefined as T;

  try {
    if (response.bodyUsed) return {} as T;
    const text = await response.text();
    if (!text) return {} as T;
    return JSON.parse(text) as T;
  } catch (error) {
    if (isBodyAlreadyRead(error)) return {} as T;
    throw error;
  }
}

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' ? (value as UnknownRecord) : {};
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function numberValue(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function booleanValue(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function arrayValue<T>(value: unknown, mapItem: (item: unknown, index: number) => T): T[] {
  return Array.isArray(value) ? value.map(mapItem) : [];
}

function normalizePosition(value: unknown, fallbackCol = 'e', fallbackRow = 1) {
  const source = asRecord(value);
  return {
    col: stringValue(source.col, fallbackCol),
    row: numberValue(source.row, fallbackRow)
  };
}

function normalizePlayer(value: unknown, index: number): Player {
  const source = asRecord(value);
  const id = numberValue(source.id, index + 1);

  return {
    id,
    color: stringValue(source.color, id === 1 ? 'blue' : 'red') as Player['color'],
    position: normalizePosition(source.position, 'e', id === 1 ? 1 : 9),
    wallsRemaining: numberValue(source.wallsRemaining ?? source.walls_remaining, 10),
    isAI: booleanValue(source.isAI ?? source.is_ai, false)
  };
}

function normalizeWall(value: unknown): Wall {
  const source = asRecord(value);
  return {
    position: normalizePosition(source.position, 'a', 1),
    orientation: (source.orientation === 'v' ? 'v' : 'h') as Wall['orientation']
  };
}

function normalizeMove(value: unknown): Move {
  const source = asRecord(value);
  const notation = stringValue(source.notation ?? source.move, '');
  const type = source.type === 'wall' || notation.endsWith('h') || notation.endsWith('v') ? 'wall' : 'pawn';

  return {
    notation,
    type,
    player: numberValue(source.player, 1),
    timestamp: numberValue(source.timestamp ?? source.created_at, Date.now())
  };
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function normalizeGameState(value: unknown): GameState {
  const source = asRecord(value);
  const players = arrayValue(source.players, normalizePlayer);
  const currentPlayer = numberValue(source.currentPlayer ?? source.current_player, 1);

  return {
    sessionId: stringValue(source.sessionId ?? source.session_id, 'local-session'),
    mode: (source.mode === '2-player' ? source.mode : '2-player') as GameMode,
    difficulty: stringValue(source.difficulty ?? source.opponent, ''),
    status: stringValue(source.status, 'in-progress') as GameState['status'],
    currentPlayer,
    players: players.length > 0 ? players : [normalizePlayer(undefined, 0), normalizePlayer(undefined, 1)],
    walls: arrayValue(source.walls, normalizeWall),
    moveHistory: arrayValue(source.moveHistory ?? source.move_history, normalizeMove),
    winner: source.winner === null || source.winner === undefined ? null : numberValue(source.winner, 0),
    legalMoves: normalizeStringArray(source.legalMoves ?? source.legal_moves),
    legalWalls: normalizeStringArray(source.legalWalls ?? source.legal_walls),
    boardSize: numberValue(source.boardSize ?? source.board_size, 9),
    evaluation: source.evaluation === undefined ? undefined : numberValue(source.evaluation),
    definedPosition: source.definedPosition === undefined && source.defined_position === undefined
      ? undefined
      : stringValue(source.definedPosition ?? source.defined_position)
  };
}

function normalizeSavedGameSummary(value: unknown): SavedGameSummary {
  const source = asRecord(value);

  return {
    id: stringValue(source.id),
    sessionId: stringValue(source.sessionId ?? source.session_id),
    savedAt: numberValue(source.savedAt ?? source.saved_at, Date.now()),
    moveCount: numberValue(source.moveCount ?? source.move_count, 0),
    winner: source.winner === null || source.winner === undefined ? null : numberValue(source.winner, 0),
    playerProfiles: normalizeStringArray(source.playerProfiles ?? source.player_profiles) as PlayerController[]
  };
}

function normalizeLoadedGameResponse(value: unknown): LoadedGameResponse {
  const source = asRecord(value);
  return {
    summary: normalizeSavedGameSummary(source.summary),
    session: normalizeGameState(source.session),
    replay: arrayValue(source.replay, normalizeGameState)
  };
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
  async startGame(
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

    return normalizeGameState(await request<unknown>('/api/game/start', {
      method: 'POST',
      body: JSON.stringify(body)
    }));
  },

  async getGameState(sessionId: string): Promise<GameState> {
    return normalizeGameState(await request<unknown>(`/api/game/${encodeURIComponent(sessionId)}`));
  },

  async submitMove(sessionId: string, moveNotation: string): Promise<GameState> {
    return normalizeGameState(await request<unknown>(`/api/game/${encodeURIComponent(sessionId)}/move`, {
      method: 'POST',
      body: JSON.stringify({
        move: moveNotation.toLowerCase().trim()
      })
    }));
  },

  async playBotMove(sessionId: string): Promise<GameState> {
    return normalizeGameState(await request<unknown>(`/api/game/${encodeURIComponent(sessionId)}/bot-move`, {
      method: 'POST'
    }));
  },

  async resetGame(sessionId: string): Promise<GameState> {
    return normalizeGameState(await request<unknown>(`/api/game/${encodeURIComponent(sessionId)}/reset`, {
      method: 'POST'
    }));
  },

  async saveGame(sessionId: string): Promise<SavedGameSummary> {
    return normalizeSavedGameSummary(await request<unknown>(`/api/game/${encodeURIComponent(sessionId)}/save`, {
      method: 'POST'
    }));
  },

  async listSavedGames(): Promise<SavedGameSummary[]> {
    const data = await request<unknown>('/api/saves');
    return Array.isArray(data) ? data.map(normalizeSavedGameSummary) : [];
  },

  async loadSavedGame(saveId: string): Promise<LoadedGameResponse> {
    return normalizeLoadedGameResponse(await request<unknown>(`/api/saves/${encodeURIComponent(saveId)}/load`, {
      method: 'POST'
    }));
  },

  ping(): Promise<{ ok: boolean }> {
    return request<{ ok: boolean }>('/api/health');
  }
};
