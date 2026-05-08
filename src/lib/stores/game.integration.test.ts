import { get } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeAfterMoveState, makeGameState, makeLoadedGameResponse, makeSavedGameSummary } from '$lib/test/factories/game';

vi.mock('$lib/stores/logger', () => ({
  addLog: vi.fn()
}));

const apiService = vi.hoisted(() => ({
  startGame: vi.fn(),
  getGameState: vi.fn(),
  submitMove: vi.fn(),
  playBotMove: vi.fn(),
  resetGame: vi.fn(),
  saveGame: vi.fn(),
  listSavedGames: vi.fn(),
  loadSavedGame: vi.fn(),
  ping: vi.fn()
}));

vi.mock('$lib/services/api', () => ({
  apiService
}));

async function freshStore() {
  vi.resetModules();
  return import('$lib/stores/game');
}

describe('game store integration with Quoridor API service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiService.ping.mockResolvedValue({ ok: true });
    apiService.listSavedGames.mockResolvedValue([]);
  });

  it('starts a new game and stores the returned backend state', async () => {
    apiService.startGame.mockResolvedValueOnce(makeGameState());
    const game = await freshStore();

    await game.startNewGame('2-player', 'human', 'dionysus', false);

    expect(apiService.startGame).toHaveBeenCalledWith(
      '2-player',
      'human',
      'dionysus',
      false,
      undefined,
      undefined
    );
    expect(get(game.gameState)?.sessionId).toBe('session-test');
    expect(get(game.apiConnected)).toBe(true);
    expect(get(game.apiError)).toBeNull();
    expect(get(game.isLoading)).toBe(false);
  });

  it('submits human moves using optimistic UI then commits backend response', async () => {
    apiService.startGame.mockResolvedValueOnce(makeGameState());
    apiService.submitMove.mockResolvedValueOnce(makeAfterMoveState());
    const game = await freshStore();

    await game.startNewGame('2-player', 'human', 'dionysus', false);
    await game.submitMove(' E2 ');

    expect(apiService.submitMove).toHaveBeenCalledWith('session-test', 'e2');
    const state = get(game.gameState);
    expect(state?.currentPlayer).toBe(2);
    expect(state?.players[0].position).toEqual({ col: 'e', row: 2 });
    expect(state?.moveHistory).toHaveLength(1);
    expect(get(game.isSubmitting)).toBe(false);
  });

  it('reverts optimistic move if the backend rejects it', async () => {
    apiService.startGame.mockResolvedValueOnce(makeGameState());
    apiService.submitMove.mockRejectedValueOnce(new Error('Illegal pawn move'));
    const game = await freshStore();

    await game.startNewGame('2-player', 'human', 'dionysus', false);
    await game.submitMove('e2');

    const state = get(game.gameState);
    expect(state?.currentPlayer).toBe(1);
    expect(state?.players[0].position).toEqual({ col: 'e', row: 1 });
    expect(state?.moveHistory).toHaveLength(0);
    expect(get(game.apiError)).toBe('Illegal pawn move');
  });

  it('does not submit when there is no active game', async () => {
    const game = await freshStore();

    await game.submitMove('e2');

    expect(apiService.submitMove).not.toHaveBeenCalled();
  });

  it('runs bot move only when the current player is an AI', async () => {
    apiService.startGame.mockResolvedValueOnce(
      makeGameState({
        currentPlayer: 2,
        players: [
          {
            id: 1,
            color: 'blue',
            position: { col: 'e', row: 2 },
            wallsRemaining: 10,
            isAI: false
          },
          {
            id: 2,
            color: 'red',
            position: { col: 'e', row: 9 },
            wallsRemaining: 10,
            isAI: true
          }
        ]
      })
    );
    apiService.playBotMove.mockResolvedValueOnce(makeGameState({ currentPlayer: 1 }));
    const game = await freshStore();

    game.setBotAutoplay(false);
    await game.startNewGame('2-player', 'human', 'dionysus', false);
    await game.playBotMove();

    expect(apiService.playBotMove).toHaveBeenCalledWith('session-test');
    expect(get(game.isBotThinking)).toBe(false);
  });

  it('saves, refreshes, and loads saved games through the backend service', async () => {
    const summary = makeSavedGameSummary();
    const loaded = makeLoadedGameResponse();

    apiService.startGame.mockResolvedValueOnce(makeGameState());
    apiService.saveGame.mockResolvedValueOnce(summary);
    apiService.listSavedGames.mockResolvedValueOnce([summary]);
    apiService.loadSavedGame.mockResolvedValueOnce(loaded);

    const game = await freshStore();

    await game.startNewGame('2-player', 'human', 'dionysus', false);
    await game.saveCurrentGame();
    expect(get(game.savedGames)).toHaveLength(1);

    await game.refreshSavedGames();
    expect(get(game.savedGames)[0].id).toBe('save-1');

    await game.loadSavedGame('save-1');
    expect(apiService.loadSavedGame).toHaveBeenCalledWith('save-1');
    expect(get(game.replayState).active).toBe(true);
    expect(get(game.gameState)?.sessionId).toBe('session-test');
  });

  it('refreshApiHealth marks the API as connected or disconnected', async () => {
    const game = await freshStore();

    apiService.ping.mockResolvedValueOnce({ ok: true });
    await game.refreshApiHealth();
    expect(get(game.apiConnected)).toBe(true);

    apiService.ping.mockRejectedValueOnce(new Error('offline'));
    await game.refreshApiHealth();
    expect(get(game.apiConnected)).toBe(false);
    expect(get(game.apiError)).toBe('offline');
  });
});
