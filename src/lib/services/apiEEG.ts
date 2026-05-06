import { addLog } from '$lib/stores/logger';
import type { EEGChannel, EEGSample } from '$lib/types/eeg';

type ApiErrorResponse = {
  error?: string;
};

type BetaFrame = {
  timestamp: number;
  channels: string[];
  powers: number[];
};

type EEGHistoryResponse = {
  frames: BetaFrame[];
  count: number;
};

function getEEGApiBase(): string {
  const envBase = (import.meta.env.PUBLIC_EEG_API_BASE as string | undefined)?.trim();
  if (envBase) {
    return envBase.replace(/\/$/, '');
  }

  if (typeof window === 'undefined') {
    return 'http://127.0.0.1:8000/';
  }

  return `http://${window.location.hostname}:8000`;
}

function getWebSocketUrl(): string {
  const base = getEEGApiBase();
  const url = new URL(base);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/ws/eeg';
  return url.toString();
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method ?? 'GET';
  const url = `${getEEGApiBase()}${path}`;

  addLog('DEBUG', 'EEG', `${method} ${path}`, { url });

  let response: Response;

  try {
    response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {})
      },
      ...init
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    addLog('ERROR', 'EEG', `${method} ${path} failed`, { message, url });
    throw new Error(message);
  }

  if (!response.ok) {
    let errorMessage = `Request failed with ${response.status}`;

    try {
      const data = (await response.json()) as ApiErrorResponse;
      if (data?.error) {
        errorMessage = data.error;
      }
    } catch {
      try {
        const text = await response.text();
        if (text) {
          errorMessage = text;
        }
      } catch {
        // ignore
      }
    }

    addLog('WARN', 'EEG', `${method} ${path} -> ${response.status}`, {
      status: response.status,
      error: errorMessage,
      url
    });

    throw new Error(errorMessage);
  }

  const data = (await response.json()) as T;

  addLog('DEBUG', 'EEG', `${method} ${path} -> ${response.status}`, {
    status: response.status,
    url
  });

  return data;
}

function buildChannelRecord(channels: string[], powers: number[]): Record<EEGChannel, number> {
  const record: Record<EEGChannel, number> = {
    AF7: 0,
    AF8: 0,
    TP9: 0,
    TP10: 0
  };

  channels.forEach((channel, index) => {
    const power = powers[index] ?? 0;
    if (channel in record) {
      record[channel as EEGChannel] = Number(power.toFixed(4));
    }
  });

  return record;
}

function normalizeEEGFrame(frame: BetaFrame): EEGSample {
  const timestamp = frame.timestamp > 1e12 ? frame.timestamp : frame.timestamp * 1000;
  const channels = buildChannelRecord(frame.channels, frame.powers);
  const focusScore = Number(((channels.AF7 + channels.AF8) / 2).toFixed(3));

  return {
    timestamp,
    channels,
    focusScore
  };
}

export async function fetchEEGHistory(n = 150): Promise<EEGSample[]> {
  const response = await request<EEGHistoryResponse>(`/api/eeg/history?n=${encodeURIComponent(String(n))}`);
  return response.frames.map(normalizeEEGFrame);
}

export function connectEEGWebSocket(
  onSample: (sample: EEGSample) => void,
  onStatusChange?: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void,
  onError?: (message: string) => void
) {
  const url = getWebSocketUrl();
  addLog('DEBUG', 'EEG', 'Opening EEG websocket', { url });
  onStatusChange?.('connecting');

  const ws = new WebSocket(url);
  let closed = false;

  const cleanup = () => {
    if (closed) return;
    closed = true;
    try {
      ws.close();
    } catch {
      // ignore
    }
  };

  ws.addEventListener('open', () => {
    addLog('INFO', 'EEG', 'EEG websocket connected', { url });
    onStatusChange?.('connected');
  });

  ws.addEventListener('message', (event) => {
    try {
      const data = JSON.parse(event.data) as Record<string, unknown>;
      if (data?.ping) {
        return;
      }

      const frame = data as BetaFrame;
      const sample = normalizeEEGFrame(frame);
      onSample(sample);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      addLog('ERROR', 'EEG', 'Failed to parse EEG websocket message', { message, url });
      onError?.(`Invalid EEG websocket message: ${message}`);
    }
  });

  ws.addEventListener('close', () => {
    addLog('WARN', 'EEG', 'EEG websocket disconnected', { url });
    onStatusChange?.('disconnected');
  });

  ws.addEventListener('error', () => {
    addLog('ERROR', 'EEG', 'EEG websocket error', { url });
    onError?.('EEG websocket connection failed');
    onStatusChange?.('error');
  });

  return {
    close: cleanup
  };
}
