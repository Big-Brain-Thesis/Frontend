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