<script lang="ts">
  import type { EEGState } from "$lib/types/eeg";
  import EEGGraph from "$lib/components/eeg/EEGGraph.svelte";
  import {
    reconnectEEG,
    startEEGMonitoring,
    stopEEGMonitoring,
  } from "$lib/stores/eeg";

  export let eegState: EEGState;
  export let onReconnect: () => void | Promise<void> = () => reconnectEEG();

  let busy = false;

  $: latestSample = eegState.samples.at(-1);
  $: sampleCount = eegState.samples.length;
  $: hasSamples = sampleCount > 0;
  $: isConnected = eegState.status === "connected";
  $: isWorking =
    eegState.status === "connecting" || eegState.status === "reconnecting";
  $: isActive = eegState.enabled && eegState.status !== "disconnected";
  $: isWaiting = eegState.enabled && !hasSamples && (isWorking || isConnected);
  $: isStreaming = isConnected && hasSamples;
  $: rateLabel = eegState.sampleRate ? `${eegState.sampleRate} Hz` : "— Hz";
  $: lastFrameAge = latestSample
    ? Math.max(0, Date.now() - latestSample.timestamp)
    : null;
  $: subtitle = isStreaming
    ? `Streaming ${sampleCount} frames · ${rateLabel}`
    : isWaiting
      ? "Waiting for the first live EEG frame"
      : eegState.status === "error"
        ? "Connection error"
        : "Muse 2 stream controls";

  function statusClass(status: EEGState["status"]): string {
    switch (status) {
      case "connected":
        return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
      case "connecting":
      case "reconnecting":
        return "border-blue-500/30 bg-blue-500/10 text-blue-300";
      case "error":
        return "border-red-500/40 bg-red-500/10 text-red-300";
      default:
        return "border-zinc-700 bg-zinc-950 text-zinc-400";
    }
  }

  function frameAgeLabel(age: number | null): string {
    if (age === null) return "no frames";
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
    return run(() => startEEGMonitoring());
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

<section class="w-full min-w-0 overflow-hidden rounded border border-zinc-800 bg-zinc-900/80 p-3 shadow-sm">
  <div class="mb-3 flex min-w-0 items-start justify-between gap-3">
    <div class="min-w-0 overflow-hidden">
      <h3 class="mono truncate text-xs uppercase tracking-wider text-zinc-200">
        EEG Monitoring
      </h3>
      <p class="mt-1 truncate text-[11px] text-zinc-500">{subtitle}</p>
    </div>

    <span
      class={`mono max-w-[42%] shrink-0 overflow-hidden truncate whitespace-nowrap rounded border px-2 py-1 text-[11px] ${statusClass(eegState.status)}`}
      title={eegState.status}
    >
      {eegState.status}
    </span>
  </div>

  {#if isWaiting}
    <div class="mb-3 rounded border border-blue-500/20 bg-blue-500/10 p-3">
      <div class="flex min-w-0 items-center gap-3">
        <div class="relative h-7 w-7 shrink-0">
          <div class="absolute inset-0 rounded-full border-2 border-blue-400/20"></div>
          <div
            class="absolute inset-0 animate-spin rounded-full border-2 border-blue-300 border-t-transparent"
          ></div>
        </div>

        <div class="min-w-0 overflow-hidden">
          <div class="mono truncate text-[11px] uppercase tracking-wider text-blue-300">
            Waiting for live frames
          </div>
          <div class="mt-1 text-[11px] leading-4 text-zinc-400">
            Backend connected. Graphs appear when TP9 / AF7 / AF8 / TP10
            samples arrive.
          </div>
        </div>
      </div>
    </div>
  {/if}

  {#if eegState.status === "error" && eegState.error}
    <div class="mb-3 overflow-hidden rounded border border-red-500/30 bg-red-500/10 p-2">
      <div class="mono overflow-hidden text-ellipsis break-words text-[11px] text-red-300">
        {eegState.error}
      </div>
    </div>
  {/if}

    <div
    class="mb-3 grid min-w-0 grid-cols-4 gap-1 overflow-hidden rounded border border-zinc-800 bg-zinc-950 p-1"
  >
    <button
      type="button"
      class="mono block h-9 min-w-0 max-w-full overflow-hidden rounded border border-blue-500/30 bg-blue-500/10 px-0 text-center text-[6px] leading-none tracking-[-0.08em] text-blue-200 hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-40"
      disabled={busy || isActive}
      on:click={startMuse}
      title="Start"
    >
      <span class="block min-w-0 overflow-hidden truncate whitespace-nowrap">
        Start
      </span>
    </button>

    <button
      type="button"
      class="mono block h-9 min-w-0 max-w-full overflow-hidden rounded border border-purple-500/30 bg-purple-500/10 px-0 text-center text-[6px] leading-none tracking-[-0.08em] text-purple-200 hover:bg-purple-500/20 disabled:cursor-not-allowed disabled:opacity-40"
      disabled={busy || isActive}
      on:click={startDemo}
      title="Demo"
    >
      <span class="block min-w-0 overflow-hidden truncate whitespace-nowrap">
        Demo
      </span>
    </button>

    <button
      type="button"
      class="mono block h-9 min-w-0 max-w-full overflow-hidden rounded border border-zinc-700 bg-zinc-900 px-0 text-center text-[6px] leading-none tracking-[-0.08em] text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
      disabled={busy}
      on:click={reconnect}
      title="Reconnect"
      aria-label="Reconnect"
    >
      <span class="block min-w-0 overflow-hidden truncate whitespace-nowrap">
        Reconnect
      </span>
    </button>

    <button
      type="button"
      class="mono block h-9 min-w-0 max-w-full overflow-hidden rounded border border-red-500/30 bg-red-500/10 px-0 text-center text-[6px] leading-none tracking-[-0.08em] text-red-200 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
      disabled={busy || !isActive}
      on:click={disconnect}
      title="Stop"
    >
      <span class="block min-w-0 overflow-hidden truncate whitespace-nowrap">
        Stop
      </span>
    </button>
  </div>

  <div
    class="mono mb-3 grid min-w-0 grid-cols-2 gap-x-3 gap-y-1 overflow-hidden text-[11px] text-zinc-500"
  >
    <div class="min-w-0 overflow-hidden truncate">
      frames <span class="text-zinc-300">{sampleCount}</span>
    </div>
    <div class="min-w-0 overflow-hidden truncate">
      rate <span class="text-zinc-300">{rateLabel}</span>
    </div>
    <div class="min-w-0 overflow-hidden truncate">
      last <span class="text-zinc-300">{frameAgeLabel(lastFrameAge)}</span>
    </div>
    <div class="min-w-0 overflow-hidden truncate">
      device
      <span class="text-zinc-300">{eegState.deviceName ?? "Muse 2 API"}</span>
    </div>
  </div>

  <EEGGraph
    samples={eegState.samples}
    loading={isWaiting || isWorking}
    status={eegState.status}
  />
</section>