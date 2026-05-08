export type Position = {
  col: string;
  row: number;
};

export type PlayerColor = 'blue' | 'red' | 'green' | 'yellow';

export type Player = {
  id: number;
  color: PlayerColor;
  position: Position;
  wallsRemaining: number;
  isAI: boolean;
};

export type WallOrientation = 'h' | 'v';

export type Wall = {
  position: Position;
  orientation: WallOrientation;
};

export type MoveType = 'pawn' | 'wall';

export type Move = {
  notation: string;
  type: MoveType;
  player: number;
  timestamp: number;
};

export type GameMode = '2-player';

export type PlayerController = 'human' | 'dionysus' | 'hermes';
export type Opponent = PlayerController;
export type Difficulty = PlayerController;

export type GameStatus = 'idle' | 'ready' | 'in-progress' | 'paused' | 'finished' | 'error';

export type GameState = {
  sessionId: string;
  mode: GameMode;
  difficulty: string;
  status: GameStatus;
  currentPlayer: number;
  players: Player[];
  walls: Wall[];
  moveHistory: Move[];
  winner: number | null;
  legalMoves: string[];
  legalWalls: string[];
  boardSize: number;
  evaluation?: number;
  definedPosition?: string;
};

export type ApiStatus = {
  connected: boolean;
  lastPing: number | null;
  error: string | null;
};

export type PlayerSetup = {
  player1: PlayerController;
  player2: PlayerController;
};

export type SavedGameSummary = {
  id: string;
  sessionId: string;
  savedAt: number;
  moveCount: number;
  winner: number | null;
  playerProfiles: PlayerController[];
};

export type LoadedGameResponse = {
  summary: SavedGameSummary;
  session: GameState;
  replay: GameState[];
};

export type ReplayState = {
  active: boolean;
  index: number;
  states: GameState[];
  sourceId: string | null;
};
export type GameStateFactoryOverrides = Partial<GameState> & {
  player1?: Partial<Player>;
  player2?: Partial<Player>;
  legalMove?: string;
  legalWall?: string;
};

export function gameStateFactory(overrides: GameStateFactoryOverrides = {}): GameState {
  const player1: Player = {
    id: 1,
    color: 'blue',
    position: { col: 'e', row: 1 },
    wallsRemaining: 10,
    isAI: false,
    ...(overrides.player1 ?? {})
  };

  const player2: Player = {
    id: 2,
    color: 'red',
    position: { col: 'e', row: 9 },
    wallsRemaining: 10,
    isAI: false,
    ...(overrides.player2 ?? {})
  };

  const legalMoves = overrides.legalMoves ?? (overrides.legalMove ? [overrides.legalMove] : ['e2']);
  const legalWalls = overrides.legalWalls ?? (overrides.legalWall ? [overrides.legalWall] : ['a1h']);

  const state: GameState = {
    sessionId: 'test-session',
    mode: '2-player',
    difficulty: 'human',
    status: 'in-progress',
    currentPlayer: 1,
    players: [player1, player2],
    walls: [],
    moveHistory: [],
    winner: null,
    legalMoves,
    legalWalls,
    boardSize: 9,
    definedPosition: ' /  / e1 e9 / 10 10 / 1'
  };

  return {
    ...state,
    ...overrides,
    players: overrides.players ?? state.players,
    walls: overrides.walls ?? state.walls,
    moveHistory: overrides.moveHistory ?? state.moveHistory,
    legalMoves,
    legalWalls
  };
}
