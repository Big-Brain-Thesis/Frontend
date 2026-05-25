<script lang="ts">
  import type { GameState, Player, WallOrientation } from "$lib/types/game";
  import { formatSquare } from "$lib/utils/notation";
  import { fade } from "svelte/transition";

  export let gameState: GameState | null = null;
  export let disabled = false;
  export let soundEnabled = true;
  export let onMove: (notation: string) => void = () => {};

  const COLS = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];
  const DISPLAY_ROWS = [9, 8, 7, 6, 5, 4, 3, 2, 1];
  const WALL_ROWS = [8, 7, 6, 5, 4, 3, 2, 1];
  const WALL_COLS = COLS.slice(0, 8);

  const SQUARE = 54;
  const SLOT = 14;
  const STEP = SQUARE + SLOT;
  const BOARD = SQUARE * 9 + SLOT * 8;
  const LABEL = 26;

  let hoveredSquare: string | null = null;
  let hoveredWall: string | null = null;
  let wallOrientation: WallOrientation = "h";
  let lastMoveSignature = "";

  $: boardRenderKey = gameState
    ? [
        gameState.sessionId,
        gameState.currentPlayer,
        gameState.status,
        gameState.winner ?? "none",
        gameState.moveHistory.length,
        gameState.players
          .map(
            (player) =>
              `${player.id}:${player.position.col}${player.position.row}:${player.wallsRemaining}`,
          )
          .join("|"),
        gameState.walls
          .map(
            (wall) =>
              `${wall.position.col}${wall.position.row}${wall.orientation}`,
          )
          .join("|"),
        gameState.legalMoves.join(","),
        gameState.legalWalls.join(","),
      ].join("::")
    : "empty";

  $: activePlayer =
    gameState?.players.find(
      (player) => player.id === gameState.currentPlayer,
    ) ?? null;

  $: canPlaceWalls = !disabled && (activePlayer?.wallsRemaining ?? 0) > 0;

  $: playerMap = new Map<string, Player>(
    (gameState?.players ?? []).map((player) => [
      formatSquare(player.position),
      player,
    ]),
  );

  $: legalMoveSet = new Set(gameState?.legalMoves ?? []);
  $: legalWallSet = new Set(gameState?.legalWalls ?? []);

  $: wallSet = new Set(
    (gameState?.walls ?? []).map(
      (wall) => `${formatSquare(wall.position)}${wall.orientation}`,
    ),
  );

  $: latestMove = gameState?.moveHistory.at(-1);
  $: latestPlacedWallKey =
    latestMove?.type === "wall" ? latestMove.notation : null;

  $: if (latestMove) {
    const signature = `${latestMove.player}:${latestMove.timestamp}:${latestMove.notation}:${latestMove.type}`;
    if (signature !== lastMoveSignature) {
      lastMoveSignature = signature;
      playSound(latestMove.type);
    }
  }

  function handleSquareClick(col: string, row: number) {
    if (disabled || !isLegalMove(col, row)) return;
    onMove(`${col}${row}`);
  }

  function handleSquareContextMenu(
    event: MouseEvent,
    col: string,
    row: number,
  ) {
    event.preventDefault();
    if (!canPlaceWalls) return;

    const anchor = normalizeWallAnchor(col, row);
    const notation = wallNotation(anchor.col, anchor.row, wallOrientation);
    if (!isLegalWall(anchor.col, anchor.row, wallOrientation)) return;
    onMove(notation);
  }

  function normalizeWallAnchor(col: string, row: number) {
    const colIndex = Math.max(
      0,
      Math.min(WALL_COLS.length - 1, COLS.indexOf(col)),
    );
    return {
      col: WALL_COLS[colIndex],
      row: Math.max(1, Math.min(8, row)),
    };
  }

  function wallNotation(
    col: string,
    row: number,
    orientation: WallOrientation,
  ) {
    return `${col}${row}${orientation}`;
  }

  function handleWallSlotContextMenu(
    event: MouseEvent,
    col: string,
    row: number,
    orientation: WallOrientation,
  ) {
    event.preventDefault();
    if (!canPlaceWalls || hasWall(col, row, orientation) || !isLegalWall(col, row, orientation)) return;
    onMove(wallNotation(col, row, orientation));
  }

  function getPlayerAtPosition(col: string, row: number): Player | undefined {
    return playerMap.get(`${col}${row}`);
  }

  function isLegalMove(col: string, row: number): boolean {
    return legalMoveSet.has(`${col}${row}`);
  }

  function hasWall(
    col: string,
    row: number,
    orientation: WallOrientation,
  ): boolean {
    return wallSet.has(`${col}${row}${orientation}`);
  }

  function isLegalWall(
    col: string,
    row: number,
    orientation: WallOrientation,
  ): boolean {
    return legalWallSet.has(`${col}${row}${orientation}`);
  }

  function wallAnchorRowIndex(row: number): number {
    return 8 - row;
  }

  function squareLeft(colIndex: number): number {
    return colIndex * STEP;
  }

  function squareTop(rowIndex: number): number {
    return rowIndex * STEP;
  }

  function verticalWallStyle(colIndex: number, rowIndex: number): string {
    return `left:${squareLeft(colIndex) + SQUARE}px;top:${squareTop(rowIndex)}px;width:${SLOT}px;height:${SQUARE * 2 + SLOT}px;`;
  }

  function horizontalWallStyle(colIndex: number, rowIndex: number): string {
    return `left:${squareLeft(colIndex)}px;top:${squareTop(rowIndex) + SQUARE}px;width:${SQUARE * 2 + SLOT}px;height:${SLOT}px;`;
  }

  function isBlueGoalRow(row: number): boolean {
    return row === 9;
  }

  function isRedGoalRow(row: number): boolean {
    return row === 1;
  }

  function goalRowClass(row: number): string {
    if (isBlueGoalRow(row)) return "bg-blue-500/10 border-blue-900/60";
    if (isRedGoalRow(row)) return "bg-red-500/10 border-red-900/60";
    return "";
  }

  function playSound(type: "pawn" | "wall") {
    if (!soundEnabled || typeof window === "undefined") return;

    const AudioContextClass =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;

    if (!AudioContextClass) return;

    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = type === "wall" ? "triangle" : "sine";
    oscillator.frequency.value = type === "wall" ? 180 : 360;

    gain.gain.setValueAtTime(
      type === "wall" ? 0.07 : 0.045,
      context.currentTime,
    );
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.12);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.13);

    oscillator.onended = () => {
      void context.close();
    };
  }
