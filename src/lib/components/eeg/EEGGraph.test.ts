import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import EEGGraph from '$lib/components/eeg/EEGGraph.svelte';
import { eegSample } from '$test/factories/eeg';

describe('EEGGraph', () => {
  it('shows the waiting state before samples arrive', () => {
    render(EEGGraph, { props: { samples: [], loading: true, status: 'connecting' } });

    expect(screen.getByText(/waiting for muse data/i)).toBeInTheDocument();
    expect(screen.getByText(/status: connecting/i)).toBeInTheDocument();
  });

  it('renders stacked raw graphs for focus and movement channels', () => {
    render(EEGGraph, {
      props: {
        samples: [
          eegSample({ sequence: 1, channels: { TP9: 1, AF7: 2, AF8: -3, TP10: -4 } }),
          eegSample({ sequence: 2, channels: { TP9: 2, AF7: 3, AF8: -2, TP10: -5 } }),
          eegSample({ sequence: 3, channels: { TP9: 3, AF7: 4, AF8: -1, TP10: -6 } })
        ],
        loading: false,
        status: 'connected'
      }
    });

    expect(screen.getByText(/live eeg graphs/i)).toBeInTheDocument();
    expect(screen.getByText(/focus channels/i)).toBeInTheDocument();
    expect(screen.getByText(/movement channels/i)).toBeInTheDocument();
    expect(document.querySelectorAll('svg')).toHaveLength(2);
    expect(document.querySelectorAll('path')).toHaveLength(4);
  });
});
