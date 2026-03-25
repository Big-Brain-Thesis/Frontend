

## Purpose of this file

This file is the practical handoff for the next person who has to connect this frontend to:

1. a **real Muse EEG device / real EEG data source**, and
2. a **real backend API for the Quoridor game**.

This is not a generic explanation. It is a direct map of **what to modify in this specific SvelteKit project**, why each file matters, and how the data should move through the app.

---

# 1. Current state of the project

Before changing anything, understand the current architecture:

- the UI is SvelteKit and Svelte components,
- the state layer is in Svelte stores,
- the “backend” is currently fake and lives inside the frontend,
- the EEG stream is also fake and generated locally.

That means there are **two main mock layers** to replace:

- `src/lib/services/api.ts` for the game backend,
- `src/lib/services/mockEEG.ts` for EEG/Muse.

Everything else is mostly consuming those layers.

---

# 2. The exact connection points in the codebase

## Game backend connection path

Current flow:

`+page.svelte` -> `src/lib/stores/game.ts` -> `src/lib/services/api.ts` -> updates `gameState`

Relevant files:

- `src/routes/+page.svelte`
- `src/lib/stores/game.ts`
- `src/lib/services/api.ts`
- `src/lib/types/game.ts`
- `src/lib/utils/notation.ts`
- `src/lib/components/board/QuoridorBoard.svelte`
- `src/lib/components/board/MoveHistory.svelte`
- `src/lib/components/session/StatusPanel.svelte`
- `src/lib/components/session/AdvancedPanel.svelte`
- `src/lib/components/session/NotationInput.svelte`

## EEG / Muse connection path

Current flow:

`+page.svelte` -> `src/lib/stores/eeg.ts` -> `src/lib/services/mockEEG.ts` -> updates `eegState`

Relevant files:

- `src/routes/+page.svelte`
- `src/lib/stores/eeg.ts`
- `src/lib/services/mockEEG.ts`
- `src/lib/types/eeg.ts`
- `src/lib/components/eeg/EEGPanel.svelte`
- `src/lib/components/eeg/EEGGraph.svelte`

---

# 3. What to modify for Muse integration

## 3.1 What is wrong right now

Right now the app does not connect to a real Muse device.

It uses this file:

- `src/lib/services/mockEEG.ts`

That file does all of the following locally:

- pretends to connect,
- pretends to disconnect,
- emits fake status events,
- emits fake EEG samples every interval,
- computes a fake focus score.

For real Muse support, this file must stop being a simulator and become a **device adapter**.

---

## 3.2 Main rule for the Muse rewrite

Do **not** push Muse connection logic directly into components.

Keep the same layering:

- components render state,
- `eeg.ts` store manages lifecycle,
- a service class handles the real device connection,
- `types/eeg.ts` defines the shared data contract.

That means the correct replacement target is:

- replace `src/lib/services/mockEEG.ts`

and keep the rest of the app consuming a stable interface.

---

## 3.3 Recommended file changes for Muse

## A. Replace `src/lib/services/mockEEG.ts`

Current responsibility:

- fake connection state
- fake samples
- fake event listeners

New responsibility:

- connect to a real Muse stream
- read raw EEG packets from the device or transport
- normalize the packets to this app’s EEG shape
- expose status changes and samples through callbacks
- disconnect cleanly

### Target structure

Keep the same external interface shape if possible:

```ts
class MuseEEGStream {
  async connect(): Promise<void>
  disconnect(): void
  onSample(callback: (sample: EEGSample) => void): () => void
  onStatusChange(callback: (status: EEGConnectionStatus) => void): () => void
}
```

This is the easiest path because `src/lib/stores/eeg.ts` is already written around that pattern.

### What the new service must do

The real service should handle:

- browser/device permission request,
- transport setup,
- stream subscription,
- packet parsing,
- per-sample timestamping,
- device metadata capture,
- reconnect handling,
- disconnect cleanup.

### Important frontend constraint

A real device integration is **client-only**. Do not run device code during SSR.

Guard browser-only code with one of these patterns:

- import only in the browser,
- instantiate the device inside `onMount`,
- check `browser` from `$app/environment` before using device APIs.

The current mock service does not care about SSR. A real device service must.

---

## B. Modify `src/lib/stores/eeg.ts`

Current responsibility:

- starts and stops monitoring,
- subscribes to mock samples,
- stores sample history,
- updates connection state,
- logs EEG events.

This file is already the right orchestration layer. It does not need a total rewrite, but it **does need structural upgrades** for real data.

### What to modify here

#### 1. Replace the mock import

Current:

```ts
import { mockEEGStream } from '$lib/services/mockEEG';
```

Replace with something like:

```ts
import { museEEGStream } from '$lib/services/museEEG';
```

or keep the file name but replace the implementation.

#### 2. Expand state fields

The current `EEGState` is minimal:

- `enabled`
- `status`
- `deviceName`
- `sampleRate`
- `lastSampleTimestamp`
- `error`
- `samples`

For real Muse, consider adding:

- `batteryLevel`
- `firmwareVersion`
- `connectionQuality`
- `packetLoss`
- `channelNames`
- `recordingStartedAt`
- `sessionSampleCount`

That means updating:

- `src/lib/types/eeg.ts`
- `src/lib/stores/eeg.ts`
- maybe `src/lib/components/eeg/EEGPanel.svelte`

#### 3. Improve buffering strategy

Right now:

- the store keeps a local `samples` array,
- trims to `MAX_SAMPLES`,
- pushes updates into the store every second sample.

That is acceptable for mock data but real EEG may be much higher frequency.

Possible changes:

- batch updates every 50–100 ms instead of every sample,
- downsample for the graph,
- keep a full raw buffer separate from the graph buffer,
- avoid rewriting giant arrays too often.

A common structure is:

- `rawSamples` for analysis/export,
- `displaySamples` for the graph,
- `latestSample` for live metrics.

#### 4. Add parsing/normalization step

Do not let raw vendor packets leak into components.

The store should receive normalized `EEGSample` objects only.

That means vendor-specific parsing belongs in the service, not the graph component.

---

## C. Modify `src/lib/types/eeg.ts`

This file defines the app’s EEG contract.

Current model:

```ts
export type EEGChannel = 'AF7' | 'AF8' | 'TP9' | 'TP10';

export type EEGSample = {
  timestamp: number;
  channels: Record<EEGChannel, number>;
  focusScore?: number;
};
```

This is usable, but real Muse integration often needs more metadata.

### Recommended changes

Add optional fields such as:

```ts
export type EEGSample = {
  timestamp: number;
  channels: Record<EEGChannel, number>;
  focusScore?: number;
  signalQuality?: number;
  dropped?: boolean;
  sequence?: number;
};

export type EEGState = {
  enabled: boolean;
  status: EEGConnectionStatus;
  deviceName: string | null;
  sampleRate: number | null;
  lastSampleTimestamp: number | null;
  error: string | null;
  samples: EEGSample[];
  batteryLevel?: number | null;
  connectionQuality?: number | null;
};
```

### Why this matters

Without this, the app can show a waveform but cannot properly represent:

- unstable connections,
- battery state,
- missing packets,
- noisy data,
- metadata needed for export or later analysis.

---

## D. Modify `src/lib/components/eeg/EEGPanel.svelte`

Current role:

- shows connection status,
- shows device name,
- shows sample rate,
- shows latest channel values,
- shows focus score,
- shows reconnect button on error,
- renders the graph.

### What to change for real Muse

If the real stream exposes more metadata, display it here.

Examples:

- battery,
- signal quality,
- whether the device is actually streaming,
- whether the electrodes are stable,
- whether focus score is raw, filtered, or derived.

Possible additions:

- “recording” badge,
- battery indicator,
- packet loss warning,
- per-channel quality state,
- stream rate mismatch warning.

This file is presentation only. Do not insert device protocol logic here.

---

## E. Modify `src/lib/components/eeg/EEGGraph.svelte`

Current role:

- receives `samples`,
- slices visible data,
- renders four channel traces using SVG.

### What to change for real Muse

#### 1. Support larger/real sample frequency

The graph may need:

- downsampling,
- a rolling time window,
- more efficient path generation,
- optional channel toggle visibility.

#### 2. Handle non-normalized raw ranges

The current graph assumes values can be clamped between `0` and `1`.
That is a mock-data assumption.

Real signals may need:

- scaling,
- normalization,
- filtering,
- baseline correction,
- separate y-axis rules.

#### 3. Add a preprocessing stage

Do not do heavy signal processing inside the markup.

