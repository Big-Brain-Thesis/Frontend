# Big Brain — Quoridor Research Interface (SvelteKit)

## Overview

Big Brain is a SvelteKit frontend for a **Quoridor-inspired research interface**. The project combines three ideas into one UI:

1. **A playable Quoridor board** with pawn movement, wall placement, move history, and basic AI response.
2. **A session-oriented analysis panel** that exposes logs, position strings, export data, and session metadata.
3. **An EEG monitoring workflow** that simulates brain-signal streaming and displays live channel graphs and a derived focus score.

This repository is not a plain game client. It is structured like an **experimental interface for human-vs-AI decision making**, where gameplay, instrumentation, and monitoring are shown in one place.

The current codebase is a **SvelteKit rewrite** of an older React/Vite version. The UI is now built from `.svelte` components, while the state, types, and service layer remain in TypeScript.

---

## Purpose of the game and the application

### What Quoridor is

Quoridor is a two-player or four-player abstract strategy board game. In the standard two-player form:

- each player controls one pawn,
- the board is 9×9,
- the goal is to reach the opposite side of the board first,
- players may either move their pawn or place a wall,
- walls are used to slow the opponent, not to trap them permanently.

The strategic tension comes from choosing between **making direct progress** and **spending tempo to obstruct the opponent**.

### What this project is trying to do

This application uses Quoridor as a **testbed for interaction, monitoring, and decision support**. The game gives the interface a concrete task with turns, legal actions, and measurable outcomes. Around that task, the app exposes:

- session lifecycle controls,
- move logging,
- state export,
- mock backend communication,
- mock EEG streaming and visualization,
- a UI that can later be connected to real services.

### Why this game fits the project

Quoridor is useful for this kind of system because it is:

- **turn-based**, so actions are discrete and easy to log,
- **strategic**, so there is room for AI assistance or evaluation,
- **stateful**, so position encoding and session export matter,
- **visual**, so board rendering and interaction design are central,
- **small enough** to prototype quickly while still being meaningful.

In other words, the board game is not only entertainment here. It is the **interaction core** around which the rest of the interface is built.

---

## Current implementation status

The project is functional as a frontend prototype, but the current game engine is still a **mock implementation**, not a full tournament-accurate Quoridor engine.

### What currently works

- new game creation,
- two-player session model with human vs AI,
- board rendering,
- clickable pawn moves,
- drag-and-drop or click-based wall placement,
- move history,
- session export,
- debug log stream,
- mock AI move selection,
- mock EEG device connection,
- live EEG graph and focus score.

### What is still simplified

- path validation for walls is not fully enforced like official Quoridor,
- jump rules and advanced adjacency rules are simplified,
- `4-player` exists in the type model but is not fully implemented in the UI/game setup,
- backend connectivity is mocked locally instead of using a server,
- EEG is simulated, not connected to a real headset.

This is best understood as a **research UI prototype with a lightweight rules engine**, not a finished production game platform.

---

## Technology stack

- **SvelteKit** for application structure and routing
- **Svelte** for UI components and reactivity
- **TypeScript** for stores, services, and domain types
- **Vite** for development/build tooling
- **Tailwind CSS** via `@tailwindcss/vite` for styling

---

## How the application is organized

At a high level, the app is split into five layers:

1. **Routes** — top-level pages and layout.
2. **Components** — visual pieces such as the board, side panels, logs, and EEG graph.
3. **Stores** — Svelte state containers that coordinate UI actions and async service calls.
4. **Services** — mock backend adapters and the mock EEG streaming source.
5. **Types and utilities** — shared domain models and notation parsing helpers.

The main rule of the project is:

- **components should not implement backend logic directly**,
- **stores coordinate actions**,
- **services simulate external systems**,
- **types define the contract** between them.

---

## Runtime architecture

### Game flow

The gameplay flow is:

