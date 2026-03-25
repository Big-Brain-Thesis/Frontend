import type { Difficulty, GameMode, GameState, Move, Player, Position, Wall } from '$lib/types/game';
import { formatSquare, isValidNotation, isWallNotation, parseSquare, parseWall } from '$lib/utils/notation';

const MOCK_DELAY = 250;
const COLS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cloneState<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function nextPlayer(currentPlayer: number, mode: GameMode): number {
  if (mode === '4-player') {
    return currentPlayer === 4 ? 1 : currentPlayer + 1;
  }

  return currentPlayer === 1 ? 2 : 1;
}

function getGoalRow(playerId: number): number {
  return playerId === 1 ? 9 : 1;
}

function inBounds(position: Position): boolean {
  return COLS.includes(position.col) && position.row >= 1 && position.row <= 9;
}

function getNeighborSquares(position: Position): Position[] {
  const colIndex = COLS.indexOf(position.col);
  const candidates = [
    { col: COLS[colIndex], row: position.row + 1 },
    { col: COLS[colIndex], row: position.row - 1 },
    { col: COLS[colIndex - 1], row: position.row },
    { col: COLS[colIndex + 1], row: position.row }
  ].filter((candidate): candidate is Position => Boolean(candidate.col));

  return candidates.filter(inBounds);
}

function edgeKey(a: Position, b: Position): string {
  const left = formatSquare(a);
  const right = formatSquare(b);
  return left < right ? `${left}|${right}` : `${right}|${left}`;
}

function buildBlockedEdges(walls: Wall[]): Set<string> {
  const blocked = new Set<string>();

  for (const wall of walls) {
    const colIndex = COLS.indexOf(wall.position.col);
    const nextCol = COLS[colIndex + 1];

    if (!nextCol) continue;

    if (wall.orientation === 'h') {
      const lowerRow = wall.position.row;
      const upperRow = wall.position.row + 1;

      blocked.add(edgeKey({ col: wall.position.col, row: lowerRow }, { col: wall.position.col, row: upperRow }));
      blocked.add(edgeKey({ col: nextCol, row: lowerRow }, { col: nextCol, row: upperRow }));
    } else {
      const lowerRow = wall.position.row;
      const upperRow = wall.position.row + 1;

      blocked.add(edgeKey({ col: wall.position.col, row: lowerRow }, { col: nextCol, row: lowerRow }));
      blocked.add(edgeKey({ col: wall.position.col, row: upperRow }, { col: nextCol, row: upperRow }));
    }
  }

  return blocked;
}

function computeLegalMoves(players: Player[], currentPlayer: number, walls: Wall[]): string[] {
  const activePlayer = players.find((player) => player.id === currentPlayer);
  if (!activePlayer) return [];

  const occupied = new Set(players.filter((player) => player.id !== currentPlayer).map((player) => formatSquare(player.position)));
  const blockedEdges = buildBlockedEdges(walls);

  return getNeighborSquares(activePlayer.position)
    .filter((neighbor) => !occupied.has(formatSquare(neighbor)))
    .filter((neighbor) => !blockedEdges.has(edgeKey(activePlayer.position, neighbor)))
    .map(formatSquare);
}

function createInitialPlayers(): Player[] {
  return [
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
  ];
}

function createInitialGameState(mode: GameMode, difficulty: Difficulty): GameState {
  const players = createInitialPlayers();

  return {
    sessionId: `session-${Date.now()}`,
    mode,
    difficulty,
    status: 'in-progress',
    currentPlayer: 1,
    players,
    walls: [],
    moveHistory: [],
    winner: null,
    legalMoves: computeLegalMoves(players, 1, []),
    boardSize: 9,
    definedPosition: 'e1 e9 / - / 1 / 10 10'
  };
}

function buildPositionString(state: GameState): string {
  const positions = state.players.map((player) => formatSquare(player.position)).join(' ');
  const walls = state.walls.length ? state.walls.map((wall) => `${formatSquare(wall.position)}${wall.orientation}`).join(' ') : '-';
  const wallsRemaining = state.players.map((player) => player.wallsRemaining).join(' ');
  return `${positions} / ${walls} / ${state.currentPlayer} / ${wallsRemaining}`;
}

function wallPlacementConflict(walls: Wall[], candidate: Wall): string | null {
  const candidateColIndex = COLS.indexOf(candidate.position.col);

  for (const wall of walls) {
    if (wall.position.col === candidate.position.col && wall.position.row === candidate.position.row) {
      return wall.orientation === candidate.orientation ? 'Wall already exists there' : 'Walls cannot cross at the same anchor';
    }

    const wallColIndex = COLS.indexOf(wall.position.col);

    if (candidate.orientation === 'h' && wall.orientation === 'h' && wall.position.row === candidate.position.row) {
      if (Math.abs(wallColIndex - candidateColIndex) === 1) {
        return 'Horizontal walls cannot overlap';
      }
    }

    if (candidate.orientation === 'v' && wall.orientation === 'v' && wall.position.col === candidate.position.col) {
      if (Math.abs(wall.position.row - candidate.position.row) === 1) {
        return 'Vertical walls cannot overlap';
      }
    }
  }

  return null;
}

