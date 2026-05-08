<script lang="ts">
  import type {
    EEGChannel,
    EEGConnectionStatus,
    EEGSample,
  } from "$lib/types/eeg";

  export let samples: EEGSample[] = [];
  export let loading = false;
  export let status: EEGConnectionStatus = "disconnected";

  type Series = {
    key: EEGChannel;
    color: string;
    textClass: string;
  };

  type GraphConfig = {
    title: string;
    subtitle: string;
    series: Series[];
  };

  type Range = {
    min: number;
    max: number;
    span: number;
    zeroY: number;
  };

  type GraphLine = Series & {
    d: string;
    latest: number;
  };

  type GraphView = GraphConfig & {
    range: Range;
    paths: GraphLine[];
  };

  const width = 760;
  const height = 180;
  const padX = 18;
  const padTop = 18;
  const padBottom = 24;
  const maxVisibleSamples = 240;

  const allChannels: EEGChannel[] = ["TP9", "AF7", "AF8", "TP10"];

  const graphConfigs: GraphConfig[] = [
    {
      title: "Focus channels",
      subtitle: "AF7 + AF8 frontal signal",
      series: [
        { key: "AF7", color: "#60a5fa", textClass: "text-blue-300" },
        { key: "AF8", color: "#a78bfa", textClass: "text-violet-300" },
      ],
    },
    {
      title: "Movement channels",
      subtitle: "TP9 + TP10 temporal signal",
      series: [
        { key: "TP9", color: "#34d399", textClass: "text-emerald-300" },
        { key: "TP10", color: "#fbbf24", textClass: "text-amber-300" },
      ],
    },
  ];

  $: visibleSamples = samples.slice(-maxVisibleSamples);
  $: latestSample = visibleSamples[visibleSamples.length - 1];
  $: totalAbsMax = getTotalAbsMax(visibleSamples);
  $: flatZero = visibleSamples.length > 8 && totalAbsMax === 0;
  $: graphViews = buildGraphViews(graphConfigs, visibleSamples, latestSample);
  $: frameLabel =
    visibleSamples.length === 1 ? "1 frame" : `${visibleSamples.length} frames`;
  $: sourceLabel = latestSample?.source ?? "channels";

  function sampleValue(sample: EEGSample, channel: EEGChannel): number {
    const n = Number(sample.channels[channel]);
    return Number.isFinite(n) ? n : 0;
  }

  function getTotalAbsMax(displaySamples: EEGSample[]): number {
    let max = 0;

    for (const sample of displaySamples) {
      for (const channel of allChannels) {
        max = Math.max(max, Math.abs(sampleValue(sample, channel)));
      }
    }

    return max;
  }

  function valuesFor(
    channel: EEGChannel,
    displaySamples: EEGSample[],
  ): number[] {
    return displaySamples.map((sample) => sampleValue(sample, channel));
  }

  function combinedValues(
    displaySamples: EEGSample[],
    series: Series[],
  ): number[] {
    return series.flatMap((item) => valuesFor(item.key, displaySamples));
  }

  function getRange(values: number[]): Range {
    const finite = values.filter(Number.isFinite);

    if (finite.length === 0) {
      return {
        min: -1,
        max: 1,
        span: 2,
        zeroY: 0.5,
      };
    }

    let min = Math.min(...finite);
    let max = Math.max(...finite);

    if (min === max) {
      const base = Math.max(Math.abs(min), 1e-9);
      min -= base;
      max += base;
    }

    const span = max - min;
    const largest = Math.max(Math.abs(max), Math.abs(min), 1e-9);
    const padding = Math.max(span * 0.18, largest * 0.08, 1e-9);

    min -= padding;
    max += padding;

    const finalSpan = max - min || 1;
    const zeroY = 1 - (0 - min) / finalSpan;

    return {
      min,
      max,
      span: finalSpan,
      zeroY: Math.max(0, Math.min(1, zeroY)),
    };
  }

  function buildPath(values: number[], range: Range): string {
    if (values.length === 0) return "";

    const graphWidth = width - padX * 2;
    const graphHeight = height - padTop - padBottom;

    return values
      .map((value, index) => {
        const x = padX + (index / Math.max(values.length - 1, 1)) * graphWidth;
        const normalized = (value - range.min) / range.span;
        const y = padTop + (1 - normalized) * graphHeight;

        return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");
  }

  function buildGraphViews(
    configs: GraphConfig[],
    displaySamples: EEGSample[],
    latest: EEGSample | undefined,
  ): GraphView[] {
    return configs.map((graph) => {
      const range = getRange(combinedValues(displaySamples, graph.series));

      return {
        ...graph,
        range,
        paths: graph.series.map((line) => {
          const values = valuesFor(line.key, displaySamples);

          return {
            ...line,
            latest: latest ? sampleValue(latest, line.key) : 0,
            d: buildPath(values, range),
          };
        }),
      };
    });
  }

  function formatNumber(n: number | undefined): string {
    if (n === undefined || !Number.isFinite(n)) return "—";
    if (n === 0) return "0";

    const abs = Math.abs(n);

    if (abs < 0.001 || abs >= 100000) return n.toExponential(2);
    if (abs < 1) return n.toFixed(5);
    if (abs < 100) return n.toFixed(3);

    return n.toFixed(1);
  }
</script>

<div class="space-y-3">
  <div
    class="mono flex items-center justify-between text-[11px] uppercase tracking-wider text-zinc-500"
  >
    <span>Live EEG graphs</span>
    <span>{frameLabel} · {sourceLabel}</span>
  </div>

  {#if visibleSamples.length === 0}
    <div class="rounded border border-dashed border-zinc-800 bg-zinc-950 p-5">
      <div
        class="flex min-h-32 flex-col items-center justify-center gap-3 text-center"
      >
        <div class="flex h-11 items-end gap-1.5">
          <span class="h-4 w-2 animate-pulse rounded bg-blue-400/50"></span>
          <span
            class="h-8 w-2 animate-pulse rounded bg-violet-400/60 [animation-delay:120ms]"
          ></span>
          <span
            class="h-6 w-2 animate-pulse rounded bg-emerald-400/50 [animation-delay:240ms]"
          ></span>
          <span
            class="h-10 w-2 animate-pulse rounded bg-amber-400/60 [animation-delay:360ms]"
          ></span>
        </div>

        <div>
          <p class="mono text-[11px] uppercase tracking-wider text-zinc-300">
            {loading ? "Waiting for Muse data" : "No EEG frames"}
          </p>
          <p class="mt-1 text-[11px] text-zinc-500">
            {loading
              ? "The stream is connected. Graphs draw when samples arrive."
              : "Start Muse or demo mode."}
          </p>
          <p class="mono mt-1 text-[10px] text-zinc-600">status: {status}</p>
        </div>
      </div>
    </div>
  {/if}

  {#if visibleSamples.length > 0 && loading}
      <div class="rounded border border-blue-500/20 bg-blue-500/10 px-3 py-2">
        <div class="mono flex items-center gap-2 text-[11px] text-blue-300">
          <span class="h-2 w-2 animate-pulse rounded-full bg-blue-300"></span>
          Reconnecting. Existing graph data is kept visible.
        </div>
      </div>
  {/if}

  {#if flatZero}
      <div
        class="rounded border border-yellow-500/30 bg-yellow-500/10 px-3 py-2"
      >
        <p class="mono text-[11px] text-yellow-300">
          Frames are arriving, but all channel values are exactly zero. The
          graph is live; the reader is sending flat data.
        </p>
      </div>
  {/if}

  <div class="space-y-3">
      {#each graphViews as graph}
        <section class="rounded border border-zinc-800 bg-zinc-950 p-3">
          <div class="mb-2 flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div
                class="mono text-[11px] uppercase tracking-wider text-zinc-300"
              >
                {graph.title}
              </div>
              <div class="mt-0.5 text-[11px] text-zinc-500">
                {graph.subtitle}
              </div>
              <div class="mono mt-1 text-[10px] text-zinc-600">
                y-axis: adaptive raw · {formatNumber(graph.range.min)} → {formatNumber(
                  graph.range.max,
                )}
              </div>
            </div>

            <div class="flex shrink-0 flex-col gap-1">
              {#each graph.paths as line}
                <div
                  class="mono rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-[10px]"
                >
                  <span class={line.textClass}>{line.key}</span>
                  <span class="ml-1 text-zinc-300"
                    >{formatNumber(line.latest)}</span
                  >
                </div>
              {/each}
            </div>
          </div>

          <svg
            viewBox={`0 0 ${width} ${height}`}
            class="h-44 w-full rounded bg-zinc-900/80"
          >
            <rect x="0" y="0" {width} {height} fill="#09090b" rx="8" />

            {#each [0, 1, 2, 3] as index}
              <line
                x1={padX}
                y1={padTop + (index / 3) * (height - padTop - padBottom)}
                x2={width - padX}
                y2={padTop + (index / 3) * (height - padTop - padBottom)}
                stroke="#27272a"
                stroke-dasharray="3 5"
                stroke-width="1"
              />
            {/each}

            {#if graph.range.min < 0 && graph.range.max > 0}
              <line
                x1={padX}
                y1={padTop + graph.range.zeroY * (height - padTop - padBottom)}
                x2={width - padX}
                y2={padTop + graph.range.zeroY * (height - padTop - padBottom)}
                stroke="#3f3f46"
                stroke-width="1"
              />
            {/if}

            <text
              x={padX}
              y="12"
              fill="#71717a"
              font-size="10"
              font-family="monospace"
            >
              {formatNumber(graph.range.max)}
            </text>

            <text
              x={padX}
              y={height - 6}
              fill="#71717a"
              font-size="10"
              font-family="monospace"
            >
              {formatNumber(graph.range.min)}
            </text>

            {#each graph.paths as line}
              <path
                d={line.d}
                fill="none"
                stroke={line.color}
                stroke-width="2.1"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            {/each}
          </svg>
        </section>
      {/each}
  </div>
</div>