1. The user clicks **New Game**.
2. `src/routes/+page.svelte` calls `startNewGame(...)` from the game store.
3. `src/lib/stores/game.ts` calls `apiService.startGame(...)`.
4. `src/lib/services/api.ts` creates a new mock `GameState`.
5. The `gameState` store updates.
6. `QuoridorBoard`, `MoveHistory`, `StatusPanel`, and `AdvancedPanel` re-render.
7. When the user moves a pawn or places a wall, the UI calls `submitMove(...)`.
8. The game store forwards that move to `apiService.submitMove(...)`.
9. The mock service validates and applies the move.
10. The store writes the new `GameState`.
11. If it becomes the AI’s turn, `runAIMove()` requests a move from `apiService.getAIMove(...)` and submits it.

### EEG flow

The EEG flow is separate from the board flow:

1. The user enables EEG monitoring in `SessionControls`.
2. `+page.svelte` calls `startEEGMonitoring()` from the EEG store.
3. `src/lib/stores/eeg.ts` subscribes to `mockEEGStream`.
4. `src/lib/services/mockEEG.ts` generates samples on an interval.
5. The EEG store aggregates samples and updates `eegState`.
6. `EEGPanel` and `EEGGraph` re-render from that store state.

### Logging flow

The logging flow is cross-cutting:

1. Store actions call `addLog(...)`.
2. `src/lib/stores/logger.ts` appends structured entries.
3. `DebugConsole.svelte` renders the live log list.

---

## Backend connection model

## Important clarification

There is **no real backend server in this repository right now**.

The application presents itself like a frontend connected to services, but the current “backend” layer is **mocked entirely inside the client**:

- game state is generated and mutated in `src/lib/services/api.ts`,
- EEG device data is generated in `src/lib/services/mockEEG.ts`.

No HTTP requests, WebSocket connections, or server-side database calls are currently made.

### What counts as the current backend layer

#### 1. `src/lib/services/api.ts`
This file is the **mock game backend adapter**. It acts like an API service even though it is in-process and local.

It is responsible for:

- starting games,
- returning game state,
- validating move notation,
- applying pawn and wall moves,
- resetting the session,
- simulating latency,
- generating AI moves.

#### 2. `src/lib/services/mockEEG.ts`
This file is the **mock EEG device/stream backend**.

It is responsible for:

- simulating connection status,
- generating timed EEG samples,
- broadcasting samples to listeners,
- simulating a focus score.

### Files that connect to the backend layer

#### Game connection path

- `src/routes/+page.svelte` — user interaction entry point
- `src/lib/stores/game.ts` — orchestration layer for game actions
- `src/lib/services/api.ts` — mock backend implementation
- `src/lib/types/game.ts` — shared contract used by UI, store, and service
- `src/lib/utils/notation.ts` — notation parsing used by the service and input validation

#### EEG connection path

- `src/routes/+page.svelte` — toggles EEG monitoring
- `src/lib/stores/eeg.ts` — orchestration layer for EEG lifecycle
- `src/lib/services/mockEEG.ts` — mock device stream
- `src/lib/types/eeg.ts` — shared EEG data contract

#### Logging connection path

- `src/lib/stores/game.ts` — emits logs for session, move, API, and AI events
- `src/lib/stores/eeg.ts` — emits logs for EEG state changes
- `src/lib/stores/logger.ts` — receives and stores the log records
- `src/lib/components/logs/DebugConsole.svelte` — renders the records

### How to replace the mock backend with a real backend

The project is already separated in a way that makes replacement straightforward:

- keep the UI components mostly unchanged,
- keep the domain types in `src/lib/types/*`,
- replace the implementation in `src/lib/services/api.ts` with `fetch(...)` or another client,
- replace `src/lib/services/mockEEG.ts` with a real SDK wrapper, WebSocket client, or Web Bluetooth integration,
- keep the store interface stable so the page and components do not need major rewrites.

A future real backend integration would most likely put these responsibilities on a server:

- session creation,
- legal move validation,
- authoritative board state,
- AI move generation,
- persistence,
- analytics.

---

## Detailed file-by-file documentation

This section describes **every file currently in the repository** and how each file fits into the application.

### Root files

#### `package.json`
Defines the package metadata, scripts, and development dependencies.

Key responsibilities:

