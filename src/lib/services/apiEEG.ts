import { addLog } from '$lib/stores/logger';
import type {
  EEGBand,
  EEGChannel,
  EEGConnectionStatus,
  EEGMetrics,
  EEGSample
} from '$lib/types/eeg';

type ApiErrorResponse = { error?: string; detail?: string };
type ChannelRecord = Partial<Record<EEGChannel, unknown>>;
type BandPowerRecord = Partial<Record<EEGChannel, Partial<Record<EEGBand, unknown>>>>;

type EEGApiFrame = {
  type?: string;
  timestamp?: unknown;
  server_received_at?: unknown;
  sample_rate?: unknown;
  source_sample_rate?: unknown;
  lsl_timestamp?: unknown;
  sequence?: unknown;
  device_id?: unknown;
  channels?: ChannelRecord | unknown[];
  raw_channels?: ChannelRecord | unknown[];
  powers?: unknown[];
  smoothed_channels?: ChannelRecord | unknown[] | null;
  band_powers?: BandPowerRecord | null;
  metrics?: Partial<Record<keyof EEGMetrics, unknown>> | null;
  source?: unknown;
  abs_max?: unknown;
  debug?: unknown;
};

type EEGHistoryResponse = { frames?: EEGApiFrame[]; count?: number; max_history?: number };

type MuseHealthResponse = {
  ok?: boolean;
  frames?: number;
  clients?: number;
  time?: number;
  process?: {
    status?: string;
    running?: boolean;
    pid?: number | null;
    returncode?: number | null;
    error?: string | null;
    last_log?: string | null;
  };
  eeg?: {
    frames?: number;
    clients?: number;
    last_frame_at?: number | null;
    seconds_since_last_frame?: number | null;
  };
};

type MuseProcessResponse = {
  ok?: boolean;
  status?: string;
  pid?: number;
  process?: {
    status?: string;
    running?: boolean;
    error?: string | null;
    last_log?: string | null;
  };
};

const CHANNELS: EEGChannel[] = ['TP9', 'AF7', 'AF8', 'TP10'];
const BANDS: EEGBand[] = ['theta', 'alpha', 'beta'];
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_RETRIES = 2;
const WS_BASE_DELAY_MS = 400;
const WS_MAX_DELAY_MS = 8000;
const WS_STALE_MS = 15000;

function cleanBase(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function env(name: string): string {
  return String(import.meta.env[name] ?? '').trim();
}

function getEEGApiBase(): string {
  const explicit = env('PUBLIC_EEG_API_BASE');
  if (explicit) return cleanBase(explicit);
  if (typeof window === 'undefined') return 'http://127.0.0.1:8000';
  return `http://${window.location.hostname || '127.0.0.1'}:8000`;
}

function getWebSocketUrl(): string {
  const explicit = env('PUBLIC_EEG_WS_URL');
  if (explicit) return explicit;
  const url = new URL(getEEGApiBase());
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/ws/eeg';
  url.search = '';
  url.hash = '';
  return url.toString();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function finiteNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function optionalNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clamp01(value: unknown): number {
  return Math.max(0, Math.min(1, finiteNumber(value, 0)));
}

function normalizeTimestamp(value: unknown): number {
  const ts = finiteNumber(value, Date.now());
  return ts > 1e12 ? ts : ts * 1000;
}

function isAbort(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: string }).name === 'AbortError';
}

function shouldRetry(method: string, status: number): boolean {
  return ['GET', 'HEAD', 'OPTIONS'].includes(method) && (status === 408 || status === 429 || status >= 500);
}

