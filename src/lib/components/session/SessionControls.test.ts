import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import SessionControls from './SessionControls.svelte';

function props(overrides = {}) {
  return {
    player1: 'human',
    player2: 'dionysus',
    eegEnabled: false,
    gameActive: false,
    disabled: false,
    botAutoplay: true,
    botSpeedMs: 400,
    canStepBot: false,
    botThinking: false,
    thinkingTimeMsP1: 1000,
    thinkingTimeMsP2: 1000,
    onNewGame: vi.fn(),
    onReset: vi.fn(),
    onPlayer1Change: vi.fn(),
    onPlayer2Change: vi.fn(),
    onEEGEnabledChange: vi.fn(),
    onBotAutoplayChange: vi.fn(),
    onBotSpeedChange: vi.fn(),
    onStepBot: vi.fn(),
    onThinkingTime1Change: vi.fn(),
    onThinkingTime2Change: vi.fn(),
    ...overrides
  };
}

describe('SessionControls', () => {
  it('starts a new game from the New Game button', async () => {
    const user = userEvent.setup();
    const p = props();

    render(SessionControls, { props: p });
    await user.click(screen.getByRole('button', { name: /new game/i }));

    expect(p.onNewGame).toHaveBeenCalledOnce();
  });

  it('notifies parent when player controllers change', async () => {
    const user = userEvent.setup();
    const p = props();

    render(SessionControls, { props: p });
    await user.selectOptions(screen.getByLabelText(/player 2/i), 'hermes');

    expect(p.onPlayer2Change).toHaveBeenCalledWith('hermes');
  });

  it('notifies parent when EEG monitoring is toggled', async () => {
    const user = userEvent.setup();
    const p = props();

    render(SessionControls, { props: p });
    await user.click(screen.getByLabelText(/monitor brain activity/i));

    expect(p.onEEGEnabledChange).toHaveBeenCalledWith(true);
  });

  it('shows reset only when a game is active', () => {
    const { rerender } = render(SessionControls, { props: props({ gameActive: false }) });
    expect(screen.queryByRole('button', { name: /reset/i })).not.toBeInTheDocument();

    rerender(props({ gameActive: true }));
    expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument();
  });

  it('enables Step bot once only when the bot can move', () => {
    const { rerender } = render(SessionControls, { props: props({ canStepBot: false }) });
    expect(screen.getByRole('button', { name: /step bot once/i })).toBeDisabled();

    rerender(props({ canStepBot: true }));
    expect(screen.getByRole('button', { name: /step bot once/i })).not.toBeDisabled();
  });
});
