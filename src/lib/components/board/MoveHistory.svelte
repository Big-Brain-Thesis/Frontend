<script lang="ts">
  import type { Move } from '$lib/types/game';

  export let moves: Move[] = [];

  $: movePairs = Array.from({ length: Math.ceil(moves.length / 2) }, (_, index) => ({
    number: index + 1,
    player1: moves[index * 2] ?? null,
    player2: moves[index * 2 + 1] ?? null
  }));
</script>

<div class="rounded border border-zinc-800 bg-zinc-900 p-3">
  <h3 class="mono mb-2 text-xs uppercase tracking-wider text-zinc-400">Move History</h3>

  {#if moves.length === 0}
    <p class="mono text-xs text-zinc-600">No moves yet</p>
  {:else}
    <div class="max-h-[200px] space-y-1 overflow-auto pr-2 text-xs">
      {#each movePairs as pair}
        <div class="mono flex gap-2 text-zinc-300">
          <span class="w-6 text-zinc-500">{pair.number}.</span>
          <span class="w-16">{pair.player1?.notation ?? '...'}</span>
          <span class="w-16 text-zinc-400">{pair.player2?.notation ?? '...'}</span>
        </div>
      {/each}
    </div>
  {/if}
</div>
