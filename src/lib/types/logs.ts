export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
export type LogCategory = 'GAME' | 'API' | 'EEG' | 'SYSTEM' | 'MOVE' | 'SESSION';

export type LogEntry = {
  id: string;
  timestamp: number;
  level: LogLevel;
  category: LogCategory;
  message: string;
  data?: unknown;
};