Create helper functions such as:

- `normalizeSamplesForDisplay(...)`
- `downsampleSamples(...)`
- `computeDisplayRange(...)`

You can place them:

- inside the component if very small,
- or better in a new file like `src/lib/utils/eeg.ts`.

---

## F. Modify `src/routes/+page.svelte`

Current role:

- toggles EEG on and off,
- renders `EEGPanel` when enabled.

### What to change

This file usually needs only small changes:

- optional connect button labeling,
- optional permission prompt text,
- maybe device selection UX,
- maybe a separate “Connect Muse” vs “Enable EEG” control.

If the real connection has multiple steps, move that detail into `SessionControls.svelte` or a dedicated EEG control component rather than bloating `+page.svelte`.

---

## 3.4 Add a real Muse service file

Recommended new file:

- `src/lib/services/museEEG.ts`

This keeps the mock available for fallback/testing and avoids mixing fake and real logic in one file.

### Good structure for `museEEG.ts`

```ts
import type { EEGConnectionStatus, EEGSample } from '$lib/types/eeg';

export class MuseEEGStream {
  private listeners = new Set<(sample: EEGSample) => void>();
  private statusListeners = new Set<(status: EEGConnectionStatus) => void>();

  async connect(): Promise<void> {
    // browser-only connection code
    // device discovery
    // subscribe to stream
    // map packets to EEGSample
  }

  disconnect(): void {
    // unsubscribe and clean up
  }

  onSample(callback: (sample: EEGSample) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  onStatusChange(callback: (status: EEGConnectionStatus) => void): () => void {
    this.statusListeners.add(callback);
    return () => this.statusListeners.delete(callback);
  }
}

export const museEEGStream = new MuseEEGStream();
```

The internal vendor code can change later. The rest of the app stays stable if this interface stays stable.

---

## 3.5 Real EEG data normalization rule

The app should not care about vendor packet structure.

Everything should be converted into this internal object shape before it reaches the store:

```ts
{
  timestamp: Date.now(),
  channels: {
    AF7: number,
    AF8: number,
    TP9: number,
    TP10: number
  },
  focusScore?: number
}
```

### Why this matters

If the backend/device library changes later, the UI does not need a rewrite.
Only the adapter changes.

---

## 3.6 If focus score becomes real

Right now focus score is fake and generated in the mock service.

For a real integration, decide where focus score comes from:

### Option A. Compute it in the frontend

Modify or add:

- `src/lib/services/museEEG.ts`
- or create `src/lib/utils/eegMetrics.ts`

Use this if:

- you want local computation,
- the backend does not provide derived metrics,
- the metric is simple enough to run in-browser.

### Option B. Compute it in the backend

Then the frontend receives it already computed in the EEG payload.

In that case modify:

- `src/lib/types/eeg.ts` to match the backend payload,
- `src/lib/stores/eeg.ts` to store the backend-provided score,
- `EEGPanel.svelte` only for display.

### Better long-term rule

Raw data and derived metrics should be separate.

Example:

```ts
export type EEGSample = {
  timestamp: number;
  channels: Record<EEGChannel, number>;
};

export type EEGMetrics = {
  focusScore: number | null;
  calmScore?: number | null;
  engagementScore?: number | null;
};
```

Then `EEGState` can store both.

---

## 3.7 Minimum Muse checklist

Minimum files to touch:

- `src/lib/services/mockEEG.ts` or replace with `src/lib/services/museEEG.ts`
- `src/lib/stores/eeg.ts`
- `src/lib/types/eeg.ts`
- `src/lib/components/eeg/EEGPanel.svelte`
- `src/lib/components/eeg/EEGGraph.svelte`

Likely additional file to add:

- `src/lib/utils/eeg.ts` or `src/lib/utils/eegMetrics.ts`

---

# 4. What to modify for a real backend game API

## 4.1 What is wrong right now

The file pretending to be the backend is:

- `src/lib/services/api.ts`

That file currently does all of this **inside the frontend**:

- creates the initial game state,
- applies pawn moves,
- applies wall moves,
- checks legality,
- picks AI moves,
- simulates latency,
- resets the game.

This is not a real API client. It is an in-browser mock engine.

For a real backend, this file must become an **HTTP/WebSocket adapter** instead of a rules engine.

---

