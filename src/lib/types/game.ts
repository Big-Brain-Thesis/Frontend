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

export type GameMode = '2-player' | '4-player';
export type Difficulty = 'random' | 'easy' | 'medium' | 'hard' | 'expert';

export type GameStatus = 'idle' | 'ready' | 'in-progress' | 'paused' | 'finished' | 'error';

export type GameState = {
  sessionId: string;
  mode: GameMode;
  difficulty: Difficulty;
  status: GameStatus;
  currentPlayer: number;
  players: Player[];
  walls: Wall[];
  moveHistory: Move[];
  winner: number | null;
  legalMoves: string[];
  boardSize: number;
  evaluation?: number;
  definedPosition?: string;
};

export type ApiStatus = {
  connected: boolean;
  lastPing: number | null;
  error: string | null;
};
