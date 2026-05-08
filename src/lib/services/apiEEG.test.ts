import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  connectEEGWebSocket,
  fetchEEGHistory,
  getMuseHealth,
  startMuseReader,
  stopMuseReader
} from '$lib/services/apiEEG';

vi.mock('$lib/stores/logger', () => ({ addLog: vi.fn() }));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

class MockWebSocket {
  static instances: MockWebSocket[] = [];

  url: string;
  listeners: Record<string, Array<(event: any) => void>> = {};
  close = vi.fn((code = 1000, reason = '') => {
    this.emit('close', { code, reason });
  });

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  addEventListener(type: string, listener: (event: any) => void) {
    this.listeners[type] ??= [];
    this.listeners[type].push(listener);
  }

  emit(type: string, event: any = {}) {
    for (const listener of this.listeners[type] ?? []) listener(event);
  }

  receive(data: unknown) {
    this.emit('message', { data: JSON.stringify(data) });
  }
}

beforeEach(() => {
  MockWebSocket.instances = [];
});

describe('apiEEG service', () => {
  it('normalizes object-channel history frames without rounding raw values', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        frames: [
          {
            timestamp: 1000,
            sample_rate: 30,
            source_sample_rate: 256,
            sequence: 7,
            device_id: 'muse-1',
            channels: { TP9: 0.000012345, AF7: -1.234567, AF8: 2.5, TP10: -3.75 },
            metrics: { focusScore: 0.7, focusLabel: 'high', signalQuality: 0.9 }
          }
        ]
      })
    );

    vi.stubGlobal('fetch', fetchMock);

    const samples = await fetchEEGHistory(3);

    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/eeg/history?limit=3&n=3');
    expect(samples).toHaveLength(1);
    expect(samples[0].timestamp).toBe(1000 * 1000);
    expect(samples[0].sampleRate).toBe(30);
    expect(samples[0].sourceSampleRate).toBe(256);
    expect(samples[0].sequence).toBe(7);
    expect(samples[0].deviceId).toBe('muse-1');
    expect(samples[0].source).toBe('channels');
    expect(samples[0].channels.TP9).toBe(0.000012345);
    expect(samples[0].channels.AF7).toBe(-1.234567);
    expect(samples[0].metrics?.focusLabel).toBe('high');
  });

  it('normalizes legacy channels+powers frames', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          frames: [{ timestamp: 2000, channels: ['TP9', 'AF7', 'AF8', 'TP10'], powers: [1, 2, 3, 4] }]
        })
      )
    );

    const [sample] = await fetchEEGHistory();

    expect(sample.source).toBe('channels+powers');
    expect(sample.channels).toEqual({ TP9: 1, AF7: 2, AF8: 3, TP10: 4 });
  });

  it('falls back to beta band powers when raw channels are absent', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          frames: [
            {
              timestamp: 3000,
              band_powers: {
                TP9: { beta: 0.1 },
                AF7: { beta: 0.2 },
                AF8: { beta: 0.3 },
                TP10: { beta: 0.4 }
              }
            }
          ]
        })
      )
    );

    const [sample] = await fetchEEGHistory();

    expect(sample.source).toBe('band_powers.beta');
    expect(sample.channels).toEqual({ TP9: 0.1, AF7: 0.2, AF8: 0.3, TP10: 0.4 });
  });

  it('sends Muse process controls to the EEG API', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true, status: 'started' }));
    vi.stubGlobal('fetch', fetchMock);

    await startMuseReader({ simulate: true, address: 'AA:BB', backend: 'bleak' });
    await stopMuseReader();
    await getMuseHealth();

    const [startUrl, startInit] = fetchMock.mock.calls[0];
    expect(String(startUrl)).toContain('/api/process/start');
    expect(startInit.method).toBe('POST');
    expect(JSON.parse(startInit.body as string)).toEqual({
      address: 'AA:BB',
      no_stream: false,
      simulate: true,
      backend: 'bleak'
    });
    expect(String(fetchMock.mock.calls[1][0])).toContain('/api/process/stop');
    expect(String(fetchMock.mock.calls[2][0])).toContain('/api/health');
  });

  it('connects the EEG websocket and normalizes live frames', () => {
    vi.stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket);

    const statuses: string[] = [];
    const samples: any[] = [];
    const errors: string[] = [];

    const connection = connectEEGWebSocket(
      (sample) => samples.push(sample),
      (status) => statuses.push(status),
      (error) => errors.push(error)
    );

    const socket = MockWebSocket.instances[0];
    socket.emit('open');
    socket.receive({ timestamp: 10, channels: [1, 2, 3, 4], sample_rate: 30, sequence: 1 });
    socket.receive({ ping: Date.now() });

    expect(statuses).toContain('connecting');
    expect(statuses).toContain('connected');
    expect(samples).toHaveLength(1);
    expect(samples[0].channels).toEqual({ TP9: 1, AF7: 2, AF8: 3, TP10: 4 });
    expect(samples[0].source).toBe('channels');
    expect(errors).toEqual([]);

    connection.close();
    expect(socket.close).toHaveBeenCalled();
    expect(statuses.at(-1)).toBe('disconnected');
  });
});
