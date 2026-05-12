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

/**
 * Muse backend availability.
 *
 * This means the Python Muse FastAPI backend responded to:
 * GET /api/health
 *
 * It does not mean that a physical Muse device is connected.
 */
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

/**
 * Public backend health check used by the app header.
 *
 * This checks only whether the Muse backend HTTP API is reachable.
 * It deliberately does not require the Muse reader process, WebSocket,
 * or physical Muse device to be connected.
 */
export async function refreshMuseHealth() {
  try {
    const health = await getMuseHealth();

    if (health.ok) {
      markBackendOk();
      return true;
    }

    markBackendProblem('Muse backend health check returned not ok');
    return false;
  } catch (error) {
    markBackendProblem(message(error));
    return false;
  }
}

/**
 * Monitoring health polling.
 *
 * This keeps the backend indicator fresh while EEG monitoring is active.
 * It also preserves stream state separately from backend state.
 */
async function pollHealth(token: number) {
  try {
    const health = await getMuseHealth();
    if (token !== startToken) return;

    if (health.ok) {
      markBackendOk();
    } else {
      markBackendProblem('Muse backend health check returned not ok');
    }

    const processError = health.process?.error;
    if (processError) museError.set(processError);
  } catch (error) {
    if (token !== startToken) return;

    markBackendProblem(message(error));

    if (Date.now() - lastLiveSampleAt > HEALTH_POLL_MS * 2) {
      eegState.update((state) => ({
        ...state,
        error: `Muse backend is not reachable: ${message(error)}`
      }));
    }
  }
}

function startHealthPolling(token: number) {
  stopTimers();
  void pollHealth(token);
  healthTimer = setInterval(() => void pollHealth(token), HEALTH_POLL_MS);
}

export async function startEEGMonitoring(
  options: { simulate?: boolean; address?: string; backend?: string } = {}
) {
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

    eegState.update((state) => ({
      ...state,
      status: 'error',
      error: `Muse API is not reachable: ${text}`
    }));

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

    addLog('WARN', 'EEG', 'Could not load EEG history', {
      message: message(error)
    });

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
        publish(undefined, {
          status: 'reconnecting',
          error: 'EEG websocket reconnecting'
        });
      } else if (status === 'disconnected') {
        publish(undefined, { status: 'disconnected' });
      } else if (status === 'error') {
        publish(undefined, {
          status: 'error',
          error: 'EEG websocket error'
        });
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

  /**
   * Do not set museBackendConnected to false here.
   *
   * Stopping EEG monitoring only stops the stream/reader.
   * The backend may still be online and should still show Online
   * in the header if GET /api/health succeeds.
   */
  museError.set(null);

  if (logStop) {
    addLog('INFO', 'EEG', 'EEG monitoring stopped');

    void stopMuseReader()
      .catch((error) => {
        addLog('WARN', 'EEG', 'Could not stop Muse reader', {
          message: message(error)
        });
      })
      .finally(() => {
        void refreshMuseHealth();
      });
  }
}

export async function reconnectEEG() {
  addLog('INFO', 'EEG', 'Manual EEG reconnect requested');
  stopEEGMonitoring(false);
  await startEEGMonitoring();
}