- names the project `quoridor-sveltekit`,
- defines the main scripts:
  - `npm run dev` for local development,
  - `npm run build` for production build,
  - `npm run preview` for previewing the built app,
  - `npm run check` for Svelte and TypeScript validation,
- lists the core dev dependencies for SvelteKit, Vite, Tailwind, and TypeScript.

This file is the project’s build/runtime manifest.

#### `README.md`
The main project documentation. This file explains the project purpose, architecture, files, and extension points.

#### `MIGRATION.md`
A short migration note that records the move from the old React/Vite structure to the current SvelteKit structure.

This is useful as historical context, especially if you compare branches or old code.

#### `svelte.config.js`
Configures SvelteKit.

Key responsibilities:

- enables `vitePreprocess()` so standard Vite-driven preprocessing works,
- sets `adapter-auto` so deployment can be inferred in many environments.

This file controls framework-level behavior.

#### `vite.config.ts`
Configures Vite.

Key responsibilities:

- registers the Tailwind plugin,
- registers the SvelteKit plugin.

This file controls the local dev server and build pipeline.

#### `tsconfig.json`
Configures TypeScript behavior.

Key responsibilities:

- extends the generated SvelteKit TypeScript config,
- enables strict type checking,
- uses bundler-style module resolution,
- enables source maps,
- keeps compatibility flags that help with imports and generated code.

This file is central for editor tooling, type safety, and compile-time correctness.

---

### App shell files

#### `src/app.html`
The HTML document template used by SvelteKit.

Key responsibilities:

- defines the base HTML document,
- includes `%sveltekit.head%` for injected metadata,
- includes `%sveltekit.body%` where the app renders,
- sets `data-sveltekit-preload-data="hover"`.

This file is the outer HTML shell around the client application.

#### `src/app.css`
Global stylesheet.

Key responsibilities:

- imports Tailwind CSS,
- sets a dark color scheme,
- defines global body typography and background,
- normalizes font inheritance for controls,
- adds a `.mono` utility class used throughout the UI.

This file provides the base visual system used by all components.

---

### Route files

#### `src/routes/+layout.svelte`
Root layout component.

Key responsibilities:

- imports `src/app.css`,
- renders the route children.

This file is intentionally small. Its job is to apply global CSS and act as the route wrapper.

#### `src/routes/+page.svelte`
The main application page and top-level composition root.

Key responsibilities:

- imports all major UI sections,
- binds the page to the Svelte stores,
- holds local UI settings like difficulty and EEG toggle state,
- starts and resets games,
- forwards move events from the board/input into the game store,
- starts and stops EEG monitoring,
- sets the page `<title>` and description.

This is the file that **assembles the entire interface**.

Backend/store connection responsibilities:

- reads from `gameState`, `isLoading`, `apiConnected`, `logs`, and `eegState`,
- calls `startNewGame`, `submitMove`, `resetGame`, `startEEGMonitoring`, `stopEEGMonitoring`, and `reconnectEEG`.

This file is the main bridge between the presentational layer and the application state layer.

---

### Component files

## Board components

#### `src/lib/components/board/QuoridorBoard.svelte`
The main visual board and move interaction surface.

Key responsibilities:

- renders the 9×9 square grid,
- renders row/column labels,
- displays player pawns,
- highlights legal pawn moves,
- displays existing walls,
- allows click-based pawn movement,
- allows wall selection,
- supports drag-and-drop wall placement,
- emits notation strings through the `onMove` callback.

Important internal behavior:

- builds reactive maps/sets for players, walls, and legal moves,
- uses a `renderKey` to force board remount when the game position changes,
- converts UI gestures into notation strings like `e2`, `d5h`, or `c4v`.

Backend/store connection responsibilities:

- does **not** talk directly to services,
- receives `gameState` from the parent page,
- sends actions upward through `onMove(notation)`.

This is the core gameplay interaction file.

#### `src/lib/components/board/MoveHistory.svelte`
Displays move history in turn-paired form.

Key responsibilities:

- receives the move list,
- groups moves into pairs,
- renders move numbers with player 1 and player 2 entries.

Backend/store connection responsibilities:

- no direct backend communication,
- passively renders `gameState.moveHistory`.

