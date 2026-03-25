<script lang="ts">
  import type { EEGChannel, EEGSample } from '$lib/types/eeg';

  export let samples: EEGSample[] = [];

  const width = 720;
  const height = 260;
  const padX = 16;
  const padY = 20;
  const channels: Array<{ key: EEGChannel; color: string; labelClass: string }> = [
    { key: 'AF7', color: '#3b82f6', labelClass: 'text-blue-500' },
    { key: 'AF8', color: '#8b5cf6', labelClass: 'text-purple-500' },
    { key: 'TP9', color: '#10b981', labelClass: 'text-emerald-500' },
    { key: 'TP10', color: '#f59e0b', labelClass: 'text-amber-500' }
  ];

  $: visibleSamples = samples.slice(-180);

  function clamp(value: number): number {
    return Math.max(0, Math.min(1, value));
  }

  function buildPath(channel: EEGChannel): string {
    if (visibleSamples.length === 0) return '';

    return visibleSamples
      .map((sample, index) => {
        const x = padX + (index / Math.max(visibleSamples.length - 1, 1)) * (width - padX * 2);
        const y = padY + (1 - clamp(sample.channels[channel])) * (height - padY * 2);
        return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  }
</script>

<div class="space-y-2">
  <div class="mono text-xs uppercase tracking-wider text-zinc-400">Live EEG Channels</div>
  <div class="rounded border border-zinc-800 bg-zinc-950 p-3 text-zinc-100">
    {#if samples.length === 0}
      <div class="flex h-64 items-center justify-center rounded border border-dashed border-zinc-800 bg-zinc-900/70">
        <p class="mono text-sm text-zinc-500">Waiting for EEG data...</p>
      </div>
    {:else}
      <svg viewBox={`0 0 ${width} ${height}`} class="h-64 w-full overflow-visible rounded bg-zinc-900">
        {#each Array.from({ length: 6 }) as _, index}
          <line
            x1={padX}
            y1={padY + (index / 5) * (height - padY * 2)}
            x2={width - padX}
            y2={padY + (index / 5) * (height - padY * 2)}
            stroke="#27272a"
            stroke-dasharray="3 4"
            stroke-width="1"
          />
        {/each}

        {#each channels as channel}
          <path
            d={buildPath(channel.key)}
            fill="none"
            stroke={channel.color}
            stroke-width={channel.key === 'AF7' || channel.key === 'AF8' ? 2.6 : 1.5}
            stroke-linecap="round"
            stroke-linejoin="round"
            opacity={channel.key === 'AF7' || channel.key === 'AF8' ? 1 : 0.75}
          />
        {/each}
      </svg>
    {/if}

    <div class="mt-3 flex flex-wrap justify-center gap-4 text-xs">
      {#each channels as channel}
        <div class="mono flex items-center gap-2 rounded border border-zinc-800 bg-zinc-900 px-2 py-1">
          <span class="inline-block h-3 w-3 rounded-full" style={`background:${channel.color}`}></span>
          <span class={channel.labelClass}>{channel.key}</span>
        </div>
      {/each}
    </div>
  </div>
</div>
