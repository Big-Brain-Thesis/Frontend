import { expect, test } from '@playwright/test';

const gameState = {
  sessionId: 'session-e2e',
  mode: '2-player',
  difficulty: 'human-vs-dionysus',
  status: 'in-progress',
  currentPlayer: 1,
  players: [
    { id: 1, color: 'blue', position: { col: 'e', row: 1 }, wallsRemaining: 10, isAI: false },
    { id: 2, color: 'red', position: { col: 'e', row: 9 }, wallsRemaining: 10, isAI: true }
  ],
  walls: [],
  moveHistory: [],
  winner: null,
  legalMoves: ['e2', 'd1', 'f1'],
  legalWalls: ['e2h', 'e2v'],
  boardSize: 9,
  definedPosition: ' /  / e1 e9 / 10 10 / 1'
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    class MockWebSocket {
      url: string;
      readyState = 1;
      listeners: Record<string, Array<(event: any) => void>> = {};
      onopen: ((event: any) => void) | null = null;
      onmessage: ((event: any) => void) | null = null;
      onclose: ((event: any) => void) | null = null;
      onerror: ((event: any) => void) | null = null;

      constructor(url: string) {
        this.url = url;
        setTimeout(() => this.emit('open', {}), 10);
        setTimeout(() => this.emit('message', { data: JSON.stringify({ timestamp: Date.now() / 1000, sample_rate: 30, sequence: 1, channels: { TP9: 1, AF7: 2, AF8: -3, TP10: -4 } }) }), 50);
        setTimeout(() => this.emit('message', { data: JSON.stringify({ timestamp: Date.now() / 1000, sample_rate: 30, sequence: 2, channels: { TP9: 2, AF7: 4, AF8: -2, TP10: -5 } }) }), 100);
      }

      addEventListener(type: string, listener: (event: any) => void) {
        this.listeners[type] ??= [];
        this.listeners[type].push(listener);
      }

      removeEventListener(type: string, listener: (event: any) => void) {
        this.listeners[type] = (this.listeners[type] ?? []).filter((item) => item !== listener);
      }

      send() {}

      close(code = 1000, reason = '') {
        this.readyState = 3;
        this.emit('close', { code, reason });
      }

      emit(type: string, event: any) {
        if (type === 'open') this.onopen?.(event);
        if (type === 'message') this.onmessage?.(event);
        if (type === 'close') this.onclose?.(event);
        if (type === 'error') this.onerror?.(event);
        for (const listener of this.listeners[type] ?? []) listener(event);
      }
    }

    Object.defineProperty(window, 'WebSocket', { value: MockWebSocket, writable: true });
  });

  await page.route('**/api/health', async (route) => {
    await route.fulfill({ json: { ok: true, eeg: { frames: 2, clients: 1 }, process: { running: true } } });
  });

  await page.route('**/api/saves', async (route) => {
    await route.fulfill({ json: [] });
  });

  await page.route('**/api/eeg/history**', async (route) => {
    await route.fulfill({
      json: {
        frames: [
          { timestamp: Date.now() / 1000, sample_rate: 30, sequence: 0, channels: { TP9: 0.5, AF7: 1.5, AF8: -2.5, TP10: -3.5 } }
        ]
      }
    });
  });

  await page.route('**/api/process/start', async (route) => {
    await route.fulfill({ json: { ok: true, status: 'started', process: { running: true } } });
  });

  await page.route('**/api/process/stop', async (route) => {
    await route.fulfill({ json: { ok: true, status: 'stopped', process: { running: false } } });
  });

  await page.route('**/api/game/start', async (route) => {
    await route.fulfill({ json: gameState });
  });

  await page.route('**/api/game/session-e2e**', async (route) => {
    await route.fulfill({ json: gameState });
  });
});

test('page loads and EEG toggle starts the Muse API connection', async ({ page }) => {
  let museStartRequests = 0;

  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/api/process/start')) {
      museStartRequests += 1;
    }
  });

  await page.goto('/');
  await page.waitForResponse((response) => response.url().includes('/api/health') && response.status() === 200);

  const eegToggle = page.getByLabel(/monitor eeg/i);
  await expect(eegToggle).toBeVisible();
  await expect(eegToggle).toBeEnabled();

  await eegToggle.check();
  await expect(eegToggle).toBeChecked();

  await expect.poll(() => museStartRequests, { timeout: 8000 }).toBeGreaterThan(0);
});

test('new game button calls the game backend and leaves the app usable', async ({ page }) => {
  let startGameRequests = 0;

  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/api/game/start')) {
      startGameRequests += 1;
    }
  });

  await page.goto('/');
  await page.waitForResponse((response) => response.url().includes('/api/health') && response.status() === 200);

  const newGame = page.getByRole('button', { name: /new game/i });
  await expect(newGame).toBeVisible();
  await expect(newGame).toBeEnabled();

  await newGame.click();

  await expect.poll(() => startGameRequests, { timeout: 8000 }).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: /new game/i })).toBeVisible();
});
