<script lang="ts">
  import type { GameState, ReplayState, SavedGameSummary } from '$lib/types/game';

  export let gameState: GameState | null = null;
  export let savedGames: SavedGameSummary[] = [];
  export let replayState: ReplayState;
  export let disabled = false;

  export let onSave: () => void;
  export let onRefresh: () => void;
  export let onLoad: (id: string) => void;
  export let onReplayStep: (delta: number) => void;
  export let onReplayExit: () => void;

  let selectedSaveId = '';

  $: if (!selectedSaveId && savedGames.length > 0) {
    selectedSaveId = savedGames[0].id;
  }

  function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleString();
  }

  function formatProfiles(summary: SavedGameSummary): string {
    const [p1, p2] = summary.playerProfiles;
    return `P1 ${p1 ?? 'unknown'} vs P2 ${p2 ?? 'unknown'}`;
  }
</script>

<div class="space-y-4 rounded border border-zinc-800 bg-zinc-900 p-4">
  <div>
    <h3 class="mono text-sm uppercase tracking-wider text-zinc-200">Save / Load</h3>
    <p class="mt-1 text-xs text-zinc-500">
      Saves are written by the Rust server into the local saved_games folder.
    </p>
  </div>

  <div class="grid gap-2 md:grid-cols-2 xl:grid-cols-1">
    <button
      class="mono rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
      disabled={disabled || !gameState}
      on:click={onSave}
    >
      Save game
    </button>

    <button
      class="mono rounded border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
      disabled={disabled}
      on:click={onRefresh}
    >
      Load list
    </button>
  </div>

  <div class="space-y-2">
    {#if savedGames.length === 0}
      <div class="mono rounded border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-500">
        No saved games loaded.
      </div>
    {:else}
      <select
        class="mono w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 outline-none"
        bind:value={selectedSaveId}
        disabled={disabled}
      >
        {#each savedGames as save}
          <option value={save.id}>
            {formatDate(save.savedAt)} · {save.moveCount} moves · {formatProfiles(save)}
          </option>
        {/each}
      </select>

      <button
        class="mono w-full rounded border border-blue-700 bg-blue-950/30 px-4 py-2 text-sm text-blue-200 transition hover:bg-blue-900/40 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled || !selectedSaveId}
        on:click={() => onLoad(selectedSaveId)}
      >
        Load selected game
      </button>
    {/if}
  </div>

  {#if replayState.active}
    <div class="space-y-3 rounded border border-amber-700/50 bg-amber-950/20 p-3">
      <div class="mono flex items-center justify-between text-xs text-amber-200">
        <span>Replay</span>
        <span>
          {replayState.index} / {Math.max(0, replayState.states.length - 1)}
        </span>
      </div>

      <input
        class="w-full"
        type="range"
        min="0"
        max={Math.max(0, replayState.states.length - 1)}
        step="1"
        value={replayState.index}
        on:input={(event) => onReplayStep(Number((event.currentTarget as HTMLInputElement).value) - replayState.index)}
      />

      <div class="grid grid-cols-3 gap-2">
        <button
          class="mono rounded border border-zinc-700 px-3 py-2 text-xs text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-50"
          disabled={replayState.index <= 0}
          on:click={() => onReplayStep(-1)}
        >
          ← Prev
        </button>

        <button
          class="mono rounded border border-zinc-700 px-3 py-2 text-xs text-zinc-300 transition hover:bg-zinc-800"
          on:click={onReplayExit}
        >
          Exit
        </button>

        <button
          class="mono rounded border border-zinc-700 px-3 py-2 text-xs text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-50"
          disabled={replayState.index >= replayState.states.length - 1}
          on:click={() => onReplayStep(1)}
        >
          Next →
        </button>
      </div>

      <p class="mono text-[11px] text-zinc-500">Arrow Left / Arrow Right also steps through replay.</p>
    </div>
  {/if}
</div>