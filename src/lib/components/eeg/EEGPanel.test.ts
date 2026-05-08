import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import EEGPanel from '$lib/components/eeg/EEGPanel.svelte';
import { eegStateFixture } from '$test/factories/eeg';

const eegStore = vi.hoisted(() => ({
  reconnectEEG: vi.fn(),
  startEEGMonitoring: vi.fn(),
  stopEEGMonitoring: vi.fn()
}));

vi.mock('$lib/stores/eeg', () => eegStore);

describe('EEGPanel', () => {
  it('renders Muse controls and graphs', () => {
    render(EEGPanel, { props: { eegState: eegStateFixture(), onReconnect: eegStore.reconnectEEG } });

    expect(screen.getByText(/eeg monitoring/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Start$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Demo$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Reconnect$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Stop$/i })).toBeInTheDocument();
    expect(screen.getByText(/focus channels/i)).toBeInTheDocument();
  });

  it('runs reconnect and stop controls', async () => {
    render(EEGPanel, { props: { eegState: eegStateFixture(), onReconnect: eegStore.reconnectEEG } });

    await fireEvent.click(screen.getByRole('button', { name: /^Reconnect$/i }));
    await fireEvent.click(screen.getByRole('button', { name: /^Stop$/i }));

    expect(eegStore.reconnectEEG).toHaveBeenCalled();
    expect(eegStore.stopEEGMonitoring).toHaveBeenCalledWith(true);
  });
});
