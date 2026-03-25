<script lang="ts">
  import type { GameState } from '$lib/types/game';

  export let gameState: GameState | null = null;

  let isExpanded = false;

  $: positionString = gameState
    ? `${gameState.players.map((player) => `${player.position.col}${player.position.row}`).join(' ')} / ${gameState.walls.length ? gameState.walls.map((wall) => `${wall.position.col}${wall.position.row}${wall.orientation}`).join(' ') : '-'} / ${gameState.currentPlayer} / ${gameState.players.map((player) => player.wallsRemaining).join(' ')}`
    : '';

  $: moveList = gameState ? gameState.moveHistory.map((move) => move.notation).join(' ') : '';

  async function copyText(value: string) {
    await navigator.clipboard.writeText(value);
  }

  function exportSession() {
    if (!gameState) return;

    const data = {
      sessionId: gameState.sessionId,
      mode: gameState.mode,
      difficulty: gameState.difficulty,
      moveHistory: gameState.moveHistory,
      walls: gameState.walls,
      players: gameState.players,
      timestamp: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bigbrain-session-${gameState.sessionId}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
</script>

{#if gameState}
  <div class="rounded border border-zinc-800 bg-zinc-900">
    <button
      class="flex w-full items-center justify-between px-4 py-3 text-left"
      on:click={() => (isExpanded = !isExpanded)}
    >
      <div>
        <h3 class="mono text-sm uppercase tracking-wider text-zinc-200">Advanced Panel</h3>
        <p class="mt-1 text-xs text-zinc-500">Position strings, move export, session dump</p>
      </div>
      <span class="text-zinc-400">{isExpanded ? '−' : '+'}</span>
    </button>

    {#if isExpanded}
      <div class="space-y-4 border-t border-zinc-800 p-4">
        <div class="space-y-2">
          <div class="mono text-xs uppercase tracking-wider text-zinc-500">Position String</div>
          <div class="mono rounded border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-300 break-all">{positionString}</div>
          <button class="mono rounded border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800" on:click={() => copyText(positionString)}>
            Copy Position
          </button>
        </div>

        <div class="space-y-2">
          <div class="mono text-xs uppercase tracking-wider text-zinc-500">Move List</div>
          <div class="mono rounded border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-300 break-all">{moveList || 'No moves yet'}</div>
          <button class="mono rounded border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800" on:click={() => copyText(moveList)}>
            Copy Moves
          </button>
        </div>

        <div class="space-y-2">
          <div class="mono text-xs uppercase tracking-wider text-zinc-500">Metadata</div>
          <div class="grid gap-2 text-xs md:grid-cols-2">
            <div class="rounded border border-zinc-800 bg-zinc-950 p-3 text-zinc-400">Mode: <span class="text-zinc-200">{gameState.mode}</span></div>
            <div class="rounded border border-zinc-800 bg-zinc-950 p-3 text-zinc-400">Difficulty: <span class="text-zinc-200">{gameState.difficulty}</span></div>
            <div class="rounded border border-zinc-800 bg-zinc-950 p-3 text-zinc-400">Board size: <span class="text-zinc-200">{gameState.boardSize}×{gameState.boardSize}</span></div>
            <div class="rounded border border-zinc-800 bg-zinc-950 p-3 text-zinc-400">Winner: <span class="text-zinc-200">{gameState.winner ?? '—'}</span></div>
          </div>
        </div>

        <button class="mono w-full rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700" on:click={exportSession}>
          Export Session JSON
        </button>
      </div>
    {/if}
  </div>
{/if}
