import { get } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eegSample } from '$test/factories/eeg';

const api = vi.hoisted(() => ({
  startMuseReader: vi.fn(),
  stopMuseReader: vi.fn(),
  fetchEEGHistory: vi.fn(),
  getMuseHealth: vi.fn(),
  connectEEGWebSocket: vi.fn()
}));

let websocketCallbacks: {
  onSample?: (sample: ReturnType<typeof eegSample>) => void;
  onStatus?: (status: any) => void;
  onError?: (message: string) => void;
} = {};

const closeConnection = vi.fn();

vi.mock('$lib/services/apiEEG', () => api);
vi.mock('$lib/stores/logger', () => ({ addLog: vi.fn() }));

async function loadStore() {
  const store = await import('$lib/stores/eeg');
  store.stopEEGMonitoring(false);
  return store;
}

describe('EEG store integration', () => {
  beforeEach(() => {
    vi.resetModules();
    websocketCallbacks = {};
    closeConnection.mockClear();
    api.startMuseReader.mockResolvedValue({ ok: true, status: 'started' });
    api.stopMuseReader.mockResolvedValue({ ok: true, status: 'stopped' });
    api.fetchEEGHistory.mockResolvedValue([]);
    api.getMuseHealth.mockResolvedValue({ ok: true });
    api.connectEEGWebSocket.mockImplementation((onSample, onStatus, onError) => {
      websocketCallbacks = { onSample, onStatus, onError };
      onStatus('connected');
      return { close: closeConnection };
    });
  });

  it('starts the Muse reader, loads history, and opens the live websocket', async () => {
    const history = [eegSample({ sequence: 1 }), eegSample({ sequence: 2 })];
    api.fetchEEGHistory.mockResolvedValue(history);

    const store = await loadStore();
    await store.startEEGMonitoring({ simulate: true });

    expect(api.startMuseReader).toHaveBeenCalledWith({ simulate: true });
    expect(api.fetchEEGHistory).toHaveBeenCalled();
    expect(api.connectEEGWebSocket).toHaveBeenCalled();

    const state = get(store.eegState);
    expect(state.enabled).toBe(true);
    expect(state.status).toBe('connecting');
    expect(state.samples).toHaveLength(2);
    expect(state.samples[1].sequence).toBe(2);
    expect(get(store.museBackendConnected)).toBe(true);
  });

  it('waits for a live EEG frame before marking the device connected', async () => {
    const store = await loadStore();
    await store.startEEGMonitoring();

    expect(get(store.eegState).status).toBe('connecting');

    websocketCallbacks.onSample?.(eegSample({ sequence: 1 }));

    expect(get(store.eegState).status).toBe('connected');
  });

  it('keeps streaming when history loading fails', async () => {
    api.fetchEEGHistory.mockRejectedValue(new Error('history failed'));

    const store = await loadStore();
    await store.startEEGMonitoring();

    websocketCallbacks.onSample?.(
      eegSample({ sequence: 1, channels: { TP9: 9, AF7: 8, AF8: 7, TP10: 6 } })
    );

    const state = get(store.eegState);
    expect(state.status).toBe('connected');
    expect(state.samples).toHaveLength(1);
    expect(state.samples[0].channels.TP9).toBe(9);
  });

  it('does not drop live frames when sequence numbers restart after reconnect', async () => {
    const store = await loadStore();
    await store.startEEGMonitoring();

    websocketCallbacks.onSample?.(eegSample({ sequence: 1, channels: { TP9: 1, AF7: 1, AF8: 1, TP10: 1 } }));
    websocketCallbacks.onSample?.(eegSample({ sequence: 1, channels: { TP9: 2, AF7: 2, AF8: 2, TP10: 2 } }));

    const state = get(store.eegState);
    expect(state.samples).toHaveLength(2);
    expect(state.samples[0].channels.TP9).toBe(1);
    expect(state.samples[1].channels.TP9).toBe(2);
  });

  it('updates status and error from websocket callbacks', async () => {
    const store = await loadStore();
    await store.startEEGMonitoring();

    websocketCallbacks.onStatus?.('reconnecting');
    expect(get(store.eegState).status).toBe('reconnecting');
    expect(get(store.eegState).error).toBe('EEG websocket reconnecting');

    websocketCallbacks.onError?.('bad frame');
    expect(get(store.eegState).error).toBe('bad frame');
  });

  it('closes websocket and clears samples when stopped', async () => {
    const store = await loadStore();
    await store.startEEGMonitoring();
    websocketCallbacks.onSample?.(eegSample({ sequence: 1 }));

    store.stopEEGMonitoring(true);

    const state = get(store.eegState);
    expect(closeConnection).toHaveBeenCalled();
    expect(api.stopMuseReader).toHaveBeenCalled();
    expect(state.enabled).toBe(false);
    expect(state.status).toBe('disconnected');
    expect(state.samples).toEqual([]);
  });
});
