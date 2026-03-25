import { get, writable } from 'svelte/store';
import { apiService } from '$lib/services/api';
import type { Difficulty, GameMode, GameState } from '$lib/types/game';
import { addLog } from '$lib/stores/logger';

export const gameState = writable<GameState | null>(null);
export const isLoading = writable(false);
export const apiConnected = writable(true);

async function runAIMove() {
  const current = get(gameState);

  if (!current || current.currentPlayer !== 2 || current.status !== 'in-progress') {
    return;
  }

  addLog('INFO', 'GAME', 'Waiting for AI move...');
  isLoading.set(true);

  try {
    const aiMove = await apiService.getAIMove(current);
    addLog('INFO', 'MOVE', `AI played: ${aiMove}`);

    const result = await apiService.submitMove(current.sessionId, aiMove, current, 2);

    if (result.valid && result.state) {
      gameState.set(result.state);

      if (result.state.winner) {
        addLog('INFO', 'GAME', `Game finished. Winner: Player ${result.state.winner}`);
      } else {
        addLog('INFO', 'GAME', 'Your turn');
      }
    } else {
      addLog('ERROR', 'MOVE', `AI move rejected: ${result.error ?? 'Unknown error'}`);
    }
  } catch (error) {
    addLog('ERROR', 'API', `AI move failed: ${String(error)}`);
  } finally {
    isLoading.set(false);
  }
}

export async function startNewGame(mode: GameMode, difficulty: Difficulty, eegEnabled: boolean) {
  isLoading.set(true);
  addLog('INFO', 'SESSION', `Starting new ${mode} game at ${difficulty} difficulty`);

  try {
    const state = await apiService.startGame(mode, difficulty, eegEnabled);
    gameState.set(state);
    addLog('INFO', 'GAME', `Game started: session ${state.sessionId}`);
    addLog('INFO', 'GAME', 'Player 1 (human) vs Player 2 (AI)');
  } catch (error) {
    addLog('ERROR', 'API', `Failed to start game: ${String(error)}`);
  } finally {
    isLoading.set(false);
  }
}

export async function submitMove(moveNotation: string) {
  const current = get(gameState);
  if (!current) return;

  addLog('INFO', 'MOVE', `Submitting move: ${moveNotation}`);
  isLoading.set(true);

  try {
    const result = await apiService.submitMove(current.sessionId, moveNotation, current);

    if (result.valid && result.state) {
      gameState.set(result.state);
      addLog('INFO', 'MOVE', `Move accepted: ${moveNotation}`);

      if (result.state.winner) {
        addLog('INFO', 'GAME', `Game finished. Winner: Player ${result.state.winner}`);
      }
    } else {
      addLog('ERROR', 'MOVE', `Move rejected: ${result.error ?? 'Unknown error'}`);
    }
  } catch (error) {
    addLog('ERROR', 'API', `Failed to submit move: ${String(error)}`);
  } finally {
    isLoading.set(false);
  }

  const next = get(gameState);
  if (next?.currentPlayer === 2 && next.status === 'in-progress') {
    window.setTimeout(() => {
      void runAIMove();
    }, 400);
  }
}

export async function resetGame() {
  const current = get(gameState);
  if (!current) return;

  addLog('INFO', 'SESSION', 'Resetting game');
  isLoading.set(true);

  try {
    const state = await apiService.resetGame(current);
    gameState.set(state);
    addLog('INFO', 'GAME', 'Game reset');
  } catch (error) {
    addLog('ERROR', 'API', `Failed to reset game: ${String(error)}`);
  } finally {
    isLoading.set(false);
  }
}
