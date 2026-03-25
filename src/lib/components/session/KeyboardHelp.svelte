<script lang="ts">
  let isOpen = false;

  const sections = [
    {
      title: 'Game Controls',
      rows: [
        { keys: ['N'], description: 'New game' },
        { keys: ['R'], description: 'Reset game' },
        { keys: ['E'], description: 'Toggle EEG monitoring' }
      ]
    },
    {
      title: 'Console',
      rows: [
        { keys: ['C'], description: 'Toggle debug console' },
        { keys: ['F'], description: 'Filter console by category' }
      ]
    },
    {
      title: 'Navigation',
      rows: [
        { keys: ['?'], description: 'Show or hide help' },
        { keys: ['Esc'], description: 'Close dialogs' }
      ]
    }
  ];
</script>

<button
  class="mono rounded border border-zinc-800 px-3 py-1 text-xs text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-200"
  on:click={() => (isOpen = true)}
>
  Shortcuts
</button>

{#if isOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
    <div class="w-full max-w-md rounded-lg border border-zinc-700 bg-zinc-900 p-6">
      <div class="mb-4 flex items-center justify-between">
        <div>
          <h3 class="text-lg font-semibold text-zinc-100">Keyboard Shortcuts</h3>
          <p class="mono text-xs text-zinc-500">Reference only</p>
        </div>
        <button class="rounded border border-zinc-700 px-2 py-1 text-zinc-400 hover:text-zinc-200" on:click={() => (isOpen = false)}>
          ✕
        </button>
      </div>

      <div class="space-y-4 text-sm">
        {#each sections as section}
          <div class="space-y-2 border-t border-zinc-800 pt-3 first:border-t-0 first:pt-0">
            <div class="mono text-xs uppercase tracking-wider text-zinc-500">{section.title}</div>
            <div class="space-y-2">
              {#each section.rows as row}
                <div class="flex items-center justify-between gap-4">
                  <span class="text-zinc-400">{row.description}</span>
                  <div class="flex gap-1">
                    {#each row.keys as key}
                      <kbd class="mono rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-300">{key}</kbd>
                    {/each}
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>
{/if}