function applyMove(state: GameState, moveNotation: string, playerId: number): { valid: boolean; state?: GameState; error?: string } {
  if (!isValidNotation(moveNotation)) {
    return { valid: false, error: 'Invalid notation format' };
  }

  if (state.currentPlayer !== playerId) {
    return { valid: false, error: "Not this player's turn" };
  }

  const nextState = cloneState(state);
  const activePlayer = nextState.players.find((player) => player.id === playerId);

  if (!activePlayer) {
    return { valid: false, error: 'Active player missing' };
  }

  const occupiedSquares = new Set(nextState.players.filter((player) => player.id !== playerId).map((player) => formatSquare(player.position)));

  if (isWallNotation(moveNotation)) {
    const wallMove = parseWall(moveNotation);

    if (!wallMove) {
      return { valid: false, error: 'Invalid wall notation' };
    }

    if (activePlayer.wallsRemaining <= 0) {
      return { valid: false, error: 'No walls remaining' };
    }

    const conflict = wallPlacementConflict(nextState.walls, wallMove as Wall);
    if (conflict) {
      return { valid: false, error: conflict };
    }

    nextState.walls.push(wallMove as Wall);
    activePlayer.wallsRemaining -= 1;
  } else {
    const square = parseSquare(moveNotation);

    if (!square) {
      return { valid: false, error: 'Invalid square notation' };
    }

    if (occupiedSquares.has(formatSquare(square))) {
      return { valid: false, error: 'Target square is occupied' };
    }

    const legalMoves = computeLegalMoves(nextState.players, playerId, nextState.walls);
    if (!legalMoves.includes(moveNotation)) {
      return { valid: false, error: 'Move is not legal in the current ruleset' };
    }

    activePlayer.position = square;
  }

  const move: Move = {
    notation: moveNotation,
    type: isWallNotation(moveNotation) ? 'wall' : 'pawn',
    player: playerId,
    timestamp: Date.now()
  };

  nextState.moveHistory.push(move);

  if (activePlayer.position.row === getGoalRow(playerId)) {
    nextState.winner = playerId;
    nextState.status = 'finished';
    nextState.legalMoves = [];
    nextState.definedPosition = buildPositionString(nextState);
    return { valid: true, state: nextState };
  }

  nextState.currentPlayer = nextPlayer(playerId, nextState.mode);
  nextState.legalMoves = computeLegalMoves(nextState.players, nextState.currentPlayer, nextState.walls);
  nextState.definedPosition = buildPositionString(nextState);

  return { valid: true, state: nextState };
}

export const apiService = {
  async startGame(mode: GameMode, difficulty: Difficulty, eegEnabled: boolean): Promise<GameState> {
    await wait(MOCK_DELAY);
    return createInitialGameState(mode, difficulty);
  },

  async getGameState(sessionId: string): Promise<GameState> {
    await wait(MOCK_DELAY);
    return createInitialGameState('2-player', 'medium');
  },

  async submitMove(
    sessionId: string,
    moveNotation: string,
    currentState: GameState,
    playerId = currentState.currentPlayer
  ): Promise<{ valid: boolean; state?: GameState; error?: string }> {
    await wait(MOCK_DELAY);
    return applyMove(currentState, moveNotation.toLowerCase().trim(), playerId);
  },

  async resetGame(currentState: GameState): Promise<GameState> {
    await wait(MOCK_DELAY);
    return createInitialGameState(currentState.mode, currentState.difficulty);
  },

  async ping(): Promise<{ ok: boolean; latency: number }> {
    const start = Date.now();
    await wait(50);
    return { ok: true, latency: Date.now() - start };
  },

  async getAIMove(state: GameState): Promise<string> {
    await wait(500);

    const legalMoves = state.legalMoves;
    if (legalMoves.length === 0) {
      return 'e8';
    }

    const targetRow = getGoalRow(state.currentPlayer);

    const bestMove = [...legalMoves].sort((left, right) => {
      const leftRow = parseSquare(left)?.row ?? 0;
      const rightRow = parseSquare(right)?.row ?? 0;
      return Math.abs(leftRow - targetRow) - Math.abs(rightRow - targetRow);
    })[0];

    if (state.difficulty === 'random') {
      return legalMoves[Math.floor(Math.random() * legalMoves.length)] ?? bestMove;
    }

    return bestMove;
  }
};
