<script lang="ts">
  import { fade, scale } from "svelte/transition";
  import type { Player, PlayerColor } from "$lib/types/game";
  import type { GameFocusSummary } from "$lib/stores/focus";
  import type { CognitiveState } from "$lib/services/apiEEG";

  export let winner: Player;
  export let moveCount = 0;
  export let wallCount = 0;
  /** Per-game cognitive summary from the Muse backend, or null when no EEG data was captured. */
  export let focus: GameFocusSummary | null = null;

  type StateMeta = { label: string; bar: string };

  const STATE_ORDER: CognitiveState[] = [
    "strategic_thinking",
    "focused",
    "stressed",
    "relaxed",
    "unknown",
  ];

  const STATE_META: Record<CognitiveState, StateMeta> = {
    strategic_thinking: { label: "Strategic thinking", bar: "bg-emerald-500/70" },
    focused: { label: "Focused", bar: "bg-sky-500/70" },
    stressed: { label: "Stressed", bar: "bg-red-500/70" },
    relaxed: { label: "Relaxed", bar: "bg-amber-500/70" },
    unknown: { label: "Unknown", bar: "bg-zinc-600/70" },
  };

  $: byState = focus?.byState ?? null;
  $: totalSamples = byState
    ? STATE_ORDER.reduce((sum, state) => sum + (byState?.[state] ?? 0), 0)
    : 0;
  $: stateRows =
    byState && totalSamples > 0
      ? STATE_ORDER.filter((state) => byState[state] > 0).map((state) => ({
          state,
          label: STATE_META[state].label,
          bar: STATE_META[state].bar,
          pct: (byState[state] / totalSamples) * 100,
        }))
      : [];

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

    {#if stateRows.length}
      <div class="mt-2 rounded border border-zinc-800 bg-zinc-950 p-3 text-left">
        <div class="mono flex items-baseline justify-between">
          <span class="text-[10px] uppercase tracking-wider text-zinc-500">
            Cognitive state · Muse
          </span>
          <span class="text-[10px] text-zinc-600">{totalSamples} samples</span>
        </div>

        <div class="mt-2 space-y-2">
          {#each stateRows as row (row.state)}
            <div>
              <div class="mono flex items-baseline justify-between text-xs">
                <span class="text-zinc-300">{row.label}</span>
                <span class="text-zinc-400">{row.pct.toFixed(1)}%</span>
              </div>
              <div class="mt-1 h-1.5 w-full overflow-hidden rounded bg-zinc-800">
                <div
                  class={`h-full rounded transition-[width] ${row.bar}`}
                  style={`width: ${row.pct}%`}
                ></div>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </section>
</div>
