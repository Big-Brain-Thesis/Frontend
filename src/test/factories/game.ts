import type { GameState, LoadedGameResponse, SavedGameSummary } from '$lib/types/game';

export function makeGameState(overrides: Partial<GameState> = {}): GameState {
  return {
    sessionId: 'session-test',
    mode: '2-player',
    difficulty: 'human-vs-dionysus',
    status: 'in-progress',
    currentPlayer: 1,
    players: [
      {
        id: 1,
        color: 'blue',
        position: { col: 'e', row: 1 },
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
    ],
    walls: [],
    moveHistory: [],
    winner: null,
    legalMoves: ['d1', 'e2', 'f1'],
    legalWalls: ['a1h', 'a1v', 'b2h'],
    boardSize: 9,
    definedPosition: ' /  / e1 e9 / 10 10 / 1',
    ...overrides
  };
}

export function makeAfterMoveState(): GameState {
  return makeGameState({
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
    ],
    moveHistory: [
      {
        notation: 'e2',
        type: 'pawn',
        player: 1,
        timestamp: 1000
      }
    ],
    legalMoves: ['e8'],
    legalWalls: ['a1h'],
    definedPosition: ' /  / e2 e9 / 10 10 / 2'
  });
}

export function makeSavedGameSummary(overrides: Partial<SavedGameSummary> = {}): SavedGameSummary {
  return {
    id: 'save-1',
    sessionId: 'session-test',
    savedAt: 1000,
    moveCount: 1,
    winner: null,
    playerProfiles: ['human', 'dionysus'],
    ...overrides
  };
}

export function makeLoadedGameResponse(): LoadedGameResponse {
  const initial = makeGameState();
  const afterMove = makeAfterMoveState();

  return {
    summary: makeSavedGameSummary(),
    session: afterMove,
    replay: [initial, afterMove]
  };
}