This is a pure presentation component.

## EEG components

#### `src/lib/components/eeg/EEGPanel.svelte`
High-level EEG display and status panel.

Key responsibilities:

- shows EEG connection status,
- shows mock device name and sample rate,
- shows the latest channel values,
- shows the focus score bar,
- displays reconnect UI when errors occur,
- embeds the graph component.

Backend/store connection responsibilities:

- does not talk directly to the stream,
- consumes `eegState` from the parent,
- calls `onReconnect()` when the reconnect button is clicked.

This is the primary UI surface for EEG monitoring.

#### `src/lib/components/eeg/EEGGraph.svelte`
Low-level SVG graph renderer for EEG time-series samples.

Key responsibilities:

- receives EEG samples,
- keeps only the latest window for display,
- converts normalized channel values into SVG path coordinates,
- draws grid lines,
- draws four line paths for AF7, AF8, TP9, and TP10,
- shows a placeholder when no samples are available.

Backend/store connection responsibilities:

- none directly,
- renders whatever `EEGPanel` passes down.

This file is strictly the visualization layer for streaming EEG data.

## Layout and utility UI components

#### `src/lib/components/layout/AppHeader.svelte`
Top header bar.

Key responsibilities:

- shows app branding,
- displays the current session ID when a game exists,
- shows backend online/offline status,
- includes the keyboard shortcut/help trigger.

Backend/store connection responsibilities:

- receives `sessionId` and `apiConnected` from `+page.svelte`,
- does not call services directly.

This file is the global top navigation/header strip.

#### `src/lib/components/logs/DebugConsole.svelte`
Live log viewer.

Key responsibilities:

- renders structured logs,
- filters by category,
- auto-scrolls on update,
- supports collapse/expand,
- color-codes level and category.

Backend/store connection responsibilities:

- no direct backend calls,
- renders data from the `logs` store.

This is the observability console for the prototype.

## Session and side-panel components

#### `src/lib/components/session/SessionControls.svelte`
Session control panel.

Key responsibilities:

- selects AI difficulty,
- enables/disables EEG monitoring,
- starts a new game,
- resets the current game.

Backend/store connection responsibilities:

- emits events upward to the page,
- does not call services directly.

This is the main control surface for the session lifecycle.

#### `src/lib/components/session/NotationInput.svelte`
Manual move entry field.

Key responsibilities:

- accepts typed notation,
- validates notation format before submission,
- sends a move upward through `onSubmit`.

Backend/store connection responsibilities:

- uses `isValidNotation(...)` from `notation.ts` for client-side validation,
- does not call services directly.

This component is useful for testing board state quickly and for wall move input.

#### `src/lib/components/session/StatusPanel.svelte`
Compact session status panel.

Key responsibilities:

- shows backend connection state,
- shows EEG device state when enabled,
- shows session metadata such as move count, turn, winner, and session ID.

Backend/store connection responsibilities:

- receives data from the page,
- does not call services directly.

This file gives a concise operational summary of the system.

#### `src/lib/components/session/AdvancedPanel.svelte`
Expandable advanced tools panel.

Key responsibilities:

- generates a compact position string,
- lists moves in plain notation form,
- copies text to the clipboard,
- exports the current session as JSON,
- shows metadata such as mode, difficulty, board size, and winner.

Backend/store connection responsibilities:

- does not talk to the backend,
- exports the current frontend state as a client-side file.

This component is important for debugging, reproducibility, and data capture.

#### `src/lib/components/session/WelcomeScreen.svelte`
Initial screen shown before a game starts.

Key responsibilities:

- introduces the interface,
- summarizes the board, EEG, and export features,
- gives the empty state a clear purpose.

Backend/store connection responsibilities:

- none.

This is a presentational onboarding panel.

#### `src/lib/components/session/KeyboardHelp.svelte`
Shortcut help modal.

Key responsibilities:

- opens a dialog with listed keyboard shortcuts,
- documents intended control mappings.

Backend/store connection responsibilities:

- none.

Important note:

The component currently documents shortcuts, but it does **not** implement global keyboard handlers itself. It is reference UI, not a full hotkey system.