function buildHeaders(init?: RequestInit): Headers {
  const headers = new Headers(init?.headers);
  headers.set('Accept', 'application/json');
  if (init?.body !== undefined && init.body !== null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return headers;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function parseError(response: Response): Promise<string> {
  const fallback = `Request failed with ${response.status}`;
  const text = await response.text().catch(() => '');
  if (!text) return fallback;
  try {
    const data = JSON.parse(text) as ApiErrorResponse;
    return data.detail || data.error || text;
  } catch {
    return text;
  }
}

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase();
  const timeoutMs = Number(env('PUBLIC_EEG_API_TIMEOUT_MS') || DEFAULT_TIMEOUT_MS);
  const retries = ['GET', 'HEAD', 'OPTIONS'].includes(method)
    ? Number(env('PUBLIC_EEG_API_RETRIES') || DEFAULT_RETRIES)
    : 0;
  const url = `${getEEGApiBase()}${path}`;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetchWithTimeout(
        url,
        { ...init, method, headers: buildHeaders(init) },
        timeoutMs
      );

      if (!response.ok) {
        const message = await parseError(response);
        if (attempt < retries && shouldRetry(method, response.status)) {
          addLog('WARN', 'EEG', `${method} ${path} retrying`, { status: response.status, message });
          await delay(250 * 2 ** attempt);
          continue;
        }
        throw new Error(message);
      }

      return await parseJson<T>(response);
    } catch (error) {
      const message = isAbort(error)
        ? `Request timed out after ${timeoutMs}ms`
        : error instanceof Error
          ? error.message
          : String(error);

      if (attempt < retries) {
        addLog('WARN', 'EEG', `${method} ${path} retrying`, { attempt: attempt + 1, retries, message });
        await delay(250 * 2 ** attempt);
        continue;
      }

      addLog('ERROR', 'EEG', `${method} ${path} failed`, { url, message });
      throw new Error(message);
    }
  }

  throw new Error('Request failed');
}

function fromNumericArray(values: unknown[]): Record<EEGChannel, number> | null {
  if (values.length < 4) return null;
  return {
    TP9: finiteNumber(values[0]),
    AF7: finiteNumber(values[1]),
    AF8: finiteNumber(values[2]),
    TP10: finiteNumber(values[3])
  };
}

function fromNamedPowers(names: unknown[], powers?: unknown[]): Record<EEGChannel, number> | null {
  if (!powers) return null;
  const record: Record<EEGChannel, number> = { TP9: 0, AF7: 0, AF8: 0, TP10: 0 };
  let matched = 0;
  names.forEach((name, index) => {
    if (CHANNELS.includes(name as EEGChannel)) {
      record[name as EEGChannel] = finiteNumber(powers[index]);
      matched += 1;
    }
  });
  return matched ? record : null;
}

function fromObject(value: object): Record<EEGChannel, number> | null {
  const source = value as ChannelRecord;
  const hasAny = CHANNELS.some((channel) => source[channel] !== undefined && source[channel] !== null);
  if (!hasAny) return null;
  return {
    TP9: finiteNumber(source.TP9),
    AF7: finiteNumber(source.AF7),
    AF8: finiteNumber(source.AF8),
    TP10: finiteNumber(source.TP10)
  };
}

function fromBandPowers(value: EEGApiFrame['band_powers']): Record<EEGChannel, number> | null {
  if (!value || typeof value !== 'object') return null;
  const hasAny = CHANNELS.some((channel) => value[channel]?.beta !== undefined);
  if (!hasAny) return null;
  return {
    TP9: finiteNumber(value.TP9?.beta),
    AF7: finiteNumber(value.AF7?.beta),
    AF8: finiteNumber(value.AF8?.beta),
    TP10: finiteNumber(value.TP10?.beta)
  };
}

function normalizeChannels(frame: EEGApiFrame): { channels: Record<EEGChannel, number>; source: string } {
  const candidates: Array<[unknown, string]> = [
    [frame.channels, 'channels'],
    [frame.raw_channels, 'raw_channels']
  ];

  for (const [candidate, source] of candidates) {
    if (Array.isArray(candidate)) {
      const named = candidate.every((item) => typeof item === 'string')
        ? fromNamedPowers(candidate, frame.powers)
        : null;
      const numeric = candidate.every((item) => Number.isFinite(Number(item)))
        ? fromNumericArray(candidate)
        : null;
      if (named) return { channels: named, source: `${source}+powers` };
      if (numeric) return { channels: numeric, source };
    } else if (candidate && typeof candidate === 'object') {
      const objectRecord = fromObject(candidate);
      if (objectRecord) return { channels: objectRecord, source };
    }
  }

  if (Array.isArray(frame.powers)) {
    const powers = fromNumericArray(frame.powers);
    if (powers) return { channels: powers, source: 'powers' };
  }

  const beta = fromBandPowers(frame.band_powers);
  if (beta) return { channels: beta, source: 'band_powers.beta' };

  throw new Error('EEG frame has no usable channel values');
}

