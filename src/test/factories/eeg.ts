import type { EEGSample, EEGState } from '$lib/types/eeg';

export function eegSample(overrides: Partial<EEGSample> = {}): EEGSample {
  return {
    timestamp: Date.now(),
    channels: { TP9: 1, AF7: 2, AF8: -3, TP10: -4 },
    smoothedChannels: null,
    bandPowers: null,
    metrics: null,
    focusScore: undefined,
    sampleRate: 30,
    sourceSampleRate: 256,
    lslTimestamp: null,
    sequence: 1,
    deviceId: 'muse-test',
    source: 'channels',
    ...overrides
  };
}

export function eegStateFixture(overrides: Partial<EEGState> = {}): EEGState {
  return {
    enabled: true,
    status: 'connected',
    deviceName: 'Muse 2 API',
    sampleRate: 30,
    lastSampleTimestamp: Date.now(),
    error: null,
    samples: [eegSample()],
    ...overrides
  };
}
