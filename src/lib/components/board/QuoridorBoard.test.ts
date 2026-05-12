import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import QuoridorBoard from './QuoridorBoard.svelte';
import { makeGameState } from '$lib/../test/factories/game';

describe('QuoridorBoard', () => {
  it('renders an empty state without an active game', () => {
    render(QuoridorBoard, {
      props: {
        gameState: null,
        disabled: false,
        soundEnabled: false,
        onMove: vi.fn()
      }
    });

    expect(screen.getByText(/no active game/i)).toBeInTheDocument();
  });

  it('calls onMove when a legal square is clicked', async () => {
    const user = userEvent.setup();
    const onMove = vi.fn();

    render(QuoridorBoard, {
      props: {
        gameState: makeGameState({ legalMoves: ['e2'] }),
        disabled: false,
        soundEnabled: false,
        onMove
      }
    });

    await user.click(screen.getByTitle(/move to e2/i));

    expect(onMove).toHaveBeenCalledWith('e2');
  });

  it('does not submit moves while disabled', async () => {
    const user = userEvent.setup();
    const onMove = vi.fn();

    render(QuoridorBoard, {
      props: {
        gameState: makeGameState({ legalMoves: ['e2'] }),
        disabled: true,
        soundEnabled: false,
        onMove
      }
    });

    await user.click(screen.getByTitle(/move to e2/i));

    expect(onMove).not.toHaveBeenCalled();
  });

  it('shows turn, wall count, and legal moves from backend state', () => {
    render(QuoridorBoard, {
      props: {
        gameState: makeGameState({ legalMoves: ['d1', 'e2', 'f1'] }),
        disabled: false,
        soundEnabled: false,
        onMove: vi.fn()
      }
    });

    expect(screen.getByText(/turn: player 1/i)).toBeInTheDocument();
    expect(screen.getByText(/p1 walls: 10/i)).toBeInTheDocument();
    expect(screen.getByText(/legal moves: d1, e2, f1/i)).toBeInTheDocument();
  });
});
