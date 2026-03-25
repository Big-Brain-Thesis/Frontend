import { writable } from 'svelte/store';
import type { LogCategory, LogEntry, LogLevel } from '$lib/types/logs';

const MAX_LOGS = 500;

export const logs = writable<LogEntry[]>([]);

export function addLog(level: LogLevel, category: LogCategory, message: string, data?: unknown) {
  const entry: LogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    level,
    category,
    message,
    data
  };

  logs.update((items) => [...items.slice(-(MAX_LOGS - 1)), entry]);
}

export function clearLogs() {
  logs.set([]);
}
