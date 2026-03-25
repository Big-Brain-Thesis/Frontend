import type { EEGConnectionStatus, EEGSample } from '$lib/types/eeg';

export class MockEEGStream {
  private interval: number | null = null;
  private listeners = new Set<(sample: EEGSample) => void>();
  private statusListeners = new Set<(status: EEGConnectionStatus) => void>();
  private currentStatus: EEGConnectionStatus = 'disconnected';

  async connect(): Promise<void> {
    this.setStatus('connecting');
    await new Promise((resolve) => setTimeout(resolve, 1200));
    this.setStatus('connected');
    this.startStreaming();
  }

  disconnect(): void {
    this.stopStreaming();
    this.setStatus('disconnected');
  }

  onSample(callback: (sample: EEGSample) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  onStatusChange(callback: (status: EEGConnectionStatus) => void): () => void {
    this.statusListeners.add(callback);
    callback(this.currentStatus);
    return () => this.statusListeners.delete(callback);
  }

  private setStatus(status: EEGConnectionStatus): void {
    this.currentStatus = status;
    this.statusListeners.forEach((listener) => listener(status));
  }

  private startStreaming(): void {
    if (this.interval !== null) return;

    this.interval = window.setInterval(() => {
      const sample = this.generateSample();
      this.listeners.forEach((listener) => listener(sample));
    }, 10);
  }

  private stopStreaming(): void {
    if (this.interval !== null) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private generateSample(): EEGSample {
    const time = Date.now() / 1000;
    const focusBase = 0.5 + 0.3 * Math.sin(time / 10);
    const AF7 = focusBase + 0.15 * Math.sin(time * 8.5) + 0.05 * Math.random();
    const AF8 = focusBase + 0.15 * Math.sin(time * 9.2) + 0.05 * Math.random();
    const TP9 = 0.3 + 0.1 * Math.sin(time * 7.1) + 0.03 * Math.random();
    const TP10 = 0.3 + 0.1 * Math.sin(time * 6.8) + 0.03 * Math.random();
    const focusScore = Math.max(0, Math.min(1, (AF7 + AF8) / 2));

    return {
      timestamp: Date.now(),
      channels: {
        AF7: Number(AF7.toFixed(4)),
        AF8: Number(AF8.toFixed(4)),
        TP9: Number(TP9.toFixed(4)),
        TP10: Number(TP10.toFixed(4))
      },
      focusScore: Number(focusScore.toFixed(3))
    };
  }
}

export const mockEEGStream = new MockEEGStream();
