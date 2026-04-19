<script lang="ts">
  import type { GameState, Player, WallOrientation } from '$lib/types/game';
  import { formatSquare } from '$lib/utils/notation';
  import { fade } from 'svelte/transition';

  export let gameState: GameState | null = null;
  export let disabled = false;
  export let onMove: (notation: string) => void;

  const COLS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
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

  $: renderKey = gameState
    ? `${gameState.definedPosition ?? ''}-${gameState.moveHistory.length}-${gameState.currentPlayer}-${disabled ? 'disabled' : 'active'}`
    : 'empty';

  $: activePlayer =
    gameState?.players.find((player) => player.id === gameState.currentPlayer) ?? null;

  $: canPlaceWalls = !disabled && (activePlayer?.wallsRemaining ?? 0) > 0;

  $: playerMap = new Map<string, Player>(
    (gameState?.players ?? []).map((player) => [formatSquare(player.position), player])
  );

  $: legalMoveSet = new Set(gameState?.legalMoves ?? []);
  $: legalWallSet = new Set(gameState?.legalWalls ?? []);

  $: wallSet = new Set(
    (gameState?.walls ?? []).map((wall) => `${formatSquare(wall.position)}${wall.orientation}`)
  );

  function handleSquareClick(col: string, row: number) {
    if (disabled) return;
    onMove(`${col}${row}`);
  }

  function wallNotation(col: string, row: number, orientation: WallOrientation) {
    return `${col}${row}${orientation}`;
  }

  function handleWallSlotClick(col: string, row: number, orientation: WallOrientation) {
    if (!canPlaceWalls) return;
    onMove(wallNotation(col, row, orientation));
  }

  function getPlayerAtPosition(col: string, row: number): Player | undefined {
    return playerMap.get(`${col}${row}`);
  }

  function isLegalMove(col: string, row: number): boolean {
    return legalMoveSet.has(`${col}${row}`);
  }

  function isLegalWall(col: string, row: number, orientation: WallOrientation): boolean {
    return legalWallSet.has(`${col}${row}${orientation}`);
  }

  function hasWall(col: string, row: number, orientation: WallOrientation): boolean {
    return wallSet.has(`${col}${row}${orientation}`);
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
</script>

{#if !gameState}
  <div
    class="flex h-[560px] items-center justify-center rounded border border-zinc-800 bg-zinc-900"
  >
    <p class="mono text-sm text-zinc-500">No active game</p>
  </div>
{:else}
  <div class="flex flex-col items-center gap-5">
    <div class="flex flex-wrap items-center justify-center gap-3">
      <div
        class="mono rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-400"
      >
        Walls remaining: {activePlayer?.wallsRemaining ?? 0}
      </div>
    </div>

    {#key renderKey}
      <div
        class="relative"
        style={`width:${BOARD + LABEL * 2}px;height:${BOARD + LABEL * 2}px;`}
      >
        <div
          class="pointer-events-none absolute left-[26px] top-0 flex"
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
          class="pointer-events-none absolute left-0 top-[26px] flex flex-col"
          style={`height:${BOARD}px;`}
        >
          {#each DISPLAY_ROWS as row, rowIndex}
            <div
              class="flex items-center justify-center mono text-xs text-zinc-500"
              style={`width:${LABEL}px;height:${SQUARE}px;margin-bottom:${rowIndex < DISPLAY_ROWS.length - 1 ? SLOT : 0}px;`}
            >
              {row}
            </div>
          {/each}
        </div>

        <div
          class="absolute left-[26px] top-[26px] rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3 shadow-2xl shadow-black/30"
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
                  class={`absolute flex items-center justify-center rounded-lg border-2 transition-all ${player ? 'border-zinc-600' : 'border-zinc-800'} ${legal && !disabled ? 'cursor-pointer hover:border-blue-400 hover:bg-blue-500/10' : ''} ${hoveredSquare === squareKey && legal ? 'border-blue-300 bg-blue-500/10' : ''} ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
                  style={`left:${squareLeft(colIndex)}px;top:${squareTop(rowIndex)}px;width:${SQUARE}px;height:${SQUARE}px;`}
                  disabled={disabled || !legal}
                  title={`Move to ${squareKey}`}
                  on:mouseenter={() => legal && (hoveredSquare = squareKey)}
                  on:mouseleave={() => hoveredSquare === squareKey && (hoveredSquare = null)}
                  on:click={() => handleSquareClick(col, row)}
                >
                  <div
                    class={`absolute inset-0 rounded-md ${legal && !disabled ? 'bg-blue-500/6' : 'bg-transparent'}`}
                  ></div>

                  {#if player}
                    <div
                      class={`relative z-10 h-8 w-8 rounded-full border-2 shadow-lg ${player.color === 'blue' ? 'border-blue-300 bg-blue-500' : ''} ${player.color === 'red' ? 'border-red-300 bg-red-500' : ''} ${player.color === 'green' ? 'border-green-300 bg-green-500' : ''} ${player.color === 'yellow' ? 'border-yellow-300 bg-yellow-500' : ''}`}
                    ></div>
                  {/if}
                </button>
              {/each}
            {/each}

            {#each WALL_ROWS as row}
              {@const rowIndex = wallAnchorRowIndex(row)}

              {#each WALL_COLS as col, colIndex}
                {@const horizontalKey = wallNotation(col, row, 'h')}
                {@const verticalKey = wallNotation(col, row, 'v')}
                {@const hasHorizontalWall = hasWall(col, row, 'h')}
                {@const hasVerticalWall = hasWall(col, row, 'v')}
                {@const horizontalLegal = isLegalWall(col, row, 'h')}
                {@const verticalLegal = isLegalWall(col, row, 'v')}

                <button
                  class={`absolute rounded ${hasHorizontalWall ? 'bg-amber-400 shadow-lg shadow-amber-500/20' : 'bg-transparent'} ${horizontalLegal && canPlaceWalls ? 'cursor-pointer hover:bg-amber-500/20' : ''} ${hoveredWall === horizontalKey && horizontalLegal ? 'bg-amber-400/50 ring-2 ring-amber-300' : ''}`}
                  style={horizontalWallStyle(colIndex, rowIndex)}
                  title={horizontalLegal ? `Place horizontal wall at ${horizontalKey}` : `Illegal horizontal wall at ${horizontalKey}`}
                  disabled={disabled || !horizontalLegal}
                  on:click={() => handleWallSlotClick(col, row, 'h')}
                  on:mouseenter={() => horizontalLegal && (hoveredWall = horizontalKey)}
                  on:mouseleave={() => hoveredWall === horizontalKey && (hoveredWall = null)}
                ></button>

                <button
                  class={`absolute rounded ${hasVerticalWall ? 'bg-amber-400 shadow-lg shadow-amber-500/20' : 'bg-transparent'} ${verticalLegal && canPlaceWalls ? 'cursor-pointer hover:bg-amber-500/20' : ''} ${hoveredWall === verticalKey && verticalLegal ? 'bg-amber-400/50 ring-2 ring-amber-300' : ''}`}
                  style={verticalWallStyle(colIndex, rowIndex)}
                  title={verticalLegal ? `Place vertical wall at ${verticalKey}` : `Illegal vertical wall at ${verticalKey}`}
                  disabled={disabled || !verticalLegal}
                  on:click={() => handleWallSlotClick(col, row, 'v')}
                  on:mouseenter={() => verticalLegal && (hoveredWall = verticalKey)}
                  on:mouseleave={() => hoveredWall === verticalKey && (hoveredWall = null)}
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
              <h2 class="mb-4 text-4xl font-bold text-white">
                Game ended!
              </h2>
              <p class="text-4xl font-bold text-white">
                Player {gameState.winner} is the winner!
              </p>
            </div>
          </div>
        {/if}
      </div>
    {/key}

    <div class="grid w-full max-w-[740px] gap-2 md:grid-cols-3">
      <div
        class="mono rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-400"
      >
        Turn: Player {gameState.currentPlayer}
      </div>

      <div
        class="mono rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-400"
      >
        P1 walls: {gameState.players[0]?.wallsRemaining ?? 0} • P2 walls: {gameState.players[1]?.wallsRemaining ?? 0}
      </div>

      <div
        class="mono rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm {gameState.winner ? 'text-green-400' : 'text-zinc-400'}"
      >
        {#if gameState.winner}
          Winner: Player {gameState.winner}
        {:else}
          Legal moves: {gameState.legalMoves.join(', ')}
          <br />
          Legal walls: {gameState.legalWalls.length}
        {/if}
      </div>
    </div>
  </div>
{/if}