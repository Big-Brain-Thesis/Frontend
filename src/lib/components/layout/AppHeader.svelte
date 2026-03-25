<script lang="ts">
  import KeyboardHelp from '$lib/components/session/KeyboardHelp.svelte';

  export let sessionId: string | null = null;
  export let apiConnected = false;
</script>

<header class="border-b border-zinc-800 bg-zinc-950 px-6 py-4">
  <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
    <div class="flex items-center gap-3">
      <div class="flex h-10 w-10 items-center justify-center rounded-lg border border-blue-900 bg-blue-950/40 text-lg">🧠</div>
      <div>
        <h1 class="text-xl font-bold text-zinc-100">Big Brain</h1>
        <p class="mono text-xs text-zinc-500">Quoridor Research Interface</p>
      </div>
    </div>

    <div class="mono flex flex-wrap items-center gap-4 text-xs">
      {#if sessionId}
        <div class="text-zinc-500">
          Session: <span class="text-zinc-300">{sessionId.split('-').at(-1)}</span>
        </div>
      {/if}

      <div class="flex items-center gap-2">
        <span class={`inline-block h-2 w-2 rounded-full ${apiConnected ? 'bg-green-400' : 'bg-red-400'}`}></span>
        <span class={apiConnected ? 'text-green-400' : 'text-red-400'}>
          Backend {apiConnected ? 'Online' : 'Offline'}
        </span>
      </div>

      <KeyboardHelp />
    </div>
  </div>
</header>
