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
    ticks: number[];
  };

  type Point = {
    x: number;
    y: number;
    value: number;
    index: number;
  };

  type GraphLine = Series & {
    d: string;
    latest: number;
    points: Point[];
  };

  type GraphView = GraphConfig & {
    range: Range;
    paths: GraphLine[];
  };

  const width = 920;
  const height = 240;
  const padLeft = 68;
  const padRight = 24;
  const padTop = 16;
  const padBottom = 32;
  const maxVisibleSamples = 240;
  const yTickCount = 5;
  const xTickCount = 5;

  const graphWidth = width - padLeft - padRight;
  const graphHeight = height - padTop - padBottom;

  const yLimitGrowthPadding = 1.08;
  const minYLimit = 1e-9;

  let graphYLimits: Record<string, number> = {};

  const allChannels: EEGChannel[] = ["TP9", "AF7", "AF8", "TP10"];

  const graphConfigs: GraphConfig[] = [
    {
      title: "Focus channels",
      subtitle: "AF7 + AF8 frontal signal",
      series: [
        { key: "AF7", color: "var(--eeg-channel-af7)", textClass: "text-blue-300" },
        { key: "AF8", color: "var(--eeg-channel-af8)", textClass: "text-violet-300" },
      ],
    },
    {
      title: "Movement channels",
      subtitle: "TP9 + TP10 temporal signal",
      series: [
        { key: "TP9", color: "var(--eeg-channel-tp9)", textClass: "text-emerald-300" },
        { key: "TP10", color: "var(--eeg-channel-tp10)", textClass: "text-amber-300" },
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
  $: xTicks = getXTicks(visibleSamples.length);

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

  function valuesFor(channel: EEGChannel, displaySamples: EEGSample[]): number[] {
    return displaySamples.map((sample) => sampleValue(sample, channel));
  }

  function combinedValues(displaySamples: EEGSample[], series: Series[]): number[] {
    return series.flatMap((item) => valuesFor(item.key, displaySamples));
  }

  function graphKey(graph: GraphConfig): string {
    return graph.series.map((line) => line.key).join("+");
  }

  function getStoredYLimit(key: string, values: number[]): number {
    const finite = values.filter(Number.isFinite);

    const currentAbsMax = finite.reduce(
      (max, value) => Math.max(max, Math.abs(value)),
      0,
    );

    const nextLimit = Math.max(currentAbsMax * yLimitGrowthPadding, minYLimit);
    const storedLimit = graphYLimits[key];

    if (!storedLimit || nextLimit > storedLimit) {
      graphYLimits = {
        ...graphYLimits,
        [key]: nextLimit,
      };

      return nextLimit;
    }

    return storedLimit;
  }

  function getRange(storedLimit: number): Range {
    const limit = Math.max(storedLimit, minYLimit);

    const min = -limit;
    const max = limit;
    const span = max - min;
    const zeroY = 0.5;

    return {
      min,
      max,
      span,
      zeroY,
      ticks: getYTicks(min, max, yTickCount),
    };
  }

  function getYTicks(min: number, max: number, count: number): number[] {
    if (count <= 1) return [min];

    const ticks: number[] = [];
    const step = (max - min) / (count - 1);

    for (let index = 0; index < count; index += 1) {
      ticks.push(max - step * index);
    }

    return ticks;
  }

  function getXTicks(sampleCount: number): number[] {
    if (sampleCount <= 1) return [0];

    const lastIndex = sampleCount - 1;
    const ticks: number[] = [];

    for (let index = 0; index < xTickCount; index += 1) {
      ticks.push(Math.round((index / (xTickCount - 1)) * lastIndex));
    }

    return [...new Set(ticks)];
  }

  function pointFor(value: number, index: number, count: number, range: Range): Point {
    const x = padLeft + (index / Math.max(count - 1, 1)) * graphWidth;
    const normalized = (value - range.min) / range.span;
    const y = padTop + (1 - normalized) * graphHeight;

    return { x, y, value, index };
  }

  function buildPoints(values: number[], range: Range): Point[] {
    return values.map((value, index) =>
      pointFor(value, index, values.length, range),
    );
  }

  function buildPath(points: Point[]): string {
    if (points.length === 0) return "";

    return points
      .map(
        (point, index) =>
          `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
      )
      .join(" ");
  }

  function buildGraphViews(
    configs: GraphConfig[],
    displaySamples: EEGSample[],
    latest: EEGSample | undefined,
  ): GraphView[] {
    return configs.map((graph) => {
      const values = combinedValues(displaySamples, graph.series);
      const key = graphKey(graph);
      const storedLimit = getStoredYLimit(key, values);
      const range = getRange(storedLimit);

      return {
        ...graph,
        range,
        paths: graph.series.map((line) => {
          const lineValues = valuesFor(line.key, displaySamples);
          const points = buildPoints(lineValues, range);

          return {
            ...line,
            latest: latest ? sampleValue(latest, line.key) : 0,
            points,
            d: buildPath(points),
          };
        }),
      };
    });
  }

  function xForTick(sampleIndex: number, sampleCount: number): number {
    return padLeft + (sampleIndex / Math.max(sampleCount - 1, 1)) * graphWidth;
  }

  function yForTick(value: number, range: Range): number {
    const normalized = (value - range.min) / range.span;
    return padTop + (1 - normalized) * graphHeight;
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

  function formatXTick(sampleIndex: number, sampleCount: number): string {
    if (sampleCount <= 1) return "0";

    return sampleIndex === sampleCount - 1
      ? "latest"
      : `-${sampleCount - 1 - sampleIndex}`;
  }
</script>

<div class="space-y-4">
  <div
    class="mono flex items-center justify-between text-[11px] uppercase tracking-wider text-zinc-500"
  >
    <span>Live EEG graphs</span>
    <span>{frameLabel} · {sourceLabel}</span>
  </div>

  {#if visibleSamples.length === 0}
    <div class="rounded border border-dashed border-zinc-800 bg-zinc-950 p-6">
      <div class="flex min-h-40 flex-col items-center justify-center gap-3 text-center">
        <div class="flex h-14 items-end gap-1.5">
          <span class="h-5 w-2 animate-pulse rounded bg-blue-400/50"></span>
          <span
            class="h-10 w-2 animate-pulse rounded bg-violet-400/60 [animation-delay:120ms]"
          ></span>
          <span
            class="h-7 w-2 animate-pulse rounded bg-emerald-400/50 [animation-delay:240ms]"
          ></span>
          <span
            class="h-12 w-2 animate-pulse rounded bg-amber-400/60 [animation-delay:360ms]"
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

  {#if visibleSamples.length > 0}
    {#if loading}
      <div class="rounded border border-blue-500/20 bg-blue-500/10 px-3 py-2">
        <div class="mono flex items-center gap-2 text-[11px] text-blue-300">
          <span class="h-2 w-2 animate-pulse rounded-full bg-blue-300"></span>
          Reconnecting. Existing graph data is kept visible.
        </div>
      </div>
    {/if}

    {#if flatZero}
      <div class="rounded border border-yellow-500/30 bg-yellow-500/10 px-3 py-2">
        <p class="mono text-[11px] text-yellow-300">
          Frames are arriving, but all channel values are exactly zero. The graph
          is live; the reader is sending flat data.
        </p>
      </div>
    {/if}

    <div class="space-y-4">
      {#each graphViews as graph}
        <section class="rounded border border-zinc-800 bg-zinc-950 p-4">
        <div class="mb-3 flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="mono text-[11px] uppercase tracking-wider text-zinc-300">
              {graph.title}
            </div>
            <div class="mt-0.5 text-[11px] text-zinc-500">
              {graph.subtitle}
            </div>
            <div class="mono mt-1 text-[10px] text-zinc-600">
              y-axis stored adaptive · x-axis samples from oldest to latest
            </div>
          </div>

          <div class="flex shrink-0 flex-col gap-1">
            {#each graph.paths as line}
              <div class="mono rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-[10px]">
                <span class={line.textClass}>{line.key}</span>
                <span class="ml-1 text-zinc-300">{formatNumber(line.latest)}</span>
              </div>
            {/each}
          </div>
        </div>

        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          class="h-40 w-full rounded bg-zinc-900/80"
          role="img"
          aria-label={`${graph.title} EEG graph`}
        >
          <rect x="0" y="0" {width} {height} fill="var(--chart-canvas)" rx="0" />

          <line
            x1={padLeft}
            y1={padTop}
            x2={padLeft}
            y2={height - padBottom}
            stroke="var(--chart-axis)"
            stroke-width="1.2"
          />
          <line
            x1={padLeft}
            y1={height - padBottom}
            x2={width - padRight}
            y2={height - padBottom}
            stroke="var(--chart-axis)"
            stroke-width="1.2"
          />

          {#each graph.range.ticks as tick}
            <line
              x1={padLeft}
              y1={yForTick(tick, graph.range)}
              x2={width - padRight}
              y2={yForTick(tick, graph.range)}
              stroke="var(--chart-grid)"
              stroke-dasharray="3 5"
              stroke-width="1"
            />
            <text
              x={padLeft - 10}
              y={yForTick(tick, graph.range) + 3}
              text-anchor="end"
              fill="var(--chart-label)"
              font-size="10"
              font-family="monospace"
            >
              {formatNumber(tick)}
            </text>
          {/each}

          {#each xTicks as tick}
            <line
              x1={xForTick(tick, visibleSamples.length)}
              y1={padTop}
              x2={xForTick(tick, visibleSamples.length)}
              y2={height - padBottom}
              stroke="var(--chart-subgrid)"
              stroke-dasharray="2 8"
              stroke-width="1"
            />
            <text
              x={xForTick(tick, visibleSamples.length)}
              y={height - 18}
              text-anchor="middle"
              fill="var(--chart-label)"
              font-size="10"
              font-family="monospace"
            >
              {formatXTick(tick, visibleSamples.length)}
            </text>
          {/each}

          {#if graph.range.min < 0 && graph.range.max > 0}
            <line
              x1={padLeft}
              y1={padTop + graph.range.zeroY * graphHeight}
              x2={width - padRight}
              y2={padTop + graph.range.zeroY * graphHeight}
              stroke="var(--chart-muted)"
              stroke-width="1.3"
            />
            <text
              x={width - padRight - 4}
              y={padTop + graph.range.zeroY * graphHeight - 5}
              text-anchor="end"
              fill="var(--chart-muted)"
              font-size="10"
              font-family="monospace"
            >
              zero
            </text>
          {/if}

          <text
            x={padLeft}
            y="14"
            fill="var(--chart-muted)"
            font-size="10"
            font-family="monospace"
          >
            y: raw channel value
          </text>
          <text
            x={width - padRight}
            y={height - 6}
            text-anchor="end"
            fill="var(--chart-muted)"
            font-size="10"
            font-family="monospace"
          >
            x: sample index
          </text>

          {#each graph.paths as line}
            <path
              d={line.d}
              fill="none"
              stroke={line.color}
              stroke-width="2.4"
              stroke-linecap="round"
              stroke-linejoin="round"
            />

            {#if line.points.length > 0}
              <circle
                cx={line.points[line.points.length - 1].x}
                cy={line.points[line.points.length - 1].y}
                r="3.5"
                fill={line.color}
              />
              <text
                x={Math.min(
                  line.points[line.points.length - 1].x + 8,
                  width - padRight - 64,
                )}
                y={line.points[line.points.length - 1].y - 6}
                fill={line.color}
                font-size="10"
                font-family="monospace"
              >
                {line.key}: {formatNumber(line.latest)}
              </text>
            {/if}
          {/each}
        </svg>
        </section>
      {/each}
    </div>
  {/if}
</div>
