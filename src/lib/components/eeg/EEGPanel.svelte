<script lang="ts">
  import type { EEGState } from '$lib/types/eeg';
  import EEGGraph from '$lib/components/eeg/EEGGraph.svelte';

  export let eegState: EEGState;
  export let onReconnect: () => void;

  $: latestSample = eegState.samples.at(-1);

  function statusClass(status: EEGState['status']) {
    switch (status) {
      case 'connected':
        return 'text-green-400';
      case 'connecting':
      case 'reconnecting':
        return 'text-yellow-400';
      case 'error':
        return 'text-red-400';
      default:
        return 'text-zinc-500';
    }
  }
</script>

<div class="rounded border border-zinc-800 bg-zinc-900 p-4 space-y-4">
  <div class="flex items-center justify-between">
    <div>
      <h3 class="mono text-sm uppercase tracking-wider text-zinc-200">EEG Monitoring</h3>
      <p class="mt-1 text-xs text-zinc-500">Mock device stream for focus analysis workflow</p>
    </div>
    <div class={`mono text-xs ${statusClass(eegState.status)}`}>{eegState.status}</div>
  </div>

  {#if eegState.deviceName}
    <div class="space-y-1 text-xs">
      <div class="mono flex justify-between text-zinc-400">
        <span>Device</span>
        <span class="text-zinc-300">{eegState.deviceName}</span>
      </div>
      <div class="mono flex justify-between text-zinc-400">
        <span>Rate</span>
        <span class="text-zinc-300">{eegState.sampleRate} Hz</span>
      </div>
    </div>
  {/if}

  {#if latestSample && eegState.status === 'connected'}
    <div class="space-y-2">
      <div class="mono text-xs uppercase tracking-wider text-zinc-400">Current Values</div>
      <div class="grid grid-cols-2 gap-2 text-xs">
        <div class="rounded border border-zinc-800 bg-zinc-950 p-2">
          <div class="mono text-zinc-500">AF7</div>
          <div class="mono font-bold text-blue-400">{latestSample.channels.AF7.toFixed(4)}</div>
        </div>
        <div class="rounded border border-zinc-800 bg-zinc-950 p-2">
          <div class="mono text-zinc-500">AF8</div>
          <div class="mono font-bold text-blue-400">{latestSample.channels.AF8.toFixed(4)}</div>
        </div>
        <div class="rounded border border-zinc-800 bg-zinc-950 p-2">
          <div class="mono text-zinc-500">TP9</div>
          <div class="mono text-zinc-300">{latestSample.channels.TP9.toFixed(4)}</div>
        </div>
        <div class="rounded border border-zinc-800 bg-zinc-950 p-2">
          <div class="mono text-zinc-500">TP10</div>
          <div class="mono text-zinc-300">{latestSample.channels.TP10.toFixed(4)}</div>
        </div>
      </div>

      {#if latestSample.focusScore !== undefined}
        <div class="rounded border border-blue-900 bg-blue-950/30 p-2">
          <div class="flex items-center justify-between">
            <span class="mono text-xs text-blue-400">Focus Score</span>
            <span class="mono text-lg font-bold text-blue-300">{(latestSample.focusScore * 100).toFixed(0)}%</span>
          </div>
          <div class="mt-2 h-1 overflow-hidden rounded-full bg-zinc-800">
            <div class="h-full bg-blue-500 transition-all duration-300" style={`width:${latestSample.focusScore * 100}%`}></div>
          </div>
        </div>
      {/if}
    </div>
  {/if}

  {#if eegState.status === 'error' && eegState.error}
    <div class="rounded border border-red-900 bg-red-950/30 p-3">
      <div class="mono text-xs text-red-400">{eegState.error}</div>
      <button class="mono mt-3 w-full rounded border border-red-900 px-3 py-2 text-xs text-red-300 hover:bg-red-950/60" on:click={onReconnect}>
        Reconnect
      </button>
    </div>
  {/if}

  <EEGGraph samples={eegState.samples} />
</div>