---

### Store files

#### `src/lib/stores/game.ts`
Primary game state orchestration store.

Key responsibilities:

- exposes `gameState`, `isLoading`, and `apiConnected`,
- starts new games,
- submits player moves,
- triggers AI moves,
- resets the game,
- writes structured logs.

Backend connection responsibilities:

- calls `apiService.startGame(...)`,
- calls `apiService.submitMove(...)`,
- calls `apiService.resetGame(...)`,
- calls `apiService.getAIMove(...)`.

This file is the **central application controller** for game actions.

Important implementation note:

The store is what separates UI events from service calls. Components do not need to know how moves are validated or where AI moves come from. They only dispatch actions through this store.

#### `src/lib/stores/eeg.ts`
Primary EEG lifecycle orchestration store.

Key responsibilities:

- holds EEG state in `eegState`,
- starts monitoring,
- stops monitoring,
- reconnects the stream,
- buffers samples,
- reduces update frequency for UI friendliness,
- writes structured logs.

Backend connection responsibilities:

- subscribes to `mockEEGStream.onStatusChange(...)`,
- subscribes to `mockEEGStream.onSample(...)`,
- calls `mockEEGStream.connect()` and `disconnect()`.

This file is the EEG equivalent of the game store.

#### `src/lib/stores/logger.ts`
Structured log store.

Key responsibilities:

- holds the log list,
- creates typed log entries,
- limits log history length,
- supports clearing logs.

Backend connection responsibilities:

- none directly,
- receives events from other stores.

This file is shared infrastructure for debugging and observability.

---

### Service files

#### `src/lib/services/api.ts`
Mock backend service for gameplay.

This file is one of the most important files in the repository.

Key responsibilities:

- defines helper functions for state cloning, turn progression, goal checking, and neighbor lookup,
- builds the initial game state,
- computes legal pawn moves,
- validates notation,
- applies pawn moves,
- applies wall placements,
- creates move history records,
- determines winner state,
- updates `definedPosition`,
- simulates async latency,
- generates a simple AI move.

Public service methods:

- `startGame(...)`
- `getGameState(...)`
- `submitMove(...)`
- `resetGame(...)`
- `ping()`
- `getAIMove(...)`

Important architectural note:

Even though the file is named like an API adapter, it is currently a **local deterministic rules/mutation service**. There is no network layer here yet.

Limitations of the current implementation:

- legal move generation only uses neighbor squares and occupancy,
- walls are recorded and displayed, but the official rule constraints are simplified,
- AI move selection is simplistic and mostly row-driven,
- authoritative game logic exists only in the browser runtime.

If a real backend is introduced later, this file is the most likely place to refactor first.

#### `src/lib/services/mockEEG.ts`
Mock EEG stream implementation.

Key responsibilities:

- models a device-like class `MockEEGStream`,
- simulates connection and disconnect behavior,
- keeps sample listeners and status listeners,
- starts a timer that emits samples every 10 ms,
- generates normalized values for AF7, AF8, TP9, and TP10,
- calculates a mock focus score.

Important architectural note:

This service behaves like an SDK wrapper. A real EEG integration could preserve the public surface and replace the internals.

---

### Type files

#### `src/lib/types/game.ts`
Shared gameplay domain types.

Defines:

- `Position`
- `PlayerColor`
- `Player`
- `WallOrientation`
- `Wall`
- `MoveType`
- `Move`
- `GameMode`
- `Difficulty`
- `GameStatus`
- `GameState`
- `ApiStatus`

This file is the contract for the game domain across UI, stores, and services.

#### `src/lib/types/eeg.ts`
Shared EEG domain types.

Defines:

- `EEGChannel`
- `EEGSample`
- `EEGConnectionStatus`
- `EEGState`

This file keeps EEG data handling consistent across the mock service, store, and UI.

#### `src/lib/types/logs.ts`
Shared logging types.

Defines:

- `LogLevel`
- `LogCategory`
- `LogEntry`

This file keeps the logging system structured and type-safe.

---

### Utility files

#### `src/lib/utils/notation.ts`
Notation parser and formatter utilities.