## 4.2 Main rule for backend API integration

Keep the stores and components mostly unchanged.

The safest architecture is:

- components emit user intents,
- stores orchestrate requests and local loading state,
- `src/lib/services/api.ts` becomes the real API client,
- the server becomes the source of truth.

Do **not** duplicate the full rules engine in both frontend and backend unless there is a very specific reason.

The backend should be authoritative.

---

## 4.3 Exact files to modify for real game API

## A. Rewrite `src/lib/services/api.ts`

This is the main file.

### What must be removed or replaced

The following local responsibilities should move out of the frontend:

- `createInitialPlayers()`
- `createInitialGameState()`
- `applyMove(...)`
- local move legality logic
- local AI move generation
- fake delays like `wait(...)`

### What this file should become

It should become a request adapter with functions like:

```ts
export const apiService = {
  async startGame(mode, difficulty, eegEnabled) { ... },
  async getGameState(sessionId) { ... },
  async submitMove(sessionId, moveNotation) { ... },
  async resetGame(sessionId) { ... },
  async ping() { ... },
  async getAIMove(sessionId) { ... }
};
```

### Important difference

The current `submitMove` takes `currentState` as input because the frontend engine mutates it locally:

```ts
submitMove(sessionId, moveNotation, currentState, playerId)
```

With a real backend, this should usually become:

```ts
submitMove(sessionId, moveNotation)
```

because the backend already knows the current state.

### Example shape

