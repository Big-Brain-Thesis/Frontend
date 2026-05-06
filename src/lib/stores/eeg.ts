import { writable } from 'svelte/store';
import { addLog } from '$lib/stores/logger';
import type { EEGConnectionStatus, EEGSample, EEGState } from '$lib/types/eeg';
import { connectEEGWebSocket, fetchEEGHistory } from '$lib/services/apiEEG';

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
export const museBackendConnected = writable(false);
export const lastMusePing = writable<number | null>(null);
export const museError = writable<string | null>(null);

let samples: EEGSample[] = [];
let websocketConnection: { close: () => void } | null = null;
let sampleCounter = 0;

function markMuseOk() {
  museBackendConnected.set(true);
  lastMusePing.set(Date.now());
  museError.set(null);
}

function markMuseDown(message: string) {
  museBackendConnected.set(false);
  lastMusePing.set(Date.now());
  museError.set(message);
}

function cleanupListeners() {
  websocketConnection?.close();
  websocketConnection = null;
}

export async function startEEGMonitoring() {
  stopEEGMonitoring(false);

  eegState.set({ ...initialState, enabled: true, status: 'connecting' });
  museBackendConnected.set(false);
  museError.set(null);
  addLog('INFO', 'EEG', 'EEG monitoring enabled');

  try {
    const history = await fetchEEGHistory(MAX_SAMPLES);
    markMuseOk();
    samples = history.slice(-MAX_SAMPLES);

    if (samples.length > 0) {
      eegState.update((state) => ({
        ...state,
        samples: [...samples],
        lastSampleTimestamp: samples.at(-1)?.timestamp ?? state.lastSampleTimestamp
      }));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    markMuseDown(message);
    addLog('WARN', 'EEG', 'Could not load EEG history', {
      message
    });
  }

  websocketConnection = connectEEGWebSocket(
    (sample: EEGSample) => {
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
    },
    (status: EEGConnectionStatus) => {
      eegState.update((state) => ({ ...state, status }));

      if (status === 'connected') {
        markMuseOk();
        addLog('INFO', 'EEG', 'EEG stream active');
      } else if (status === 'disconnected') {
        markMuseDown('Muse backend disconnected');
        addLog('WARN', 'EEG', 'EEG websocket disconnected');
      } else if (status === 'error') {
        markMuseDown('Muse websocket error');
        addLog('ERROR', 'EEG', 'EEG stream error');
      }
    },
    (error: string) => {
      eegState.update((state) => ({
        ...state,
        status: 'error',
        error
      }));
      markMuseDown(error);
      addLog('ERROR', 'EEG', `EEG websocket error: ${error}`);
    }
  );

  eegState.update((state) => ({
    ...state,
    enabled: true,
    deviceName: 'Muse 2 API',
    sampleRate: 8,
    error: null
  }));
}

export function stopEEGMonitoring(logStop = true) {
  cleanupListeners();
  samples = [];
  sampleCounter = 0;
  eegState.set(initialState);
  museBackendConnected.set(false);

  if (logStop) {
    addLog('INFO', 'EEG', 'EEG monitoring stopped');
  }
}

export async function reconnectEEG() {
  addLog('INFO', 'EEG', 'Manual EEG reconnect requested');
  stopEEGMonitoring(false);
  await startEEGMonitoring();
}
