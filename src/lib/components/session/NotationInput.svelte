<script lang="ts">
  import { isValidNotation } from '$lib/utils/notation';

  export let disabled = false;
  export let onSubmit: (notation: string) => void;

  let notation = '';
  let error = '';

  function handleSubmit() {
    const value = notation.trim().toLowerCase();

    if (!value) {
      error = 'Enter a move like e2 or e3h';
      return;
    }

    if (!isValidNotation(value)) {
      error = 'Notation must look like e2, d5, e3h, or d6v';
      return;
    }

    error = '';
    onSubmit(value);
    notation = '';
  }
</script>

<div class="rounded border border-zinc-800 bg-zinc-900 p-4 space-y-3">
  <div>
    <h3 class="mono text-sm uppercase tracking-wider text-zinc-200">Manual Move Entry</h3>
    <p class="mt-1 text-xs text-zinc-500">
      Optional direct input. Examples: e2 for a pawn move, e3h for a wall.
    </p>
  </div>

  <div class="flex gap-2">
    <input
      class="mono flex-1 rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none"
      bind:value={notation}
      disabled={disabled}
      placeholder="e2 or e3h"
      on:keydown={(event) => event.key === 'Enter' && handleSubmit()}
    />
    <button
      class="mono rounded border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
      disabled={disabled}
      on:click={handleSubmit}
    >
      Submit
    </button>
  </div>

  {#if error}
    <p class="mono text-xs text-red-400">{error}</p>
  {/if}
</div>