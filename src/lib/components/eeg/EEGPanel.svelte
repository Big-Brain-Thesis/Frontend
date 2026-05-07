<script lang="ts">
  import type { EEGState } from '$lib/types/eeg';
  import EEGGraph from '$lib/components/eeg/EEGGraph.svelte';
  import { reconnectEEG, startEEGMonitoring, stopEEGMonitoring } from '$lib/stores/eeg';

  export let eegState: EEGState;
  export let onReconnect: () => void | Promise<void> = () => reconnectEEG();

  let address = '';
  let backend = 'bleak';
  let busy = false;
  let showConnection = false;

  $: latestSample = eegState.samples.at(-1);
  $: sampleCount = eegState.samples.length;
  $: hasSamples = sampleCount > 0;
  $: isConnected = eegState.status === 'connected';
  $: isWorking = eegState.status === 'connecting' || eegState.status === 'reconnecting';
  $: isActive = eegState.enabled && eegState.status !== 'disconnected';
  $: isWaiting = eegState.enabled && !hasSamples && (isWorking || isConnected);
  $: isStreaming = isConnected && hasSamples;
  $: rateLabel = eegState.sampleRate ? `${eegState.sampleRate} Hz` : '— Hz';
  $: lastFrameAge = latestSample ? Math.max(0, Date.now() - latestSample.timestamp) : null;
  $: subtitle = isStreaming
    ? `Streaming ${sampleCount} frames · ${rateLabel}`
    : isWaiting
      ? 'Waiting for the first live EEG frame'
      : eegState.status === 'error'
        ? 'Connection error'
        : 'Muse 2 stream controls';

  function statusClass(status: EEGState['status']) {
    switch (status) {
      case 'connected':
        return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
      case 'connecting':
      case 'reconnecting':
        return 'border-blue-500/30 bg-blue-500/10 text-blue-300';
      case 'error':
        return 'border-red-500/40 bg-red-500/10 text-red-300';
      default:
        return 'border-zinc-700 bg-zinc-950 text-zinc-400';
    }
  }

  function frameAgeLabel(age: number | null): string {
    if (age === null) return 'no frames';
    if (age < 1000) return `${age} ms`;
    return `${(age / 1000).toFixed(1)} s`;
  }

  async function run(action: () => void | Promise<void>) {
    if (busy) return;
    busy = true;
    try {
      await action();
    } finally {
      busy = false;
    }
  }

  function startMuse() {
    return run(() =>
      startEEGMonitoring({
        address: address.trim() || undefined,
        backend: backend.trim() || 'bleak'
      })
    );
  }

  function startDemo() {
    return run(() => startEEGMonitoring({ simulate: true }));
  }

  function reconnect() {
    return run(onReconnect);
  }

  function disconnect() {
    return run(() => stopEEGMonitoring(true));
  }
</script>

<section class="rounded border border-zinc-800 bg-zinc-900/80 p-3 shadow-sm">
  <div class="mb-3 flex items-start justify-between gap-3">
    <div class="min-w-0">
      <h3 class="mono text-xs uppercase tracking-wider text-zinc-200">EEG Monitoring</h3>
      <p class="mt-1 truncate text-[11px] text-zinc-500">{subtitle}</p>
    </div>

    <span class={`mono shrink-0 rounded border px-2 py-1 text-[11px] ${statusClass(eegState.status)}`}>
      {eegState.status}
    </span>
  </div>

  {#if isWaiting}
    <div class="mb-3 rounded border border-blue-500/20 bg-blue-500/10 p-3">
      <div class="flex items-center gap-3">
        <div class="relative h-7 w-7 shrink-0">
          <div class="absolute inset-0 rounded-full border-2 border-blue-400/20"></div>
          <div class="absolute inset-0 animate-spin rounded-full border-2 border-blue-300 border-t-transparent"></div>
        </div>
        <div class="min-w-0">
          <div class="mono text-[11px] uppercase tracking-wider text-blue-300">Waiting for live frames</div>
          <div class="mt-1 text-[11px] leading-4 text-zinc-400">
            Backend connected. Graphs appear when TP9 / AF7 / AF8 / TP10 samples arrive.
          </div>
        </div>
      </div>
    </div>
  {/if}

  {#if eegState.status === 'error' && eegState.error}
    <div class="mb-3 rounded border border-red-500/30 bg-red-500/10 p-2">
      <div class="mono text-[11px] text-red-300">{eegState.error}</div>
    </div>
  {/if}

  <div class="mb-3 grid grid-cols-4 gap-2 rounded border border-zinc-800 bg-zinc-950 p-2">
    <button
      type="button"
      class="mono rounded border border-blue-500/30 bg-blue-500/10 px-2 py-2 text-[11px] text-blue-200 hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-40"
      disabled={busy || isActive}
      on:click={startMuse}
    >
      Start
    </button>

    <button
      type="button"
      class="mono rounded border border-purple-500/30 bg-purple-500/10 px-2 py-2 text-[11px] text-purple-200 hover:bg-purple-500/20 disabled:cursor-not-allowed disabled:opacity-40"
      disabled={busy || isActive}
      on:click={startDemo}
    >
      Demo
    </button>

    <button
      type="button"
      class="mono rounded border border-zinc-700 bg-zinc-900 px-2 py-2 text-[11px] text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
      disabled={busy}
      on:click={reconnect}
    >
      Reconnect
    </button>

    <button
      type="button"
      class="mono rounded border border-red-500/30 bg-red-500/10 px-2 py-2 text-[11px] text-red-200 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
      disabled={busy || !isActive}
      on:click={disconnect}
    >
      Stop
    </button>
  </div>

  <button
    type="button"
    class="mono mb-2 flex w-full items-center justify-between rounded border border-zinc-800 bg-zinc-950 px-2 py-2 text-[11px] text-zinc-400 hover:text-zinc-200"
    on:click={() => (showConnection = !showConnection)}
  >
    <span>Connection options</span>
    <span>{showConnection ? 'hide' : 'show'}</span>
  </button>

  {#if showConnection}
    <div class="mb-3 grid gap-2 rounded border border-zinc-800 bg-zinc-950 p-2">
      <input
        class="mono w-full rounded border border-zinc-700 bg-black px-2 py-2 text-[11px] text-zinc-300 placeholder:text-zinc-600 disabled:opacity-40"
        bind:value={address}
        placeholder="Muse address optional"
        disabled={busy || isActive}
      />

      <select
        class="mono w-full rounded border border-zinc-700 bg-black px-2 py-2 text-[11px] text-zinc-300 disabled:opacity-40"
        bind:value={backend}
        disabled={busy || isActive}
      >
        <option value="bleak">Bluetooth backend: bleak</option>
        <option value="gatt">Bluetooth backend: gatt</option>
      </select>
    </div>
  {/if}

  <div class="mono mb-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-zinc-500">
    <div>frames <span class="text-zinc-300">{sampleCount}</span></div>
    <div>rate <span class="text-zinc-300">{rateLabel}</span></div>
    <div>last <span class="text-zinc-300">{frameAgeLabel(lastFrameAge)}</span></div>
    <div>device <span class="text-zinc-300">{eegState.deviceName ?? 'Muse 2 API'}</span></div>
  </div>

  <EEGGraph samples={eegState.samples} loading={isWaiting || isWorking} status={eegState.status} />
</section>
