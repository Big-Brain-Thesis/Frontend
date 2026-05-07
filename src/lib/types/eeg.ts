export type EEGChannel = 'TP9' | 'AF7' | 'AF8' | 'TP10';

export type EEGBand = 'theta' | 'alpha' | 'beta';

export type EEGFocusLabel = 'low' | 'steady' | 'high';

export type EEGMetrics = {
  focusScore: number;
  focusLabel: EEGFocusLabel;
  focusConfidence: number;
  signalQuality: number;
  artifactScore: number;
  frontalBeta: number;
  frontalAlpha: number;
  frontalTheta: number;
  engagementRatio: number;
};

export type EEGSample = {
  timestamp: number;
  channels: Record<EEGChannel, number>;
  smoothedChannels?: Record<EEGChannel, number> | null;
  bandPowers?: Record<EEGChannel, Record<EEGBand, number>> | null;
  metrics?: EEGMetrics | null;
  focusScore?: number;
  sampleRate?: number;
  sourceSampleRate?: number | null;
  lslTimestamp?: number | null;
  sequence?: number | null;
  deviceId?: string | null;
  source?: string | null;
  absMax?: number | null;
  debug?: unknown;
};

export type EEGConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error'
  | 'reconnecting';

export type EEGState = {
  enabled: boolean;
  status: EEGConnectionStatus;
  deviceName: string | null;
  sampleRate: number | null;
  lastSampleTimestamp: number | null;
  error: string | null;
  samples: EEGSample[];
};
