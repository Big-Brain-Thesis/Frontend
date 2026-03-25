import { writable } from 'svelte/store';
import { mockEEGStream } from '$lib/services/mockEEG';
import type { EEGConnectionStatus, EEGSample, EEGState } from '$lib/types/eeg';
import { addLog } from '$lib/stores/logger';

const MAX_SAMPLES = 240;

const initialState: EEGState = {
  enabled: false,
  status: 'disconnected',
  deviceName: null,
  sampleRate: null,
  lastSampleTimestamp: null,
  error: null,
  samples: []
};

export const eegState = writable<EEGState>(initialState);

let samples: EEGSample[] = [];
let unsubscribeStatus: (() => void) | null = null;
let unsubscribeSamples: (() => void) | null = null;
let sampleCounter = 0;

function cleanupListeners() {
  unsubscribeStatus?.();
  unsubscribeSamples?.();
  unsubscribeStatus = null;
  unsubscribeSamples = null;
}

export async function startEEGMonitoring() {
  stopEEGMonitoring(false);

  eegState.set({ ...initialState, enabled: true, status: 'connecting' });
  addLog('INFO', 'EEG', 'EEG monitoring enabled');

  unsubscribeStatus = mockEEGStream.onStatusChange((status: EEGConnectionStatus) => {
    eegState.update((state) => ({ ...state, status }));

    if (status === 'connected') {
      addLog('INFO', 'EEG', 'EEG stream active');
    } else if (status === 'reconnecting') {
      addLog('WARN', 'EEG', 'EEG reconnecting...');
    } else if (status === 'error') {
      addLog('ERROR', 'EEG', 'EEG stream error');
    }
  });

  unsubscribeSamples = mockEEGStream.onSample((sample: EEGSample) => {
    sampleCounter += 1;
    samples.push(sample);

    if (samples.length > MAX_SAMPLES) {
      samples = samples.slice(-MAX_SAMPLES);
    }

    if (sampleCounter % 2 === 0) {
      eegState.update((state) => ({
        ...state,
        samples: [...samples],
        lastSampleTimestamp: sample.timestamp
      }));
    }
  });

  try {
    addLog('INFO', 'EEG', 'Connecting to EEG device...');
    await mockEEGStream.connect();
    eegState.update((state) => ({
      ...state,
      enabled: true,
      deviceName: 'Muse S (Mock)',
      sampleRate: 100,
      error: null
    }));
    addLog('INFO', 'EEG', 'EEG device connected: Muse S (Mock)');
  } catch (error) {
    eegState.update((state) => ({
      ...state,
      status: 'error',
      error: String(error)
    }));
    addLog('ERROR', 'EEG', `EEG connection failed: ${String(error)}`);
  }
}

export function stopEEGMonitoring(logStop = true) {
  cleanupListeners();
  mockEEGStream.disconnect();
  samples = [];
  sampleCounter = 0;
  eegState.set(initialState);

  if (logStop) {
    addLog('INFO', 'EEG', 'EEG monitoring stopped');
  }
}

export async function reconnectEEG() {
  addLog('INFO', 'EEG', 'Manual EEG reconnect requested');
  stopEEGMonitoring(false);
  await startEEGMonitoring();
}