</script>

{#if !gameState}
  <div
    class="flex h-140 items-center justify-center rounded border border-zinc-800 bg-zinc-900"
  >
    <p class="mono text-sm text-zinc-500">No active game</p>
  </div>
{:else}
  <div class="flex flex-col items-center gap-5">
    <div class="flex flex-wrap items-center justify-center gap-3">
      <div
        class="mono rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-400"
      >
        PLayer {gameState.currentPlayer}'s has {activePlayer?.wallsRemaining ?? 0} walls remaining: 
      </div>

      <div
        class="mono rounded border border-blue-900/60 bg-blue-950/40 px-3 py-2 text-xs text-blue-300"
      >
        Blue goal: reach row 9
      </div>
      <div
        class="mono rounded border border-red-900/60 bg-red-950/40 px-3 py-2 text-xs text-red-300"
      >
        Red goal: reach row 1
      </div>
    </div>

    {#key boardRenderKey}
      <div
        class="relative"
        style={`width:${BOARD + LABEL * 2}px;height:${BOARD + LABEL * 2}px;`}
      >
        <div
          class="pointer-events-none absolute left-6.5 top-0 flex"
          style={`width:${BOARD}px;`}
        >
          {#each COLS as col, colIndex}
            <div
              class="flex items-center justify-center mono text-xs text-zinc-500"
              style={`width:${SQUARE}px;margin-right:${colIndex < COLS.length - 1 ? SLOT : 0}px;height:${LABEL}px;`}
            >
              {col}
            </div>
          {/each}
        </div>

        <div
          class="pointer-events-none absolute left-0 top-6.5 flex flex-col"
          style={`height:${BOARD}px;`}
        >
          {#each DISPLAY_ROWS as row, rowIndex}
            <div
              class={`flex items-center justify-center mono text-xs ${isBlueGoalRow(row) ? "text-blue-300" : ""} ${isRedGoalRow(row) ? "text-red-300" : ""} ${!isBlueGoalRow(row) && !isRedGoalRow(row) ? "text-zinc-500" : ""}`}
              style={`width:${LABEL}px;height:${SQUARE}px;margin-bottom:${rowIndex < DISPLAY_ROWS.length - 1 ? SLOT : 0}px;`}
            >
              {row}
            </div>
          {/each}
        </div>

        <div
          class="absolute left-6.5 top-6.5 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3 shadow-2xl shadow-black/30"
        >
          <div
            class="relative rounded-xl border border-zinc-800 bg-zinc-900"
            style={`width:${BOARD}px;height:${BOARD}px;`}
          >
            {#each DISPLAY_ROWS as row, rowIndex}
              {#each COLS as col, colIndex}
                {@const squareKey = `${col}${row}`}
                {@const player = getPlayerAtPosition(col, row)}
                {@const legal = isLegalMove(col, row)}

                <button
                  class={`absolute flex items-center justify-center rounded-lg border-2 transition-colors duration-150 ${player ? "border-zinc-600" : "border-zinc-800"} ${goalRowClass(row)} ${legal && !disabled ? "cursor-pointer hover:border-blue-400 hover:bg-blue-500/10" : ""} ${hoveredSquare === squareKey && legal ? "border-blue-300 bg-blue-500/10" : ""} ${disabled ? "cursor-default" : ""}`}
                  style={`left:${squareLeft(colIndex)}px;top:${squareTop(rowIndex)}px;width:${SQUARE}px;height:${SQUARE}px;`}
                  {disabled}
                  title={`Left click: move to ${squareKey}. Right click: place ${wallOrientation} wall.`}
                  aria-label={player
                    ? `Square ${squareKey}: Player ${player.id}`
                    : legal && !disabled
                      ? `Move to ${squareKey}`
                      : `Square ${squareKey}`}
                  on:mouseenter={() => (hoveredSquare = squareKey)}
                  on:mouseleave={() => (hoveredSquare = null)}
                  on:click={() => handleSquareClick(col, row)}
                  on:contextmenu={(event) =>
                    handleSquareContextMenu(event, col, row)}
                >
                  <div
                    class={`absolute inset-0 rounded-md ${
                      legal && !disabled
                        ? "bg-blue-500/10"
                        : isBlueGoalRow(row)
                          ? "bg-blue-500/10"
                          : isRedGoalRow(row)
                            ? "bg-red-500/10"
                            : "bg-transparent"
                    }`}
                  ></div>

                  {#if isBlueGoalRow(row)}
                    <div
                      class="pointer-events-none absolute inset-x-1 top-1 h-0.75 rounded-full bg-blue-400/70"
                    ></div>
                  {/if}

                  {#if isRedGoalRow(row)}
                    <div
                      class="pointer-events-none absolute inset-x-1 bottom-1 h-0.75 rounded-full bg-red-400/70"
                    ></div>
                  {/if}

                  {#if legal && !disabled}
                    <div
                      class="pointer-events-none absolute h-3 w-3 rounded-full bg-blue-300/70"
                    ></div>
                  {/if}

                  {#if player}
                    <div
                      class={`pawn relative z-10 h-8 w-8 rounded-full border-2 shadow-lg ${player.color === "blue" ? "border-blue-300 bg-blue-500" : ""} ${player.color === "red" ? "border-red-300 bg-red-500" : ""} ${player.color === "green" ? "border-green-300 bg-green-500" : ""} ${player.color === "yellow" ? "border-yellow-300 bg-yellow-500" : ""}`}
                    ></div>
                  {/if}
                </button>
              {/each}
            {/each}

            {#each WALL_ROWS as row}
              {@const rowIndex = wallAnchorRowIndex(row)}

              {#each WALL_COLS as col, colIndex}
                {@const horizontalKey = wallNotation(col, row, "h")}
                {@const verticalKey = wallNotation(col, row, "v")}
                {@const hasHorizontalWall = hasWall(col, row, "h")}
                {@const hasVerticalWall = hasWall(col, row, "v")}
                {@const horizontalLegal = isLegalWall(col, row, "h")}
                {@const verticalLegal = isLegalWall(col, row, "v")}

                <button
                  class={`wall-slot absolute rounded transition-colors duration-100 ${hasHorizontalWall ? `bg-amber-400 shadow-lg shadow-amber-500/20 ${latestPlacedWallKey === horizontalKey ? "wall-pop" : ""}` : "bg-transparent"} ${!hasHorizontalWall && canPlaceWalls && horizontalLegal ? "hover:bg-amber-500/30" : ""} ${hoveredWall === horizontalKey ? "bg-amber-400/50 ring-2 ring-amber-300" : ""}`}
                  style={horizontalWallStyle(colIndex, rowIndex)}
                  title={`Right click: place horizontal wall at ${horizontalKey}`}
                  aria-label={`Place horizontal wall at ${horizontalKey}`}
                  disabled={disabled ||
                    hasHorizontalWall ||
                    hasVerticalWall ||
                    !horizontalLegal}
                  on:click={(event) => event.preventDefault()}
                  on:contextmenu={(event) =>
                    handleWallSlotContextMenu(event, col, row, "h")}
                  on:mouseenter={() => (hoveredWall = horizontalKey)}
                  on:mouseleave={() => (hoveredWall = null)}
                ></button>

                <button
                  class={`wall-slot absolute rounded transition-colors duration-100 ${hasVerticalWall ? `bg-amber-400 shadow-lg shadow-amber-500/20 ${latestPlacedWallKey === verticalKey ? "wall-pop" : ""}` : "bg-transparent"} ${!hasVerticalWall && canPlaceWalls && verticalLegal ? "hover:bg-amber-500/30" : ""} ${hoveredWall === verticalKey ? "bg-amber-400/50 ring-2 ring-amber-300" : ""}`}
                  style={verticalWallStyle(colIndex, rowIndex)}
                  title={`Right click: place vertical wall at ${verticalKey}`}
                  aria-label={`Place vertical wall at ${verticalKey}`}
                  disabled={disabled ||
                    hasVerticalWall ||
                    hasHorizontalWall ||
                    !verticalLegal}
                  on:click={(event) => event.preventDefault()}
                  on:contextmenu={(event) =>
                    handleWallSlotContextMenu(event, col, row, "v")}
                  on:mouseenter={() => (hoveredWall = verticalKey)}
                  on:mouseleave={() => (hoveredWall = null)}
                ></button>
              {/each}
            {/each}
          </div>
        </div>

        {#if gameState.winner}
          <div
            class="absolute inset-0 z-50 flex items-center justify-center bg-black/70"
            transition:fade={{ duration: 1000 }}
          >
            <div class="animate-bounce text-center">
              <h2 class="mb-4 text-4xl font-bold text-white">Game ended!</h2>
              <p class="text-4xl font-bold text-white">
                Player {gameState.winner} is the winner!
              </p>
            </div>
          </div>
        {/if}
      </div>
    {/key}

    <div class="grid w-full max-w-185 gap-2 md:grid-cols-3">
      <div
        class="mono rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-400"
      >
        Current turn: Player {gameState.currentPlayer}
      </div>

      <div
        class="mono rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-400"
      >
        P1 walls: {gameState.players[0]?.wallsRemaining ?? 0} • P2 walls: {gameState
          .players[1]?.wallsRemaining ?? 0}
      </div>

      <div
        class="mono rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm {gameState.winner
          ? 'text-green-400'
          : 'text-zinc-400'}"
      >
        {#if gameState.winner}
          Winner: Player {gameState.winner}
        {:else}
          Legal moves: {gameState.legalMoves.join(", ") || "—"}
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .pawn {
    transition:
      transform 140ms ease-out,
      box-shadow 140ms ease-out,
      opacity 140ms ease-out;
  }

  .pawn:hover {
    transform: scale(1.06);
  }

  .wall-pop {
    animation: wall-pop 180ms ease-out;
  }

  @keyframes wall-pop {
    0% {
      opacity: 0;
      transform: scale(0.35);
    }

    70% {
      opacity: 1;
      transform: scale(1.12);
    }

    100% {
      opacity: 1;
      transform: scale(1);
    }
  }
</style>
