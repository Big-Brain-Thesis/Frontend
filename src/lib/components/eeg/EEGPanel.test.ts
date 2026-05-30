import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EEGPanel from '$lib/components/eeg/EEGPanel.svelte';
import { eegStateFixture } from '$test/factories/eeg';

const eegStore = vi.hoisted(() => ({
  startEEGMonitoring: vi.fn(),
  stopEEGMonitoring: vi.fn()
}));

vi.mock('$lib/stores/eeg', () => eegStore);

describe('EEGPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Muse controls and graphs', () => {
    render(EEGPanel, { props: { eegState: eegStateFixture() } });

    expect(screen.getByText(/eeg monitoring/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Connect Muse$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Demo Stream$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Stop$/i })).toBeInTheDocument();
    expect(screen.getByText(/focus channels/i)).toBeInTheDocument();
  });

  it('shows waiting state and hides graphs while connecting without samples', () => {
    render(EEGPanel, {
      props: {
        eegState: eegStateFixture({
          enabled: true,
          status: 'connecting',
          samples: []
        })
      }
    });

    expect(screen.getByText(/waiting for muse data/i)).toBeInTheDocument();
    expect(screen.queryByText(/focus channels/i)).not.toBeInTheDocument();
    expect(document.querySelectorAll('svg')).toHaveLength(0);
  });

  it('starts real and demo streams when disconnected', async () => {
    render(EEGPanel, {
      props: {
        eegState: eegStateFixture({
          enabled: false,
          status: 'disconnected',
          samples: []
        })
      }
    });

    await fireEvent.click(screen.getByRole('button', { name: /^Connect Muse$/i }));
    await fireEvent.click(screen.getByRole('button', { name: /^Demo Stream$/i }));

    expect(eegStore.startEEGMonitoring).toHaveBeenCalledWith();
    expect(eegStore.startEEGMonitoring).toHaveBeenCalledWith({ simulate: true });
  });

  it('stops an active stream', async () => {
    render(EEGPanel, { props: { eegState: eegStateFixture() } });
    await fireEvent.click(screen.getByRole('button', { name: /^Stop$/i }));

    expect(eegStore.stopEEGMonitoring).toHaveBeenCalledWith(true);
  });
});
