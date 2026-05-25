<script lang="ts">
  import type { PlayerController } from '$lib/types/game';

  export let player1: PlayerController = 'human';
  export let player2: PlayerController = 'dionysus';
  export let eegEnabled = false;
  export let gameActive = false;
  export let disabled = false;
  export let botAutoplay = true;
  export let botSpeedMs = 400;
  export let canStepBot = false;
  export let botThinking = false;
  export let thinkingTimeMsP1 = 1000;
  export let thinkingTimeMsP2 = 1000;

  export let onNewGame: () => void = () => {};
  export let onReset: () => void = () => {};
  export let onPlayer1Change: (value: PlayerController) => void = () => {};
  export let onPlayer2Change: (value: PlayerController) => void = () => {};
  export let onEEGEnabledChange: (value: boolean) => void = () => {};
  export let onBotAutoplayChange: (value: boolean) => void = () => {};
  export let onBotSpeedChange: (value: number) => void = () => {};
  export let onStepBot: () => void = () => {};
  export let onThinkingTime1Change: (value: number) => void = () => {};
  export let onThinkingTime2Change: (value: number) => void = () => {};

  const controllers: Array<{ value: PlayerController; label: string }> = [
    { value: 'human', label: 'Human' },
    { value: 'dionysus', label: 'Dionysus bot' },
    { value: 'hermes', label: 'Hermes bot' }
  ];

  $: hasSelectedBot = player1 !== 'human' || player2 !== 'human';
</script>

<div class="space-y-3 rounded border border-zinc-800 bg-zinc-900 p-3">
  <div class="flex items-center justify-between gap-3">
    <h3 class="mono text-xs uppercase tracking-wider text-zinc-200">Session Controls</h3>
    {#if gameActive}
      <span class="mono rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-[10px] text-zinc-500">active</span>
    {/if}
  </div>

  <div class="grid gap-2 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
    <div class="space-y-1.5">
      <label class="mono text-[11px] uppercase tracking-wider text-zinc-400" for="player1">Player 1</label>
      <select
        id="player1"
        class="w-full rounded border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-200 outline-none ring-0"
        bind:value={player1}
        disabled={disabled}
        on:change={() => onPlayer1Change(player1)}
      >
        {#each controllers as controller}
          <option value={controller.value}>{controller.label}</option>
        {/each}
      </select>

      {#if player1 === 'hermes'}
        <div class="space-y-1.5 rounded border border-zinc-800 bg-zinc-950 p-2">
          <div class="mono flex items-center justify-between text-[11px] text-zinc-400">
            <label for="thinking-time-1">P1 think</label>
            <span>{(thinkingTimeMsP1 / 1000).toFixed(1)}s</span>
          </div>
          <input
            id="thinking-time-1"
            class="w-full"
            type="range"
            min="100"
            max="10000"
            step="100"
            value={thinkingTimeMsP1}
            disabled={disabled}
            on:input={(event) => onThinkingTime1Change(Number((event.currentTarget as HTMLInputElement).value))}
          />
        </div>
      {/if}
    </div>

    <div class="space-y-1.5">
      <label class="mono text-[11px] uppercase tracking-wider text-zinc-400" for="player2">Player 2</label>
      <select
        id="player2"
        class="w-full rounded border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-200 outline-none ring-0"
        bind:value={player2}
        disabled={disabled}
        on:change={() => onPlayer2Change(player2)}
      >
        {#each controllers as controller}
          <option value={controller.value}>{controller.label}</option>
        {/each}
      </select>

      {#if player2 === 'hermes'}
        <div class="space-y-1.5 rounded border border-zinc-800 bg-zinc-950 p-2">
          <div class="mono flex items-center justify-between text-[11px] text-zinc-400">
            <label for="thinking-time-2">P2 think</label>
            <span>{(thinkingTimeMsP2 / 1000).toFixed(1)}s</span>
          </div>
          <input
            id="thinking-time-2"
            class="w-full"
            type="range"
            min="100"
            max="10000"
            step="100"
            value={thinkingTimeMsP2}
            disabled={disabled}
            on:input={(event) => onThinkingTime2Change(Number((event.currentTarget as HTMLInputElement).value))}
          />
        </div>
      {/if}
    </div>
  </div>

  {#if hasSelectedBot}
  <details class="group rounded border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-300">
    <summary class="flex cursor-pointer list-none items-center justify-between gap-2">
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <label class="flex items-center gap-2" on:click|stopPropagation>
        <input
          type="checkbox"
          checked={botAutoplay}
          disabled={disabled}
          on:change={(event) => onBotAutoplayChange((event.currentTarget as HTMLInputElement).checked)}
        />
        <span class="mono">Autoplay bot moves</span>
      </label>

      <div class="flex items-center gap-2">
        <span class="mono text-[11px] text-zinc-500">
          {(botSpeedMs / 1000).toFixed(1)}s
        </span>

        <button
          class="mono rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disabled || !canStepBot || botThinking}
          on:click|preventDefault={onStepBot}
        >
          {botThinking ? 'Moving' : 'Step'}
        </button>

        <span
          class="mono text-[11px] text-zinc-500 transition-transform group-open:rotate-180"
          aria-hidden="true"
        >
          ▼
        </span>
      </div>
    </summary>

    <div class="mt-2 border-t border-zinc-800 pt-2">
      <label class="mono mb-1 flex items-center justify-between text-[11px] text-zinc-500" for="bot-speed">
        <span>Speed</span>
        <span>{botSpeedMs}ms</span>
      </label>

      <input
        id="bot-speed"
        class="w-full"
        type="range"
        min="100"
        max="1000"
        step="100"
        value={botSpeedMs}
        disabled={disabled}
        on:input={(event) => onBotSpeedChange(Number((event.currentTarget as HTMLInputElement).value))}
      />
    </div>
  </details>
{/if}
  <label class="flex items-center gap-2 rounded border border-zinc-800 bg-zinc-950 p-2.5 text-xs text-zinc-300">
    <input
      type="checkbox"
      checked={eegEnabled}
      disabled={disabled}
      on:change={(event) => onEEGEnabledChange((event.currentTarget as HTMLInputElement).checked)}
    />
    <span class="mono">Monitor EEG</span>
  </label>

  <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
    <button
      class={`mono rounded bg-blue-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 ${gameActive ? '' : 'sm:col-span-2 xl:col-span-1 2xl:col-span-2'}`}
      disabled={disabled}
      on:click={onNewGame}
    >
      New Game
    </button>

    {#if gameActive}
      <button
        class="mono rounded border border-zinc-700 px-3 py-2 text-xs text-zinc-300 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled}
        on:click={onReset}
      >
        Reset
      </button>
    {/if}
  </div>
</div>
