import type { Position } from '$lib/types/game';

const COLS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
const WALL_COLS = COLS.slice(0, 8);

export function parseSquare(notation: string): Position | null {
  if (notation.length < 2) return null;

  const col = notation[0];
  const row = Number.parseInt(notation.slice(1), 10);

  if (!COLS.includes(col) || Number.isNaN(row) || row < 1 || row > 9) {
    return null;
  }

  return { col, row };
}

export function parseWall(notation: string): { position: Position; orientation: 'h' | 'v' } | null {
  if (notation.length < 3) return null;

  const col = notation[0];
  const row = Number.parseInt(notation.slice(1, -1), 10);
  const orientation = notation.at(-1);

  if (!WALL_COLS.includes(col) || Number.isNaN(row) || row < 1 || row > 8) {
    return null;
  }

  if (orientation !== 'h' && orientation !== 'v') {
    return null;
  }

  return {
    position: { col, row },
    orientation
  };
}

export function formatSquare(position: Position): string {
  return `${position.col}${position.row}`;
}

export function isWallNotation(notation: string): boolean {
  return notation.endsWith('h') || notation.endsWith('v');
}

export function isValidNotation(notation: string): boolean {
  return isWallNotation(notation) ? parseWall(notation) !== null : parseSquare(notation) !== null;
}
