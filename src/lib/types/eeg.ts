export type EEGChannel = 'AF7' | 'AF8' | 'TP9' | 'TP10';

export type EEGSample = {
  timestamp: number;
  channels: Record<EEGChannel, number>;
  focusScore?: number;
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
