<script lang="ts">
  import { afterUpdate } from 'svelte';
  import { clearLogs } from '$lib/stores/logger';
  import type { LogCategory, LogEntry } from '$lib/types/logs';

  export let logs: LogEntry[] = [];
  export let maxHeight = '240px';

  let isCollapsed = false;
  let filterCategory: LogCategory | 'ALL' = 'ALL';
  let viewport: HTMLDivElement | undefined;

  const categories: Array<LogCategory | 'ALL'> = [
    'ALL',
    'GAME',
    'API',
    'EEG',
    'MOVE',
    'SESSION',
    'SYSTEM'
  ];

  $: filteredLogs = logs.filter(
    (log) => filterCategory === 'ALL' || log.category === filterCategory
  );

  afterUpdate(() => {
    if (!isCollapsed && viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  });

  function formatTimestamp(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    });
  }

  function formatData(data: unknown): string {
    if (data === undefined) {
      return '';
    }

    if (typeof data === 'string') {
      return data;
    }

    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  }

  function levelClass(level: LogEntry['level']) {
    switch (level) {
      case 'ERROR':
        return 'text-red-400';
      case 'WARN':
        return 'text-yellow-400';
      case 'DEBUG':
        return 'text-purple-400';
      default:
        return 'text-zinc-400';
    }
  }

  function categoryClass(category: LogCategory) {
    switch (category) {
      case 'GAME':
        return 'text-blue-400';
      case 'API':
        return 'text-green-400';
      case 'EEG':
        return 'text-purple-400';
      case 'MOVE':
        return 'text-cyan-400';
      case 'SESSION':
        return 'text-amber-400';
      default:
        return 'text-zinc-400';
    }
  }
</script>

<div class="rounded border border-zinc-800 bg-zinc-900">
  <div class="flex items-center justify-between border-b border-zinc-800 p-3">
    <div class="flex items-center gap-2">
      <h3 class="mono text-sm uppercase tracking-wider text-zinc-200">Debug Console</h3>
      <span class="mono text-xs text-zinc-500">
        ({filteredLogs.length}/{logs.length} events)
      </span>
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
        {isCollapsed ? '▾' : '▴'}
      </button>
    </div>
  </div>

  {#if !isCollapsed}
    <div class="bg-black">
      <div
        bind:this={viewport}
        class="overflow-auto p-3 text-xs"
        style={`height:${maxHeight}`}
      >
        {#if filteredLogs.length === 0}
          <div class="mono text-zinc-600">No logs to display</div>
        {:else}
          <div class="space-y-1">
            {#each filteredLogs as log}
              <div class="rounded px-1 py-0.5 hover:bg-zinc-900/50">
                <div class="mono flex flex-wrap gap-x-2 gap-y-1">
                  <span class="shrink-0 text-zinc-600">{formatTimestamp(log.timestamp)}</span>
                  <span class={`w-12 shrink-0 ${levelClass(log.level)}`}>{log.level}</span>
                  <span class={`w-16 shrink-0 ${categoryClass(log.category)}`}>
                    [{log.category}]
                  </span>
                  <span class="min-w-0 flex-1 break-words whitespace-pre-wrap text-zinc-300">
                    {log.message}
                  </span>
                </div>

                {#if log.data !== undefined}
                  <pre
                    class="mono mt-1 overflow-x-auto rounded border border-zinc-800 bg-zinc-950 p-2 text-[11px] text-zinc-400"
                  >{formatData(log.data)}</pre>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>