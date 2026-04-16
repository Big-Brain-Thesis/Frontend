<script lang="ts">
  import type { Opponent } from '$lib/types/game';

  export let opponent: Opponent = 'dionysus';
  export let eegEnabled = false;
  export let gameActive = false;
  export let disabled = false;
  export let onNewGame: () => void;
  export let onReset: () => void;
  export let onOpponentChange: (value: Opponent) => void;
  export let onEEGEnabledChange: (value: boolean) => void;
</script>

<div class="space-y-4 rounded border border-zinc-800 bg-zinc-900 p-4">
  <h3 class="mono text-sm uppercase tracking-wider text-zinc-200">Session Controls</h3>

  <div class="space-y-2">
    <label class="mono text-xs uppercase tracking-wider text-zinc-400" for="opponent">
      Opponent
    </label>

    <select
      id="opponent"
      class="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none ring-0"
      bind:value={opponent}
      disabled={disabled}
      on:change={() => onOpponentChange(opponent)}
    >
      <option value="human">Human</option>
      <option value="dionysus">Dionysus</option>
      <option value="hermes">Hermes</option>
    </select>
  </div>

  <label class="flex items-center gap-3 rounded border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-300">
    <input
      type="checkbox"
      checked={eegEnabled}
      disabled={disabled}
      on:change={(event) => onEEGEnabledChange((event.currentTarget as HTMLInputElement).checked)}
    />
    <span class="mono">Monitor brain activity (EEG)</span>
  </label>

  <div class="space-y-2">
    <button
      class="mono w-full rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      disabled={disabled}
      on:click={onNewGame}
    >
      New Game
    </button>

    {#if gameActive}
      <button
        class="mono w-full rounded border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled}
        on:click={onReset}
      >
        Reset
      </button>
    {/if}
  </div>
</div>