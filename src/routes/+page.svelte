<script lang="ts">
  import AppHeader from '$lib/components/layout/AppHeader.svelte';
  import QuoridorBoard from '$lib/components/board/QuoridorBoard.svelte';
  import MoveHistory from '$lib/components/board/MoveHistory.svelte';
  import SessionControls from '$lib/components/session/SessionControls.svelte';
  import StatusPanel from '$lib/components/session/StatusPanel.svelte';
  import AdvancedPanel from '$lib/components/session/AdvancedPanel.svelte';
  import WelcomeScreen from '$lib/components/session/WelcomeScreen.svelte';
  import EEGPanel from '$lib/components/eeg/EEGPanel.svelte';
  import DebugConsole from '$lib/components/logs/DebugConsole.svelte';
  import NotationInput from '$lib/components/session/NotationInput.svelte';
  import { gameState, isLoading, apiConnected, startNewGame, submitMove, resetGame } from '$lib/stores/game';
  import { logs } from '$lib/stores/logger';
  import { eegState, startEEGMonitoring, stopEEGMonitoring, reconnectEEG } from '$lib/stores/eeg';
  import type { Difficulty } from '$lib/types/game';

  let difficulty: Difficulty = 'medium';
  let eegEnabled = false;

  function handleNewGame() {
    startNewGame('2-player', difficulty, eegEnabled);
  }

  function handleDifficultyChange(value: Difficulty) {
    difficulty = value;
  }

  function handleEEGEnabledChange(value: boolean) {
    eegEnabled = value;

    if (value) {
      startEEGMonitoring();
    } else {
      stopEEGMonitoring();
    }
  }

  function handleMove(notation: string) {
    submitMove(notation);
  }
</script>

<svelte:head>
  <title>Big Brain | Quoridor SvelteKit</title>
  <meta
    name="description"
    content="Research-oriented Quoridor interface with mock backend state, EEG monitoring, session logs, and export tools."
  />
</svelte:head>

<div class="min-h-screen bg-zinc-950 text-zinc-100">
  <AppHeader sessionId={$gameState?.sessionId ?? null} apiConnected={$apiConnected} />

  <div class="mx-auto max-w-[1720px] px-4 py-6 sm:px-6">
    <div class="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div class="space-y-6 xl:justify-self-center xl:w-full xl:max-w-[980px]">
        {#if !$gameState}
          <WelcomeScreen />
        {:else}
          <div class="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:p-6">
            <QuoridorBoard
              gameState={$gameState}
              disabled={$isLoading || !$gameState || $gameState.currentPlayer !== 1}
              onMove={handleMove}
            />
          </div>
        {/if}

        {#if $gameState}
          <MoveHistory moves={$gameState.moveHistory} />
        {/if}

        <DebugConsole logs={$logs} maxHeight="300px" />
      </div>

      <div class="space-y-4 xl:sticky xl:top-6">
        <SessionControls
          {difficulty}
          {eegEnabled}
          gameActive={$gameState !== null}
          disabled={$isLoading}
          onNewGame={handleNewGame}
          onReset={resetGame}
          onDifficultyChange={handleDifficultyChange}
          onEEGEnabledChange={handleEEGEnabledChange}
        />

        <NotationInput disabled={$isLoading || !$gameState} onSubmit={handleMove} />

        <StatusPanel
          gameState={$gameState}
          apiStatus={{ connected: $apiConnected, lastPing: Date.now(), error: null }}
          eegState={$eegState}
        />

        {#if eegEnabled}
          <EEGPanel eegState={$eegState} onReconnect={reconnectEEG} />
        {/if}

        <AdvancedPanel gameState={$gameState} />
      </div>
    </div>
  </div>
</div>
