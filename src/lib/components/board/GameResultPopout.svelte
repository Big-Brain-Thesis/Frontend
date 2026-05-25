<script lang="ts">
  import { fade, scale } from "svelte/transition";
  import type { Player, PlayerColor } from "$lib/types/game";

  export let winner: Player;
  export let moveCount = 0;
  export let wallCount = 0;

  function accentClass(color: PlayerColor): string {
    switch (color) {
      case "blue":
        return "border-blue-500/40 bg-blue-500/10 text-blue-200";
      case "red":
        return "border-red-500/40 bg-red-500/10 text-red-200";
      case "green":
        return "border-green-500/40 bg-green-500/10 text-green-300";
      case "yellow":
        return "border-yellow-500/40 bg-yellow-500/10 text-yellow-300";
    }
  }
</script>

<div
  class="game-result-backdrop absolute inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-[2px]"
  transition:fade={{ duration: 180 }}
>
  <section
    class="app-elevated-shadow w-full max-w-90 rounded-lg border border-zinc-700 bg-zinc-900/95 p-5 text-center"
    role="status"
    aria-live="polite"
    transition:scale={{ duration: 180, start: 0.94 }}
  >
    <div
      class={`mono mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border text-lg font-bold ${accentClass(winner.color)}`}
    >
      P{winner.id}
    </div>

    <p class="mono text-[11px] uppercase tracking-wider text-zinc-500">
      Game ended
    </p>
    <h2 class="mt-1 text-2xl font-semibold text-zinc-100">
      Player {winner.id} wins
    </h2>
    <p class="mt-2 text-sm text-zinc-400">
      {winner.isAI ? "Bot" : "Human"} victory from {winner.position.col}{winner.position.row}
    </p>

    <div class="mt-5 grid grid-cols-2 gap-2 text-left">
      <div class="rounded border border-zinc-800 bg-zinc-950 p-3">
        <div class="mono text-[10px] uppercase tracking-wider text-zinc-500">
          Moves
        </div>
        <div class="mono mt-1 text-lg text-zinc-200">{moveCount}</div>
      </div>

      <div class="rounded border border-zinc-800 bg-zinc-950 p-3">
        <div class="mono text-[10px] uppercase tracking-wider text-zinc-500">
          Walls placed
        </div>
        <div class="mono mt-1 text-lg text-zinc-200">{wallCount}</div>
      </div>
    </div>
  </section>
</div>
