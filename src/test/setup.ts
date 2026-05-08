import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/svelte';

afterEach(() => {
  cleanup();
});

class MockAudioNode {
  connect() {}
}

class MockOscillator extends MockAudioNode {
  type = 'sine';
  frequency = { value: 0 };
  onended: (() => void) | null = null;
  start() {}
  stop() {
    this.onended?.();
  }
}

class MockGain extends MockAudioNode {
  gain = {
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn()
  };
}

class MockAudioContext {
  currentTime = 0;
  destination = new MockAudioNode();
  createOscillator() {
    return new MockOscillator();
  }
  createGain() {
    return new MockGain();
  }
  close() {
    return Promise.resolve();
  }
}

vi.stubGlobal('AudioContext', MockAudioContext);