Key responsibilities:

- parses square notation such as `e2`,
- parses wall notation such as `d5h` and `c4v`,
- formats positions back into algebraic notation,
- determines whether a notation string represents a wall,
- validates notation shape.

Backend/store connection responsibilities:

- used by the manual input component,
- used by the mock API service to validate and interpret moves,
- used by board-related code to convert positions into keys.

This file is the small but critical translation layer between UI strings and structured coordinates.

---

## Data contracts and state shape

The central runtime object in the game flow is `GameState`:

- `sessionId` — current session identifier
- `mode` — `2-player` or `4-player`
- `difficulty` — AI difficulty label
- `status` — lifecycle state of the game
- `currentPlayer` — whose turn it is
- `players` — list of player objects with position and wall counts
- `walls` — placed walls
- `moveHistory` — chronological move list
- `winner` — winner id or `null`
- `legalMoves` — current legal pawn moves in notation form
- `boardSize` — board dimension
- `evaluation` — optional evaluation field for future use
- `definedPosition` — compact position encoding string

The central runtime object in the EEG flow is `EEGState`:

- `enabled` — whether monitoring is on
- `status` — connection state
- `deviceName` — mock device name
- `sampleRate` — stream rate
- `lastSampleTimestamp` — timestamp of most recent sample
- `error` — connection error string
- `samples` — rolling buffer of EEG samples

---

## UI composition map

The page composes the interface into two major columns:

### Left/main column

- welcome screen or board
- move history
- debug console

### Right/sidebar column

- session controls
- notation input
- status panel
- EEG panel when enabled
- advanced/export panel

This split makes the left side the **task space** and the right side the **control/telemetry space**.

---

## Interaction model

### Pawn movement

Pawn moves are submitted as square notation, for example:

- `e2`
- `f5`
- `d9`

The board highlights legal pawn targets using the `legalMoves` array from the current state.

### Wall placement

Wall moves are submitted as wall notation, for example:

- `e3h` for a horizontal wall
- `d6v` for a vertical wall

The current board supports:

- selecting wall orientation,
- dragging a wall onto a valid slot,
- click-based wall placement after orientation selection,
- manual notation entry through `NotationInput.svelte`.

### AI movement

After a valid human move, if the next player is the AI and the game is still active, the game store waits briefly and then requests an AI move through `apiService.getAIMove(...)`.

### EEG monitoring

When EEG monitoring is enabled, the EEG store opens the mock stream and the graph updates from rolling sample state.

---

## Export and reproducibility features

The advanced panel provides a lightweight reproducibility workflow:

- **position string** — compact state encoding
- **move list** — notation-only game history
- **session JSON export** — structured snapshot of the session

These features are useful for:

- debugging,
- replay preparation,
- backend contract testing,
- later analytics pipelines.

---

## Known limitations and design constraints

### Gameplay rules

The current game logic is intentionally simplified.

Notably:

- official Quoridor path-blocking constraints are not fully enforced,
- jump rules are incomplete,
- four-player mode is not finished,
- AI is heuristic and minimal.

### Backend realism

The app shows a backend status concept, but there is no real server yet.

This means:

- no persistence,
- no authoritative server state,
- no network retries,
- no authentication,
- no multiplayer synchronization.

### EEG realism

The EEG graph is based on locally generated values.

This means:

- no real device pairing,
- no signal processing pipeline,
- no artifact rejection,
- no persisted brain data,
- no calibration.

### Keyboard help

The keyboard help modal is documentation only. It does not yet wire real global shortcuts.

---

## Recommended next backend steps

If this project is going to mature beyond prototype level, the highest-value next steps are:

1. move authoritative gameplay logic to a real backend,
2. replace `api.ts` with actual HTTP/WebSocket calls,
3. add full Quoridor legality checks on the server,
4. make the frontend read-only with respect to game truth,
5. persist sessions and move logs,
6. replace `mockEEG.ts` with a real acquisition layer,
7. formalize the position string and export schema.

---

## Run the project

```bash
npm install
npm run dev
```

Build check:

```bash
npm run check
npm run build
```

---