function normalizeOptionalChannels(value: EEGApiFrame['smoothed_channels']): Record<EEGChannel, number> | null {
  if (Array.isArray(value)) return fromNumericArray(value);
  if (value && typeof value === 'object') return fromObject(value);
  return null;
}

function normalizeBandPowers(value: EEGApiFrame['band_powers']): EEGSample['bandPowers'] {
  if (!value || typeof value !== 'object') return null;
  const out = {} as Record<EEGChannel, Record<EEGBand, number>>;
  for (const channel of CHANNELS) {
    const source = value[channel] ?? {};
    out[channel] = {} as Record<EEGBand, number>;
    for (const band of BANDS) out[channel][band] = finiteNumber(source[band]);
  }
  return out;
}

function normalizeMetrics(value: EEGApiFrame['metrics']): EEGMetrics | null {
  if (!value || typeof value !== 'object') return null;
  const focusScore = clamp01(value.focusScore);
  const focusLabel =
    value.focusLabel === 'low' || value.focusLabel === 'steady' || value.focusLabel === 'high'
      ? value.focusLabel
      : focusScore >= 0.66
        ? 'high'
        : focusScore >= 0.4
          ? 'steady'
          : 'low';

  return {
    focusScore,
    focusLabel,
    focusConfidence: clamp01(value.focusConfidence),
    signalQuality: clamp01(value.signalQuality),
    artifactScore: clamp01(value.artifactScore),
    frontalBeta: finiteNumber(value.frontalBeta),
    frontalAlpha: finiteNumber(value.frontalAlpha),
    frontalTheta: finiteNumber(value.frontalTheta),
    engagementRatio: finiteNumber(value.engagementRatio)
  };
}

function absMax(channels: Record<EEGChannel, number>): number {
  return Math.max(...CHANNELS.map((channel) => Math.abs(channels[channel])));
}

function normalizeEEGFrame(frame: EEGApiFrame): EEGSample {
  const normalized = normalizeChannels(frame);
  const smoothedChannels = normalizeOptionalChannels(frame.smoothed_channels);
  const metrics = normalizeMetrics(frame.metrics);

  return {
    timestamp: normalizeTimestamp(frame.timestamp ?? frame.server_received_at),
    channels: normalized.channels,
    smoothedChannels,
    bandPowers: normalizeBandPowers(frame.band_powers),
    metrics,
    focusScore: metrics?.focusScore,
    sampleRate: optionalNumber(frame.sample_rate) ?? optionalNumber(frame.source_sample_rate) ?? undefined,
    sourceSampleRate: optionalNumber(frame.source_sample_rate),
    lslTimestamp: optionalNumber(frame.lsl_timestamp),
    sequence: optionalNumber(frame.sequence),
    deviceId: typeof frame.device_id === 'string' ? frame.device_id : null,
    source: typeof frame.source === 'string' ? frame.source : normalized.source,
    absMax: optionalNumber(frame.abs_max) ?? absMax(normalized.channels),
    debug: frame.debug
  };
}

export async function fetchEEGHistory(limit = 240): Promise<EEGSample[]> {
  const n = encodeURIComponent(String(limit));
  const response = await request<EEGHistoryResponse>(`/api/eeg/history?limit=${n}&n=${n}`);
  return (response.frames ?? []).map(normalizeEEGFrame);
}

export async function getMuseHealth(): Promise<MuseHealthResponse> {
  return request<MuseHealthResponse>('/api/health');
}

