import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import SessionControls from './SessionControls.svelte';
import type { PlayerController } from '$lib/types/game';

type SessionControlsProps = {
  player1: PlayerController;
  player2: PlayerController;
  eegEnabled: boolean;
  gameActive: boolean;
  disabled: boolean;
  botAutoplay: boolean;
  botSpeedMs: number;
  canStepBot: boolean;
  botThinking: boolean;
  thinkingTimeMsP1: number;
  thinkingTimeMsP2: number;
  onNewGame: () => void;
  onReset: () => void;
  onPlayer1Change: (value: PlayerController) => void;
  onPlayer2Change: (value: PlayerController) => void;
  onEEGEnabledChange: (value: boolean) => void;
  onBotAutoplayChange: (value: boolean) => void;
  onBotSpeedChange: (value: number) => void;
  onStepBot: () => void;
  onThinkingTime1Change: (value: number) => void;
  onThinkingTime2Change: (value: number) => void;
};

function props(overrides: Partial<SessionControlsProps> = {}): SessionControlsProps {
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
    await user.click(screen.getByLabelText(/monitor eeg/i));

    expect(p.onEEGEnabledChange).toHaveBeenCalledWith(true);
  });

  it('shows reset only when a game is active', async () => {
    const { rerender } = render(SessionControls, {
      props: props({ gameActive: false })
    });

    expect(screen.queryByRole('button', { name: /reset/i })).not.toBeInTheDocument();

    await rerender(props({ gameActive: true }));
    expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument();
  });

  it('enables step only when the bot can move', async () => {
    const { rerender } = render(SessionControls, {
      props: props({ canStepBot: false })
    });

    expect(screen.getByRole('button', { name: /step/i })).toBeDisabled();

    await rerender(props({ canStepBot: true }));
    expect(screen.getByRole('button', { name: /step/i })).not.toBeDisabled();
  });
});