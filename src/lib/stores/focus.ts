import { get, writable } from 'svelte/store';
import { gameState, replayState } from '$lib/stores/game';
import { addLog } from '$lib/stores/logger';
import { fetchFocusSummary, startFocusSession } from '$lib/services/apiEEG';
import type { CognitiveState } from '$lib/services/apiEEG';

/**
 * Per-game focus display state.
 *
 * The focus measurement itself is computed in the Muse backend
 * (muse2/eeg_server/focus_tracker.py). This module only:
 *   1. tells the backend when a Quoridor game starts (so it resets and
 *      begins accumulating), and
 *   2. fetches the finished summary when the game ends.
 * It performs no aggregation of its own — `focusedPct` comes straight from
 * the backend response.
 */

export type GameFocusSummary = {
  sessionId: string | null;
  /** Share of the game spent focused (0-100), computed by the backend; null when unavailable. */
  focusedPct: number | null;
  focusedSamples: number;
  totalSamples: number;
  /** Per-state frame counts (mirrors the backend's console summary). */
  byState: Record<CognitiveState, number>;
};

const EMPTY: GameFocusSummary = {
  sessionId: null,
  focusedPct: null,
  focusedSamples: 0,
  totalSamples: 0,
  byState: { strategic_thinking: 0, focused: 0, stressed: 0, relaxed: 0, unknown: 0 }
};

export const gameFocusSummary = writable<GameFocusSummary>({ ...EMPTY });

let sessionId: string | null = null;
let lastMoveCount = 0;
let finished = false;

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function beginSession(id: string | null) {
  sessionId = id;
  finished = false;
  gameFocusSummary.set({ ...EMPTY, sessionId: id });

  if (!id || get(replayState).active) return;

  try {
    await startFocusSession();
  } catch (error) {
    addLog('WARN', 'EEG', 'Could not start focus session', { message: message(error) });
  }
}

async function endSession(id: string | null) {
  if (get(replayState).active) return;

  try {
    const summary = await fetchFocusSummary();
    if (sessionId !== id) return; // a new game started while fetching
    gameFocusSummary.set({ sessionId: id, ...summary });
  } catch (error) {
    addLog('WARN', 'EEG', 'Could not fetch focus summary', { message: message(error) });
  }
}

gameState.subscribe((state) => {
  const id = state?.sessionId ?? null;
  const winner = state?.winner ?? null;
  const moveCount = state?.moveHistory.length ?? 0;

  // New session, a restart of the same session (winner cleared / moves rewound),
  // or no active game → start a fresh backend focus session.
  if (id !== sessionId || (finished && !winner) || moveCount < lastMoveCount) {
    void beginSession(id);
  }

  lastMoveCount = moveCount;

  if (winner && !finished) {
    finished = true;
    void endSession(id);
  }
});
