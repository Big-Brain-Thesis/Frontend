import { writable } from 'svelte/store';
import { addLog } from '$lib/stores/logger';
import type { EEGConnectionStatus, EEGSample, EEGState } from '$lib/types/eeg';
import {
  connectEEGWebSocket,
  fetchEEGHistory,
  getMuseHealth,
  startMuseReader,
  stopMuseReader
} from '$lib/services/apiEEG';

const MAX_SAMPLES = 360;
const HEALTH_POLL_MS = 4000;

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

let buffer: EEGSample[] = [];
let connection: { close: () => void } | null = null;
let healthTimer: ReturnType<typeof setInterval> | null = null;
let startToken = 0;
let lastLiveSampleAt = 0;

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function markBackendOk() {
  museBackendConnected.set(true);
  lastMusePing.set(Date.now());
  museError.set(null);
}

function markBackendProblem(text: string) {
  museBackendConnected.set(false);
  lastMusePing.set(Date.now());
  museError.set(text);
}

function stopTimers() {
  if (healthTimer) clearInterval(healthTimer);
  healthTimer = null;
}

function closeConnection() {
  connection?.close();
  connection = null;
  stopTimers();
}

function publish(sample?: EEGSample, patch: Partial<EEGState> = {}) {
  eegState.update((state) => ({
    ...state,
    ...patch,
    enabled: true,
    deviceName: 'Muse 2 API',
    samples: [...buffer],
    lastSampleTimestamp: sample?.timestamp ?? state.lastSampleTimestamp,
    sampleRate: sample?.sampleRate ?? state.sampleRate
  }));
}

function appendSample(sample: EEGSample) {
  lastLiveSampleAt = Date.now();
  buffer = [...buffer, sample].slice(-MAX_SAMPLES);
  publish(sample, { status: 'connected', error: null });
}

async function pollHealth(token: number) {
  try {
    const health = await getMuseHealth();
    if (token !== startToken) return;
    markBackendOk();
    const processError = health.process?.error;
    if (processError) museError.set(processError);
  } catch (error) {
    if (token !== startToken) return;
    // Do not mark the stream down if live websocket samples are still arriving.
    if (Date.now() - lastLiveSampleAt > HEALTH_POLL_MS * 2) {
      markBackendProblem(message(error));
    }
  }
}

function startHealthPolling(token: number) {
  stopTimers();
  void pollHealth(token);
  healthTimer = setInterval(() => void pollHealth(token), HEALTH_POLL_MS);
}

export async function startEEGMonitoring(options: { simulate?: boolean; address?: string; backend?: string } = {}) {
  stopEEGMonitoring(false);
  const token = startToken;
  buffer = [];
  lastLiveSampleAt = 0;

  eegState.set({
    ...initialState,
    enabled: true,
    status: 'connecting',
    deviceName: 'Muse 2 API'
  });

  museBackendConnected.set(false);
  museError.set(null);
  addLog('INFO', 'EEG', 'EEG monitoring starting');

  try {
    const response = await startMuseReader(options);
    if (token !== startToken) return;
    markBackendOk();
    startHealthPolling(token);
    addLog('INFO', 'EEG', 'Muse reader start requested', response);
  } catch (error) {
    if (token !== startToken) return;
    const text = message(error);
    markBackendProblem(text);
    eegState.update((state) => ({ ...state, status: 'error', error: `Muse API is not reachable: ${text}` }));
    return;
  }

  try {
    const history = await fetchEEGHistory(MAX_SAMPLES);
    if (token !== startToken) return;
    buffer = history.slice(-MAX_SAMPLES);
    if (buffer.length) publish(buffer[buffer.length - 1]);
    markBackendOk();
  } catch (error) {
    if (token !== startToken) return;
    addLog('WARN', 'EEG', 'Could not load EEG history', { message: message(error) });
    // History failure must not block the live websocket stream.
    buffer = [];
  }

  if (token !== startToken) return;

  connection = connectEEGWebSocket(
    (sample) => {
      if (token !== startToken) return;
      markBackendOk();
      appendSample(sample);
    },
    (status: EEGConnectionStatus) => {
      if (token !== startToken) return;
      if (status === 'connected') {
        markBackendOk();
        publish(undefined, { status: 'connected', error: null });
      } else if (status === 'reconnecting') {
        publish(undefined, { status: 'reconnecting', error: 'EEG websocket reconnecting' });
      } else if (status === 'disconnected') {
        publish(undefined, { status: 'disconnected' });
      } else if (status === 'error') {
        publish(undefined, { status: 'error', error: 'EEG websocket error' });
      } else {
        publish(undefined, { status });
      }
    },
    (text) => {
      if (token !== startToken) return;
      addLog('ERROR', 'EEG', text);
      publish(undefined, { error: text });
    }
  );
}

export function stopEEGMonitoring(logStop = true) {
  startToken += 1;
  closeConnection();
  buffer = [];
  lastLiveSampleAt = 0;
  eegState.set(initialState);
  museBackendConnected.set(false);
  museError.set(null);

  if (logStop) {
    addLog('INFO', 'EEG', 'EEG monitoring stopped');
    void stopMuseReader().catch((error) => {
      addLog('WARN', 'EEG', 'Could not stop Muse reader', { message: message(error) });
    });
  }
}

export async function reconnectEEG() {
  addLog('INFO', 'EEG', 'Manual EEG reconnect requested');
  stopEEGMonitoring(false);
  await startEEGMonitoring();
}
