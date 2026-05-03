<script lang="ts">
  import type { PlayerController } from '$lib/types/game';
  import type { EEGProvider } from '$lib/types/eeg';

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

  export let onNewGame: () => void;
  export let onReset: () => void;
  export let onPlayer1Change: (value: PlayerController) => void;
  export let onPlayer2Change: (value: PlayerController) => void;
  export let onEEGEnabledChange: (value: boolean) => void;
  export let eegDeviceType: EEGProvider = 'mock';
  export let onEEGDeviceTypeChange: (value: EEGProvider) => void;
  export let onBotAutoplayChange: (value: boolean) => void;
  export let onBotSpeedChange: (value: number) => void;
  export let onStepBot: () => void;
  export let onThinkingTime1Change: (value: number) => void;
  export let onThinkingTime2Change: (value: number) => void;

  const controllers: Array<{ value: PlayerController; label: string }> = [
    { value: 'human', label: 'Human' },
    { value: 'dionysus', label: 'Dionysus bot' },
    { value: 'hermes', label: 'Hermes bot' }
  ];
</script>

<div class="space-y-4 rounded border border-zinc-800 bg-zinc-900 p-4">
  <h3 class="mono text-sm uppercase tracking-wider text-zinc-200">Session Controls</h3>

  <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
    <div class="space-y-2">
      <label class="mono text-xs uppercase tracking-wider text-zinc-400" for="player1">
        Player 1
      </label>

      <select
        id="player1"
        class="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none ring-0"
        bind:value={player1}
        disabled={disabled}
        on:change={() => onPlayer1Change(player1)}
      >
        {#each controllers as controller}
          <option value={controller.value}>{controller.label}</option>
        {/each}
      </select>

      {#if player1 === 'hermes'}
        <div class="space-y-2 rounded border border-zinc-800 bg-zinc-950 p-3">
          <div class="mono flex items-center justify-between text-xs text-zinc-400">
            <label for="thinking-time-1">P1 thinking time</label>
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
          <p class="mono text-[11px] text-zinc-500">Maximum time for Player 1 AI to think per move.</p>
        </div>
      {/if}
    </div>

    <div class="space-y-2">
      <label class="mono text-xs uppercase tracking-wider text-zinc-400" for="player2">
        Player 2
      </label>

      <select
        id="player2"
        class="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none ring-0"
        bind:value={player2}
        disabled={disabled}
        on:change={() => onPlayer2Change(player2)}
      >
        {#each controllers as controller}
          <option value={controller.value}>{controller.label}</option>
        {/each}
      </select>

      {#if player2 === 'hermes'}
        <div class="space-y-2 rounded border border-zinc-800 bg-zinc-950 p-3">
          <div class="mono flex items-center justify-between text-xs text-zinc-400">
            <label for="thinking-time-2">P2 thinking time</label>
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
          <p class="mono text-[11px] text-zinc-500">Maximum time for Player 2 AI to think per move.</p>
        </div>
      {/if}
    </div>
  </div>

  <div class="space-y-3 rounded border border-zinc-800 bg-zinc-950 p-3">
    <label class="flex items-center gap-3 text-sm text-zinc-300">
      <input
        type="checkbox"
        checked={botAutoplay}
        disabled={disabled}
        on:change={(event) => onBotAutoplayChange((event.currentTarget as HTMLInputElement).checked)}
      />
      <span class="mono">Autoplay bot turns</span>
    </label>

    <div class="space-y-2">
      <div class="mono flex items-center justify-between text-xs text-zinc-400">
        <label for="bot-speed">Bot speed</label>
        <span>{(botSpeedMs / 1000).toFixed(1)}s / move</span>
      </div>
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
      <p class="mono text-[11px] text-zinc-500">Arrow Up = faster, Arrow Down = slower.</p>
    </div>

    <button
      class="mono w-full rounded border border-zinc-700 px-3 py-2 text-xs text-zinc-300 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
      disabled={disabled || !canStepBot || botThinking}
      on:click={onStepBot}
    >
      {botThinking ? 'Bot moving...' : 'Step bot once'}
    </button>
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

  <div class="space-y-3 rounded border border-zinc-800 bg-zinc-950 p-3">
    <label class="mono text-xs uppercase tracking-wider text-zinc-400" for="eeg-device-type">
      EEG source
    </label>
    <select
      id="eeg-device-type"
      class="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none ring-0"
      bind:value={eegDeviceType}
      disabled={disabled}
      on:change={() => onEEGDeviceTypeChange(eegDeviceType)}
    >
      <option value="mock">Mock EEG stream</option>
      <option value="muse2">Muse 2 (BLE)</option>
    </select>
    <p class="mono text-[11px] text-zinc-500">
      Choose mock data for offline testing or Muse 2 when your headset is available. Web Bluetooth is required for Muse 2.
    </p>
  </div>

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