```ts
async submitMove(sessionId: string, moveNotation: string): Promise<GameState> {
  const response = await fetch(`/api/game/${sessionId}/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ move: moveNotation })
  });

  if (!response.ok) {
    throw new Error('Move request failed');
  }

  return response.json();
}
```

The exact endpoint paths depend on your server.

---

## B. Modify `src/lib/stores/game.ts`

This file is already the correct orchestrator, but it currently assumes local/mock backend behavior.

### What to change

#### 1. Update API call signatures

Because the real backend should be authoritative, the store should stop passing full local state into the service.

Example change:

Current:

```ts
const result = await apiService.submitMove(current.sessionId, moveNotation, current);
```

Likely replacement:

```ts
const state = await apiService.submitMove(current.sessionId, moveNotation);
gameState.set(state);
```

#### 2. Move validation strategy

Right now some validation is effectively local or mock-driven.

For a real backend, decide this split:

- lightweight format validation in frontend,
- true legality validation in backend.

That means the frontend may still reject obviously malformed strings,
but the backend decides whether the move is allowed.

#### 3. AI move handling

Currently the store does:

- `getAIMove(current)`
- then `submitMove(...)`

For a real backend, one of these is better:

### Option A. Backend auto-plays AI

Frontend submits the human move.
Backend returns the updated state after also processing the AI response.

Then remove explicit `getAIMove()` calls from the frontend.

### Option B. Backend exposes a separate AI endpoint

Then keep a request like:

```ts
const aiMove = await apiService.getAIMove(sessionId);
```

but the backend should still validate and apply it.

### Better architecture

Option A is cleaner. The frontend should not orchestrate server AI unless the product explicitly requires it.

#### 4. Polling or live updates

If the backend can change state outside of the current request cycle, add one of:

- polling using `getGameState(sessionId)`,
- WebSocket subscription,
- Server-Sent Events.

If you add live updates, `game.ts` is where the subscription lifecycle should be managed.

---

## C. Modify `src/lib/types/game.ts`

This file is the shared frontend game contract.

When the backend becomes real, this file must match backend payloads exactly.

### What to verify

Check whether the backend sends:

- `currentPlayer` as a number or string,
- `winner` as `null`, `0`, or player id,
- `walls` as position/orientation objects or strings,
- `legalMoves` as strings, objects, or omitted,
- `evaluation` as optional or always present,
- `definedPosition` under a different field name.

### Common required changes

You may need to update:

- `Move`
- `Wall`
- `Player`
- `GameState`
- `ApiStatus`

### Important rule

Do not distort the backend payload all across the app.

Either:

- align `types/game.ts` directly to the backend,
- or create mapping functions inside `api.ts`.

The second approach is better when backend naming is ugly or unstable.

---

## D. Keep `src/lib/utils/notation.ts` only for frontend-side formatting

This file should still be used for:

- parsing manual notation input,
- formatting board selections into notation strings,
- basic validation before sending data.

It should **not** remain the main legality engine once the backend is authoritative.

So keep it for:

- `e2`
- `d4h`
- `f6v`

but do not rely on it to decide full move legality.

---

## E. Adjust `src/lib/components/board/QuoridorBoard.svelte`

This board component should remain a renderer and interaction layer.

### What may need to change

If the backend returns more explicit move metadata, the board should render from that instead of deriving too much locally.

For example, the backend may provide:

- allowed pawn destinations,
- allowed wall anchors,
- blocked slots,
- last move,
- suggested move,
- winning path hints.

In that case modify the board to read fields like:

- `legalMoves`
- `legalWallMoves`
- `lastMove`
- `highlights`

If the backend does not send these, the current UI can still function, but the frontend will need more local derivation.

---

## F. Adjust `src/lib/components/session/StatusPanel.svelte`

Once the backend is real, this panel should show real API health instead of placeholder status.

Possible data to expose:

- API connected/disconnected,
- backend latency,
- session sync status,
- last server update time,
- current session id from server,
- server-side validation errors.

The current page passes:

```ts
apiStatus={{ connected: $apiConnected, lastPing: Date.now(), error: null }}
```

That is not real health data.

To improve this, add:

- real `ping()` calls in `game.ts`,
- store a proper `apiStatus` store,
- pass real values into `StatusPanel`.

---

## G. Adjust `src/lib/components/session/AdvancedPanel.svelte`

This panel likely shows export/debug/session state.

When a real backend exists, it should also be able to show:

- raw backend payload,
- session id,
- server-generated position string,
- engine evaluation if provided by backend,
- request/response timestamps,
- maybe exportable JSON from server.

If it already exposes local state export, check that the export format matches server truth.

---

## 4.4 Recommended backend contract

The easiest frontend integration is a backend that returns a full authoritative `GameState` after every mutation.

### Recommended endpoints

Example only:

- `POST /api/game/start`
- `GET /api/game/:sessionId`
- `POST /api/game/:sessionId/move`
- `POST /api/game/:sessionId/reset`
- `GET /api/health`

### Recommended payloads

#### Start game request

```json
{
  "mode": "2-player",
  "difficulty": "medium",
  "eegEnabled": true
}
```

#### Start game response

```json
{
  "sessionId": "abc123",
  "mode": "2-player",
  "difficulty": "medium",
  "status": "in-progress",
  "currentPlayer": 1,
  "players": [
    { "id": 1, "color": "blue", "position": { "col": "e", "row": 1 }, "wallsRemaining": 10, "isAI": false },
    { "id": 2, "color": "red", "position": { "col": "e", "row": 9 }, "wallsRemaining": 10, "isAI": true }
  ],
  "walls": [],
  "moveHistory": [],
  "winner": null,
  "legalMoves": ["e2", "d1", "f1"],
  "boardSize": 9,
  "definedPosition": "e1 e9 / - / 1 / 10 10"
}
```

#### Submit move request

```json
{
  "move": "e2"
}
```

#### Submit move response

Best case: return the full updated `GameState`.

---

## 4.5 Frontend API client design rule

Do not scatter `fetch(...)` across components.

Keep all network calls in:

- `src/lib/services/api.ts`

This gives you one place for:

- base URL,
- headers,
- auth token injection,
- response mapping,
- error handling,
- retry strategy,
- timeouts.

---

## 4.6 Add backend config support

For a real backend, add config for the API base URL.

### Recommended file

- `.env` or `.env.local`

### Recommended variable

```env
PUBLIC_API_BASE_URL=http://localhost:8000
```

Then in `src/lib/services/api.ts`:

```ts
const API_BASE = import.meta.env.PUBLIC_API_BASE_URL ?? '';
```

Use this instead of hardcoded URLs.

---

## 4.7 Add a request helper

Once the backend is real, `api.ts` gets cleaner if you add a small internal helper.

Example:

```ts
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    },
    ...init
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}
```

Then every API method becomes smaller and consistent.

---

## 4.8 If the backend uses WebSocket

If the server pushes game state live, add a separate service.

Recommended new file:

- `src/lib/services/gameSocket.ts`

Responsibilities:

- connect to session updates,
- receive new `GameState`,
- reconnect on disconnect,
- notify the `game.ts` store.

Then `game.ts` becomes responsible for:

- starting the socket subscription after a session is created,
- updating `gameState` when messages arrive,
- cleaning up on reset or leave.

Do not overload `api.ts` with both REST and WebSocket logic if it becomes messy.

---

# 5. Files to add for a clean real integration

These files do not exist yet but would improve the project a lot.

## For Muse

- `src/lib/services/museEEG.ts`
- `src/lib/utils/eeg.ts`
- `src/lib/utils/eegMetrics.ts`

## For backend game API

- `src/lib/services/gameSocket.ts`
- `src/lib/types/api.ts`
- `src/lib/utils/http.ts`

### What each would do

#### `src/lib/services/museEEG.ts`
Real device adapter.

#### `src/lib/utils/eeg.ts`
Raw sample normalization, scaling, filtering helpers.

#### `src/lib/utils/eegMetrics.ts`
Derived metrics such as focus score or engagement score.

#### `src/lib/services/gameSocket.ts`
Live session updates from server.

#### `src/lib/types/api.ts`
Raw request/response types if the backend contract differs from the internal UI model.

#### `src/lib/utils/http.ts`
Shared request helper, timeout logic, error parsing.

---

# 6. The safest migration order

Do not rewrite everything at once.

## Order for Muse integration

1. keep the UI unchanged,
2. create a real Muse service file,
3. make `eeg.ts` consume the new service,
4. normalize real packets to `EEGSample`,
5. update graph scaling,
6. add metadata fields to the panel,
7. add optional export/storage later.

## Order for backend API integration

1. define the backend `GameState` contract,
2. rewrite `src/lib/services/api.ts` to use real requests,
3. update `src/lib/stores/game.ts` to stop relying on local state mutation,
4. verify move submission and returned state rendering,
5. add health check / latency,
6. add live updates only after the base REST flow works.

---

# 7. What not to do

## For Muse

Do not:

- parse vendor packets inside `EEGPanel.svelte`,
- compute heavy metrics directly in the graph markup,
- store raw unstable device objects in Svelte state,
- assume mock `0..1` signal ranges will match real data.

## For backend API

Do not:

- keep the frontend as the main rules authority,
- duplicate full move legality rules in three places,
- scatter `fetch()` calls through components,
- pass backend-specific payload shapes directly everywhere without mapping,
- trust frontend-only move legality as the source of truth.

---

# 8. Minimum practical diff summary

## To integrate Muse

Modify:

- `src/lib/services/mockEEG.ts` -> replace or supersede with `src/lib/services/museEEG.ts`
- `src/lib/stores/eeg.ts`
- `src/lib/types/eeg.ts`
- `src/lib/components/eeg/EEGPanel.svelte`
- `src/lib/components/eeg/EEGGraph.svelte`

Optional additions:

- `src/lib/utils/eeg.ts`
- `src/lib/utils/eegMetrics.ts`

## To integrate a real backend game API

Modify:

- `src/lib/services/api.ts`
- `src/lib/stores/game.ts`
- `src/lib/types/game.ts`
- `src/lib/components/session/StatusPanel.svelte`
- `src/lib/components/session/AdvancedPanel.svelte`
- possibly `src/lib/components/board/QuoridorBoard.svelte`

Optional additions:

- `src/lib/utils/http.ts`
- `src/lib/types/api.ts`
- `src/lib/services/gameSocket.ts`

---

# 9. Final direct answer

If the question is simply **“what files do I modify?”**, the short answer is this:

## Real Muse integration

Primary files:

- `src/lib/services/mockEEG.ts`
- `src/lib/stores/eeg.ts`
- `src/lib/types/eeg.ts`
- `src/lib/components/eeg/EEGPanel.svelte`
- `src/lib/components/eeg/EEGGraph.svelte`

## Real backend game API integration

Primary files:

- `src/lib/services/api.ts`
- `src/lib/stores/game.ts`
- `src/lib/types/game.ts`
- `src/lib/components/session/StatusPanel.svelte`
- `src/lib/components/session/AdvancedPanel.svelte`
- possibly `src/lib/components/board/QuoridorBoard.svelte`

The two files that matter most are:

- `src/lib/services/api.ts`
- `src/lib/services/mockEEG.ts`

Those are the fake backend layers. Replace those correctly and the rest of the app can stay mostly intact.
