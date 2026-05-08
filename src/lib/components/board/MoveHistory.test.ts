import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import MoveHistory from './MoveHistory.svelte';

describe('MoveHistory', () => {
  it('shows empty history text', () => {
    render(MoveHistory, { props: { moves: [] } });
    expect(screen.getByText(/no moves yet/i)).toBeInTheDocument();
  });

  it('renders moves in paired rows', () => {
    render(MoveHistory, {
      props: {
        moves: [
          { notation: 'e2', type: 'pawn', player: 1, timestamp: 1 },
          { notation: 'e8', type: 'pawn', player: 2, timestamp: 2 },
          { notation: 'a1h', type: 'wall', player: 1, timestamp: 3 }
        ]
      }
    });

    expect(screen.getByText('1.')).toBeInTheDocument();
    expect(screen.getByText('2.')).toBeInTheDocument();
    expect(screen.getByText('e2')).toBeInTheDocument();
    expect(screen.getByText('e8')).toBeInTheDocument();
    expect(screen.getByText('a1h')).toBeInTheDocument();
  });
});
