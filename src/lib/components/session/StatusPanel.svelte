<script lang="ts">
  import type { EEGState } from '$lib/types/eeg';
  import type { ApiStatus, GameState } from '$lib/types/game';

  export let gameState: GameState | null = null;
  export let apiStatus: ApiStatus;
  export let eegState: EEGState;

  function statusLabel(status: EEGState['status']): string {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting';
      case 'reconnecting':
        return 'Reconnecting';
      case 'error':
        return 'Error';
      default:
        return 'Disconnected';
    }
  }
</script>

<div class="rounded border border-zinc-800 bg-zinc-900 p-4 space-y-3">
  <h3 class="mono text-xs uppercase tracking-wider text-zinc-400">System Status</h3>

  <div class="space-y-1 text-xs">
    <div class="mono flex items-center justify-between">
      <span class="text-zinc-400">Backend API</span>
      <span class={apiStatus.connected ? 'text-green-400' : 'text-red-400'}>
        {apiStatus.connected ? 'Connected' : 'Disconnected'}
      </span>
    </div>

    {#if eegState.enabled}
      <div class="mono flex items-center justify-between">
        <span class="text-zinc-400">EEG Device</span>
        <span
          class={
            eegState.status === 'connected'
              ? 'text-green-400'
              : eegState.status === 'error'
                ? 'text-red-400'
                : 'text-yellow-400'
          }
        >
          {statusLabel(eegState.status)}
        </span>
      </div>
    {/if}
  </div>

  {#if gameState}
    <div class="space-y-1 border-t border-zinc-800 pt-3 text-xs">
      <div class="mono flex justify-between text-zinc-400">
        <span>Session ID</span>
        <span class="text-zinc-300">{gameState.sessionId.split('-').at(-1)}</span>
      </div>
      <div class="mono flex justify-between text-zinc-400">
        <span>Status</span>
        <span class="text-zinc-300">{gameState.status}</span>
      </div>
      <div class="mono flex justify-between text-zinc-400">
        <span>Move count</span>
        <span class="text-zinc-300">{gameState.moveHistory.length}</span>
      </div>
      <div class="mono flex justify-between text-zinc-400">
        <span>Current turn</span>
        <span class="text-zinc-300">
          Player {gameState.currentPlayer} {gameState.players[gameState.currentPlayer - 1]?.isAI ? '(Bot)' : '(Human)'}
        </span>
      </div>

      <div class="grid gap-2 pt-2">
        {#each gameState.players as player}
          <div class="mono flex justify-between rounded border border-zinc-800 bg-zinc-950 p-2 text-zinc-400">
            <span>Player {player.id}</span>
            <span class="text-zinc-300">
              {player.isAI ? 'Bot' : 'Human'} · {player.position.col}{player.position.row} · {player.wallsRemaining} walls
            </span>
          </div>
        {/each}
      </div>

      {#if gameState.winner}
        <div class="mono flex justify-between text-zinc-400">
          <span>Winner</span>
          <span class="text-green-400">Player {gameState.winner}</span>
        </div>
      {/if}
    </div>
  {/if}
</div>
