<script lang="ts">
  import { afterUpdate } from "svelte";
  import { clearLogs } from "$lib/stores/logger";
  import type { LogCategory, LogEntry } from "$lib/types/logs";

  export let logs: LogEntry[] = [];
  export let maxHeight = "240px";

  type LevelFilter = "ALL" | LogEntry["level"];

  let isCollapsed = false;
  let filterCategory: LogCategory | "ALL" = "ALL";
  let filterLevel: LevelFilter = "ALL";
  let showDebug = false;
  let viewport: HTMLDivElement | undefined;

  const categories: Array<LogCategory | "ALL"> = [
    "ALL",
    "GAME",
    "API",
    "EEG",
    "MOVE",
    "SESSION",
    "SYSTEM",
  ];

  const levels: LevelFilter[] = ["ALL", "ERROR", "WARN", "INFO", "DEBUG"];

  $: usefulLogs = logs.filter((log) => !isHealthLog(log));
  $: visibleLogs = usefulLogs.filter((log) => {
    if (!showDebug && log.level === "DEBUG") return false;
    if (filterCategory !== "ALL" && log.category !== filterCategory)
      return false;
    if (filterLevel !== "ALL" && log.level !== filterLevel) return false;
    return true;
  });

  $: errors = usefulLogs.filter((log) => log.level === "ERROR");
  $: warnings = usefulLogs.filter((log) => log.level === "WARN");
  $: eegLogs = usefulLogs.filter((log) => log.category === "EEG");
  $: apiLogs = usefulLogs.filter((log) => log.category === "API");
  $: moveLogs = usefulLogs.filter((log) => log.category === "MOVE");
  $: latestError = errors.at(-1);
  $: latestWarning = warnings.at(-1);
  $: latestMove = moveLogs.at(-1);
  $: latestEEG = eegLogs.at(-1);
  $: latestAPI = apiLogs.at(-1);

  afterUpdate(() => {
    if (!isCollapsed && viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  });

  function isHealthLog(log: LogEntry): boolean {
    const text = `${log.message} ${formatData(log.data)}`.toLowerCase();

    return (
      text.includes("/api/health") ||
      text.includes("api/health") ||
      text.includes("get health") ||
      text.includes("health poll") ||
      text.includes("muse health") ||
      text.includes("ping")
    );
  }

  function formatTimestamp(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  function formatData(data: unknown): string {
    if (data === undefined || data === null) return "";
    if (typeof data === "string") return data;

    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  }

  function shortData(data: unknown): string {
    const text = formatData(data)
      .replace(/\s+/g, " ")
      .replace(/[{}"]/g, "")
      .trim();

    return text.length > 160 ? `${text.slice(0, 160)}…` : text;
  }

  function levelClass(level: LogEntry["level"]) {
    switch (level) {
      case "ERROR":
        return "border-red-500/40 bg-red-500/10 text-red-300";
      case "WARN":
        return "border-yellow-500/40 bg-yellow-500/10 text-yellow-300";
      case "DEBUG":
        return "border-purple-500/30 bg-purple-500/10 text-purple-300";
      default:
        return "border-zinc-700 bg-zinc-800/70 text-zinc-300";
    }
  }

  function categoryClass(category: LogCategory) {
    switch (category) {
      case "GAME":
        return "text-blue-300";
      case "API":
        return "text-green-300";
      case "EEG":
        return "text-purple-300";
      case "MOVE":
        return "text-cyan-300";
      case "SESSION":
        return "text-amber-300";
      default:
        return "text-zinc-300";
    }
  }

  function severityDot(level: LogEntry["level"]) {
    switch (level) {
      case "ERROR":
        return "bg-red-400";
      case "WARN":
        return "bg-yellow-400";
      case "DEBUG":
        return "bg-purple-400";
      default:
        return "bg-zinc-500";
    }
  }
</script>

<div class="rounded border border-zinc-800 bg-zinc-950">
  <div class="flex items-center justify-between border-b border-zinc-800 p-3">
    <div>
      <h3 class="mono text-sm uppercase tracking-wider text-zinc-200">
        System Console
      </h3>
      <p class="mono mt-1 text-xs text-zinc-500">
        {visibleLogs.length} shown · {usefulLogs.length} useful · {logs.length -
          usefulLogs.length} health hidden
      </p>
    </div>

    <div class="flex items-center gap-2">
      <select
        class="mono rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-300"
        bind:value={filterCategory}
      >
        {#each categories as category}
          <option value={category}>{category}</option>
        {/each}
      </select>

      <select
        class="mono rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-300"
        bind:value={filterLevel}
      >
        {#each levels as level}
          <option value={level}>{level}</option>
        {/each}
      </select>

      <label class="mono flex items-center gap-1 text-xs text-zinc-400">
        <input type="checkbox" bind:checked={showDebug} />
        Debug
      </label>

      <button
        type="button"
        class="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200"
        on:click={clearLogs}
      >
        Clear
      </button>

      <button
        type="button"
        class="rounded border border-zinc-700 px-2 py-1 text-zinc-400 hover:text-zinc-200"
        on:click={() => (isCollapsed = !isCollapsed)}
      >
        {isCollapsed ? "▾" : "▴"}
      </button>
    </div>
  </div>

  {#if !isCollapsed}
    <div
      class="grid grid-cols-2 gap-2 border-b border-zinc-800 p-3 md:grid-cols-4"
    >
      <div class="rounded border border-zinc-800 bg-zinc-900 p-2">
        <div class="mono text-[10px] uppercase tracking-wider text-zinc-500">
          Errors
        </div>
        <div class="mono mt-1 text-lg text-red-300">{errors.length}</div>
      </div>

      <div class="rounded border border-zinc-800 bg-zinc-900 p-2">
        <div class="mono text-[10px] uppercase tracking-wider text-zinc-500">
          Warnings
        </div>
        <div class="mono mt-1 text-lg text-yellow-300">{warnings.length}</div>
      </div>

      <div class="rounded border border-zinc-800 bg-zinc-900 p-2">
        <div class="mono text-[10px] uppercase tracking-wider text-zinc-500">
          Last Move
        </div>
        <div class="mono mt-1 truncate text-xs text-cyan-300">
          {latestMove?.message ?? "No moves yet"}
        </div>
      </div>

      <div class="rounded border border-zinc-800 bg-zinc-900 p-2">
        <div class="mono text-[10px] uppercase tracking-wider text-zinc-500">
          EEG Stream
        </div>
        <div class="mono mt-1 truncate text-xs text-purple-300">
          {latestEEG?.message ?? "No EEG events"}
        </div>
      </div>
    </div>

    {#if latestError || latestWarning || latestAPI}
      <div class="space-y-2 border-b border-zinc-800 p-3">
        {#if latestError}
          <div class="rounded border border-red-500/30 bg-red-500/10 p-2">
            <div class="mono text-[10px] uppercase tracking-wider text-red-300">
              Latest Error
            </div>
            <div class="mono mt-1 text-xs text-zinc-200">
              {latestError.message}
            </div>
            {#if latestError.data !== undefined}
              <div class="mono mt-1 wrap-wrap-break-word text-[11px] text-zinc-400">
                {shortData(latestError.data)}
              </div>
            {/if}
          </div>
        {:else if latestWarning}
          <div class="rounded border border-yellow-500/30 bg-yellow-500/10 p-2">
            <div
              class="mono text-[10px] uppercase tracking-wider text-yellow-300"
            >
              Latest Warning
            </div>
            <div class="mono mt-1 text-xs text-zinc-200">
              {latestWarning.message}
            </div>
            {#if latestWarning.data !== undefined}
              <div class="mono mt-1 wrap-break-words text-[11px] text-zinc-400">
                {shortData(latestWarning.data)}
              </div>
            {/if}
          </div>
        {/if}

        {#if latestAPI}
          <div class="rounded border border-zinc-800 bg-zinc-900 p-2">
            <div
              class="mono text-[10px] uppercase tracking-wider text-zinc-500"
            >
              Latest API Event
            </div>
            <div class="mono mt-1 text-xs text-zinc-300">
              {latestAPI.message}
            </div>
          </div>
        {/if}
      </div>
    {/if}

    <div
      bind:this={viewport}
      class="overflow-auto bg-black p-3 text-xs"
      style={`height:${maxHeight}`}
    >
      {#if visibleLogs.length === 0}
        <div class="mono text-zinc-600">No useful logs to display</div>
      {:else}
        <div class="space-y-2">
          {#each visibleLogs as log}
            <div class={`rounded border px-2 py-1.5 ${levelClass(log.level)}`}>
              <div class="mono flex items-start gap-2">
                <span
                  class={`mt-1 h-2 w-2 shrink-0 rounded-full ${severityDot(log.level)}`}
                ></span>
                <span class="shrink-0 text-zinc-500"
                  >{formatTimestamp(log.timestamp)}</span
                >
                <span class="w-12 shrink-0">{log.level}</span>
                <span class={`w-16 shrink-0 ${categoryClass(log.category)}`}
                  >{log.category}</span
                >
                <span class="min-w-0 flex-1 wrap-break-words text-zinc-200"
                  >{log.message}</span
                >
              </div>

              {#if log.data !== undefined && log.level !== "DEBUG"}
                <div
                  class="mono mt-1 wrap-break-words pl-30 text-[11px] text-zinc-400"
                >
                  {shortData(log.data)}
                </div>
              {/if}

              {#if log.data !== undefined && log.level === "DEBUG" && showDebug}
                <pre
                  class="mono mt-2 overflow-x-auto rounded border border-zinc-800 bg-zinc-950 p-2 text-[11px] text-zinc-400">{formatData(
                    log.data,
                  )}</pre>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>