export async function startMuseReader(
  options: { address?: string; noStream?: boolean; simulate?: boolean; backend?: string } = {}
): Promise<MuseProcessResponse> {
  return request<MuseProcessResponse>('/api/process/start', {
    method: 'POST',
    body: JSON.stringify({
      address: options.address ?? null,
      no_stream: options.noStream ?? false,
      simulate: options.simulate ?? false,
      backend: options.backend ?? 'bleak'
    })
  });
}

export async function stopMuseReader(): Promise<MuseProcessResponse> {
  return request<MuseProcessResponse>('/api/process/stop', { method: 'POST' });
}

export function connectEEGWebSocket(
  onSample: (sample: EEGSample) => void,
  onStatusChange?: (status: EEGConnectionStatus) => void,
  onError?: (message: string) => void
) {
  const url = getWebSocketUrl();
  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let staleTimer: ReturnType<typeof setInterval> | null = null;
  let closedByClient = false;
  let attempt = 0;
  let lastMessageAt = 0;

  function clearTimers() {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (staleTimer) clearInterval(staleTimer);
    reconnectTimer = null;
    staleTimer = null;
  }

  function scheduleReconnect(reason: string) {
    if (closedByClient) return;
    const delayMs = Math.min(WS_MAX_DELAY_MS, WS_BASE_DELAY_MS * 2 ** Math.min(attempt, 5));
    attempt += 1;
    onStatusChange?.('reconnecting');
    addLog('WARN', 'EEG', 'EEG websocket reconnecting', { reason, attempt, delayMs });
    clearTimers();
    reconnectTimer = setTimeout(open, delayMs);
  }

  function watchStale(socket: WebSocket) {
    if (staleTimer) clearInterval(staleTimer);
    staleTimer = setInterval(() => {
      if (closedByClient || ws !== socket) return;
      if (Date.now() - lastMessageAt > WS_STALE_MS) {
        addLog('WARN', 'EEG', 'EEG websocket stale; forcing reconnect', { url });
        try {
          socket.close(4000, 'stale websocket');
        } catch {
          scheduleReconnect('stale websocket');
        }
      }
    }, 3000);
  }

  function open() {
    if (closedByClient) return;
    if (ws) {
      try { ws.close(); } catch { /* ignore */ }
      ws = null;
    }

    onStatusChange?.(attempt === 0 ? 'connecting' : 'reconnecting');
    const socket = new WebSocket(url);
    ws = socket;
    lastMessageAt = Date.now();

    socket.addEventListener('open', () => {
      if (closedByClient || ws !== socket) return;
      attempt = 0;
      lastMessageAt = Date.now();
      onStatusChange?.('connected');
      watchStale(socket);
      addLog('INFO', 'EEG', 'EEG websocket connected', { url });
    });

    socket.addEventListener('message', (event) => {
      if (closedByClient || ws !== socket) return;
      lastMessageAt = Date.now();
      try {
        const data = JSON.parse(event.data) as EEGApiFrame & { ping?: unknown };
        if (data.ping) return;
        onSample(normalizeEEGFrame(data));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        onError?.(`Invalid EEG frame: ${message}`);
        addLog('ERROR', 'EEG', 'Invalid EEG websocket frame', { message, data: event.data });
      }
    });

    socket.addEventListener('close', (event) => {
      if (ws !== socket) return;
      ws = null;
      if (!closedByClient) scheduleReconnect(`closed ${event.code}${event.reason ? ` ${event.reason}` : ''}`);
    });

    socket.addEventListener('error', () => {
      if (ws !== socket) return;
      onError?.('EEG websocket error');
      try { socket.close(); } catch { /* ignore */ }
    });
  }

  open();

  return {
    close() {
      closedByClient = true;
      clearTimers();
      if (ws) {
        try { ws.close(1000, 'client closed'); } catch { /* ignore */ }
      }
      ws = null;
      onStatusChange?.('disconnected');
    }
  };
}
