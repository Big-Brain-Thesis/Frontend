import { get, writable } from 'svelte/store';
import { apiService } from '$lib/services/api';
import type { GameMode, GameState, Opponent } from '$lib/types/game';
import { addLog } from '$lib/stores/logger';

export const gameState = writable<GameState | null>(null);
export const isLoading = writable(false);
export const apiConnected = writable(false);
export const lastApiPing = writable<number | null>(null);
export const apiError = writable<string | null>(null);
export const selectedOpponent = writable<Opponent>('dionysus');

function formatOpponent(opponent: Opponent): string {
  switch (opponent) {
    case 'human':
      return 'Human';
    case 'dionysus':
      return 'Dionysus';
    case 'hermes':
      return 'Hermes';
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

export async function refreshApiHealth() {
  try {
    await apiService.ping();
    markApiOk();
  } catch (error) {
    markApiDown(toErrorMessage(error));
  }
}

export async function startNewGame(mode: GameMode, opponent: Opponent, eegEnabled: boolean) {
  isLoading.set(true);
  selectedOpponent.set(opponent);

  addLog('INFO', 'SESSION', `Starting new ${mode} game against ${formatOpponent(opponent)}`);

  try {
    const state = await apiService.startGame(mode, opponent, eegEnabled);

    gameState.set(state);
    markApiOk();

    addLog('INFO', 'GAME', `Game started: session ${state.sessionId}`);
    addLog('INFO', 'SESSION', `Backend opponent: ${formatOpponent(opponent)}`);
  } catch (error) {
    const message = toErrorMessage(error);
    markApiDown(message);
    addLog('ERROR', 'API', `Failed to start game: ${message}`);
  } finally {
    isLoading.set(false);
  }
}

export async function submitMove(moveNotation: string) {
  const current = get(gameState);
  if (!current) return;

  isLoading.set(true);
  addLog('INFO', 'MOVE', `Submitting move ${moveNotation}`);

  try {
    const state = await apiService.submitMove(current.sessionId, moveNotation);
    const opponent = get(selectedOpponent);

    syncMoveLogs(current, state);
    gameState.set(state);
    markApiOk();

    if (state.winner) {
      addLog('INFO', 'GAME', `Game finished. Winner: Player ${state.winner}`);
    } else if (opponent !== 'human' && state.currentPlayer === 1) {
      addLog('INFO', 'GAME', `${formatOpponent(opponent)} completed its turn`);
    }
  } catch (error) {
    const message = toErrorMessage(error);

    if (error instanceof TypeError) {
      markApiDown(message);
    } else {
      lastApiPing.set(Date.now());
      apiError.set(message);
    }

    addLog('ERROR', 'MOVE', `Move rejected: ${message}`);
  } finally {
    isLoading.set(false);
  }
}

export async function resetGame() {
  const current = get(gameState);
  if (!current) return;

  addLog('INFO', 'SESSION', 'Resetting game');
  isLoading.set(true);

  try {
    const state = await apiService.resetGame(current.sessionId);
    gameState.set(state);
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