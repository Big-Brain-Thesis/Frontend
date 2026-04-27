import { get, writable } from 'svelte/store';
import { apiService } from '$lib/services/api';
import type {
  GameMode,
  GameState,
  Move,
  PlayerController,
  ReplayState,
  SavedGameSummary
} from '$lib/types/game';
import { formatSquare, parseSquare, parseWall } from '$lib/utils/notation';
import { addLog } from '$lib/stores/logger';

export const gameState = writable<GameState | null>(null);
const committedGameState = writable<GameState | null>(null);

export const isLoading = writable(false);
export const isSubmitting = writable(false);
export const isBotThinking = writable(false);
export const apiConnected = writable(false);
export const lastApiPing = writable<number | null>(null);
export const apiError = writable<string | null>(null);

export const botAutoplay = writable(true);
export const botSpeedMs = writable(400);

export const savedGames = writable<SavedGameSummary[]>([]);
export const replayState = writable<ReplayState>({
  active: false,
  index: 0,
  states: [],
  sourceId: null
});

let botTimer: ReturnType<typeof setTimeout> | null = null;

function formatController(controller: PlayerController | string): string {
  switch (controller) {
    case 'human':
      return 'Human';
    case 'dionysus':
      return 'Dionysus';
    case 'hermes':
      return 'Hermes';
    default:
      return controller;
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function markApiOk() {
  apiConnected.set(true);
  lastApiPing.set(Date.now());
  apiError.set(null);
}

function markApiDown(message: string) {
  apiConnected.set(false);
  lastApiPing.set(Date.now());
  apiError.set(message);
}

function moveKey(move: GameState['moveHistory'][number]): string {
  return `${move.player}:${move.timestamp}:${move.notation}:${move.type}`;
}

function syncMoveLogs(previous: GameState | null, next: GameState) {
  const seen = new Set((previous?.moveHistory ?? []).map(moveKey));

  for (const move of next.moveHistory) {
    if (seen.has(moveKey(move))) {
      continue;
    }

    addLog(
      'INFO',
      'MOVE',
      `Player ${move.player} ${move.type === 'wall' ? 'placed wall' : 'moved'} ${move.notation}`
    );
  }
}

function clearBotTimer() {
  if (botTimer !== null) {
    clearTimeout(botTimer);
    botTimer = null;
  }
}

function cloneGameState(state: GameState): GameState {
  return {
    ...state,
    players: state.players.map((player) => ({
      ...player,
      position: { ...player.position }
    })),
    walls: state.walls.map((wall) => ({
      ...wall,
      position: { ...wall.position }
    })),
    moveHistory: state.moveHistory.map((move) => ({ ...move })),
    legalMoves: [...state.legalMoves],
    legalWalls: [...state.legalWalls]
  };
}

function buildDefinedPosition(state: GameState): string {
  const horizontal = state.walls
    .filter((wall) => wall.orientation === 'h')
    .map((wall) => formatSquare(wall.position))
    .join('');

  const vertical = state.walls
    .filter((wall) => wall.orientation === 'v')
    .map((wall) => formatSquare(wall.position))
    .join('');

  const pawns = state.players.map((player) => formatSquare(player.position)).join(' ');
  const wallsAvailable = state.players.map((player) => player.wallsRemaining).join(' ');

  return `${horizontal} / ${vertical} / ${pawns} / ${wallsAvailable} / ${state.currentPlayer}`;
}

function applyOptimisticMove(state: GameState, notation: string): GameState {
  const next = cloneGameState(state);
  const activePlayer = next.players.find((player) => player.id === next.currentPlayer);
  const move: Move = {
    notation,
    type: notation.endsWith('h') || notation.endsWith('v') ? 'wall' : 'pawn',
    player: next.currentPlayer,
    timestamp: Date.now()
  };

  if (move.type === 'wall') {
    const wall = parseWall(notation);

    if (wall) {
      next.walls = [
        ...next.walls,
        {
          position: { ...wall.position },
          orientation: wall.orientation
        }
      ];

      if (activePlayer) {
        activePlayer.wallsRemaining = Math.max(0, activePlayer.wallsRemaining - 1);
      }
    }
  } else {
    const square = parseSquare(notation);

    if (square && activePlayer) {
      activePlayer.position = { ...square };
    }
  }

  next.moveHistory = [...next.moveHistory, move];
  next.currentPlayer = next.currentPlayer === 1 ? 2 : 1;
  next.legalMoves = [];
  next.legalWalls = [];
  next.definedPosition = buildDefinedPosition(next);
  next.status = 'in-progress';

  return next;
}

function currentPlayerIsBot(state: GameState | null): boolean {
  if (!state || state.status !== 'in-progress' || state.winner) {
    return false;
  }

  const player = state.players[state.currentPlayer - 1];
  return Boolean(player?.isAI);
}

function currentPlayerIsHuman(state: GameState | null): boolean {
  if (!state || state.status !== 'in-progress' || state.winner) {
    return false;
  }

  const player = state.players[state.currentPlayer - 1];
  return Boolean(player && !player.isAI);
}

function setCommittedAndDisplayed(state: GameState | null) {
  committedGameState.set(state);
  gameState.set(state);

  if (state) {
    scheduleBotMove(state);
  }
}

function scheduleBotMove(state = get(committedGameState)) {
  if (!state || !get(botAutoplay) || get(replayState).active || get(isBotThinking)) {
    return;
  }

  if (!currentPlayerIsBot(state)) {
    clearBotTimer();
    return;
  }

  if (botTimer !== null) {
    return;
  }

  botTimer = setTimeout(() => {
    botTimer = null;
    void playBotMove();
  }, get(botSpeedMs));
}

export async function refreshApiHealth() {
  try {
    await apiService.ping();
    markApiOk();
  } catch (error) {
    markApiDown(toErrorMessage(error));
  }
}

export async function startNewGame(
  mode: GameMode,
  player1: PlayerController,
  player2: PlayerController,
  eegEnabled: boolean
) {
  clearBotTimer();
  replayState.set({
    active: false,
    index: 0,
    states: [],
    sourceId: null
  });

  isLoading.set(true);

  addLog(
    'INFO',
    'SESSION',
    `Starting ${mode}: P1 ${formatController(player1)} vs P2 ${formatController(player2)}`
  );

  try {
    const state = await apiService.startGame(mode, player1, player2, eegEnabled);

    setCommittedAndDisplayed(state);
    markApiOk();

    addLog('INFO', 'GAME', `Game started: session ${state.sessionId}`);
  } catch (error) {
    const message = toErrorMessage(error);
    markApiDown(message);
    addLog('ERROR', 'API', `Failed to start game: ${message}`);
  } finally {
    isLoading.set(false);
  }
}

export async function submitMove(moveNotation: string) {
  const current = get(committedGameState) ?? get(gameState);
  if (!current || get(replayState).active || get(isSubmitting) || !currentPlayerIsHuman(current)) {
    return;
  }

  const notation = moveNotation.toLowerCase().trim();

  clearBotTimer();
  isSubmitting.set(true);
  addLog('INFO', 'MOVE', `Submitting move ${notation}`);

  const optimistic = applyOptimisticMove(current, notation);
  gameState.set(optimistic);

  try {
    const response = await apiService.submitMove(current.sessionId, notation);

    syncMoveLogs(current, response);
    setCommittedAndDisplayed(response);
    markApiOk();

    if (response.winner) {
      addLog('INFO', 'GAME', `Game finished. Winner: Player ${response.winner}`);
    }
  } catch (error) {
    const message = toErrorMessage(error);

    gameState.set(current);

    if (error instanceof TypeError) {
      markApiDown(message);
    } else {
      lastApiPing.set(Date.now());
      apiError.set(message);
    }

    addLog('ERROR', 'MOVE', `Move rejected; optimistic UI reverted: ${message}`);
  } finally {
    isSubmitting.set(false);
    scheduleBotMove(get(committedGameState));
  }
}

export async function playBotMove() {
  const current = get(committedGameState) ?? get(gameState);
  if (!current || get(replayState).active || get(isBotThinking) || !currentPlayerIsBot(current)) {
    return;
  }

  clearBotTimer();
  isBotThinking.set(true);

  const activePlayer = current.players[current.currentPlayer - 1];
  addLog('INFO', 'GAME', `Player ${current.currentPlayer} bot is moving`);

  try {
    const response = await apiService.playBotMove(current.sessionId);

    syncMoveLogs(current, response);
    setCommittedAndDisplayed(response);
    markApiOk();

    if (response.winner) {
      addLog('INFO', 'GAME', `Game finished. Winner: Player ${response.winner}`);
    } else {
      addLog(
        'INFO',
        'GAME',
        `Player ${activePlayer?.id ?? current.currentPlayer} bot completed its turn`
      );
    }
  } catch (error) {
    const message = toErrorMessage(error);

    if (error instanceof TypeError) {
      markApiDown(message);
    } else {
      lastApiPing.set(Date.now());
      apiError.set(message);
    }

    addLog('ERROR', 'API', `Bot move failed: ${message}`);
  } finally {
    isBotThinking.set(false);
    scheduleBotMove(get(committedGameState));
  }
}

export async function resetGame() {
  const current = get(committedGameState) ?? get(gameState);
  if (!current) return;

  clearBotTimer();
  replayState.set({
    active: false,
    index: 0,
    states: [],
    sourceId: null
  });

  addLog('INFO', 'SESSION', 'Resetting game');
  isLoading.set(true);

  try {
    const state = await apiService.resetGame(current.sessionId);
    setCommittedAndDisplayed(state);
    markApiOk();
    addLog('INFO', 'GAME', 'Game reset');
  } catch (error) {
    const message = toErrorMessage(error);

    if (error instanceof TypeError) {
      markApiDown(message);
    } else {
      lastApiPing.set(Date.now());
      apiError.set(message);
    }

    addLog('ERROR', 'API', `Failed to reset game: ${message}`);
  } finally {
    isLoading.set(false);
  }
}

export async function saveCurrentGame() {
  const current = get(committedGameState) ?? get(gameState);
  if (!current) return;

  isLoading.set(true);

  try {
    const summary = await apiService.saveGame(current.sessionId);
    savedGames.update((items) => {
      const filtered = items.filter((item) => item.id !== summary.id);
      return [summary, ...filtered].sort((a, b) => b.savedAt - a.savedAt);
    });
    markApiOk();
    addLog('INFO', 'SESSION', `Saved game ${summary.id}`);
  } catch (error) {
    const message = toErrorMessage(error);

    if (error instanceof TypeError) {
      markApiDown(message);
    } else {
      lastApiPing.set(Date.now());
      apiError.set(message);
    }

    addLog('ERROR', 'API', `Failed to save game: ${message}`);
  } finally {
    isLoading.set(false);
  }
}

export async function refreshSavedGames() {
  try {
    const summaries = await apiService.listSavedGames();
    savedGames.set(summaries);
    markApiOk();
  } catch (error) {
    const message = toErrorMessage(error);

    if (error instanceof TypeError) {
      markApiDown(message);
    } else {
      lastApiPing.set(Date.now());
      apiError.set(message);
    }

    addLog('ERROR', 'API', `Failed to load saved games: ${message}`);
  }
}

export async function loadSavedGame(saveId: string) {
  if (!saveId) return;

  clearBotTimer();
  isLoading.set(true);

  try {
    const loaded = await apiService.loadSavedGame(saveId);
    committedGameState.set(loaded.session);

    replayState.set({
      active: true,
      index: 0,
      states: loaded.replay,
      sourceId: loaded.summary.id
    });

    gameState.set(loaded.replay[0] ?? loaded.session);
    markApiOk();

    addLog(
      'INFO',
      'SESSION',
      `Loaded saved game ${loaded.summary.id}; replay has ${loaded.replay.length} states`
    );
  } catch (error) {
    const message = toErrorMessage(error);

    if (error instanceof TypeError) {
      markApiDown(message);
    } else {
      lastApiPing.set(Date.now());
      apiError.set(message);
    }

    addLog('ERROR', 'API', `Failed to load saved game: ${message}`);
  } finally {
    isLoading.set(false);
  }
}

export function setBotAutoplay(value: boolean) {
  botAutoplay.set(value);

  if (value) {
    scheduleBotMove(get(committedGameState));
  } else {
    clearBotTimer();
  }
}

export function setBotSpeed(value: number) {
  const clamped = Math.max(100, Math.min(1000, Math.round(value / 100) * 100));
  botSpeedMs.set(clamped);

  if (get(botAutoplay)) {
    clearBotTimer();
    scheduleBotMove(get(committedGameState));
  }
}

export function stepReplay(delta: number) {
  const replay = get(replayState);
  if (!replay.active || replay.states.length === 0) return;

  const nextIndex = Math.max(0, Math.min(replay.states.length - 1, replay.index + delta));
  const nextState = replay.states[nextIndex];

  replayState.set({
    ...replay,
    index: nextIndex
  });

  gameState.set(nextState);
}

export function exitReplay() {
  const replay = get(replayState);
  const finalState = get(committedGameState);

  replayState.set({
    active: false,
    index: 0,
    states: [],
    sourceId: null
  });

  if (finalState) {
    gameState.set(finalState);
    scheduleBotMove(finalState);
  } else if (replay.states.length > 0) {
    gameState.set(replay.states.at(-1) ?? null);
  }
}