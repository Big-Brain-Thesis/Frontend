import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeGameState, makeLoadedGameResponse, makeSavedGameSummary } from '$lib/test/factories/game';

vi.mock('$lib/stores/logger', () => ({
  addLog: vi.fn()
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

describe('apiService', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('starts a game with the backend request shape expected by the Rust API', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse(makeGameState()));

    const { apiService } = await import('$lib/services/api');
    const result = await apiService.startGame('2-player', 'human', 'hermes', true, 1200, 2400);

    expect(result.sessionId).toBe('session-test');
    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/game/start');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({
      mode: '2-player',
      player1: 'human',
      player2: 'hermes',
      opponent: 'hermes',
      eegEnabled: true,
      thinkingTimeMsP1: 1200,
      thinkingTimeMsP2: 2400
    });
  });

  it('normalizes submitted move notation before posting it', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse(makeGameState()));

    const { apiService } = await import('$lib/services/api');
    await apiService.submitMove('session-test', ' E2 ');

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/game/session-test/move');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({ move: 'e2' });
  });

  it('calls all Quoridor server routes with the expected method', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(makeGameState()))
      .mockResolvedValueOnce(jsonResponse(makeGameState()))
      .mockResolvedValueOnce(jsonResponse(makeSavedGameSummary()))
      .mockResolvedValueOnce(jsonResponse([makeSavedGameSummary()]))
      .mockResolvedValueOnce(jsonResponse(makeLoadedGameResponse()))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    const { apiService } = await import('$lib/services/api');

    await apiService.playBotMove('session-test');
    await apiService.resetGame('session-test');
    await apiService.saveGame('session-test');
    await apiService.listSavedGames();
    await apiService.loadSavedGame('save id/with slash');
    await apiService.ping();

    expect(fetchMock.mock.calls.map(([url, init]) => [String(url), init?.method ?? 'GET'])).toEqual([
      [expect.stringContaining('/api/game/session-test/bot-move'), 'POST'],
      [expect.stringContaining('/api/game/session-test/reset'), 'POST'],
      [expect.stringContaining('/api/game/session-test/save'), 'POST'],
      [expect.stringContaining('/api/saves'), 'GET'],
      [expect.stringContaining('/api/saves/save%20id%2Fwith%20slash/load'), 'POST'],
      [expect.stringContaining('/api/health'), 'GET']
    ]);
  });

  it('throws the backend error message when the server returns JSON error', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'Illegal pawn move' }, 400));

    const { apiService } = await import('$lib/services/api');

    await expect(apiService.submitMove('session-test', 'z9')).rejects.toThrow('Illegal pawn move');
  });

  it('throws network failures as Error objects', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockRejectedValueOnce(new TypeError('backend unreachable'));

    const { apiService } = await import('$lib/services/api');

    await expect(apiService.ping()).rejects.toThrow('backend unreachable');
  });
});
