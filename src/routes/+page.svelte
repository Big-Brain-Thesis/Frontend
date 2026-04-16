<script lang="ts">
  import { onMount } from 'svelte';
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
  import {
    gameState,
    isLoading,
    apiConnected,
    lastApiPing,
    apiError,
    refreshApiHealth,
    startNewGame,
    submitMove,
    resetGame
  } from '$lib/stores/game';
  import { logs } from '$lib/stores/logger';
  import {
    eegState,
    startEEGMonitoring,
    stopEEGMonitoring,
    reconnectEEG
  } from '$lib/stores/eeg';
  import type { Opponent } from '$lib/types/game';

  let opponent: Opponent = 'dionysus';
  let eegEnabled = false;

  function formatOpponent(value: Opponent): string {
    switch (value) {
      case 'human':
        return 'Human';
      case 'dionysus':
        return 'Dionysus';
      case 'hermes':
        return 'Hermes';
    }
  }

  function handleNewGame() {
    startNewGame('2-player', opponent, eegEnabled);
  }

  function handleOpponentChange(value: Opponent) {
    opponent = value;
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

  onMount(() => {
    refreshApiHealth();

    const interval = window.setInterval(() => {
      refreshApiHealth();
    }, 3000);

    return () => {
      window.clearInterval(interval);
    };
  });

  $: isHumanVsHuman = opponent === 'human';
  $: canControlCurrentTurn =
    $gameState !== null && (isHumanVsHuman || $gameState.currentPlayer === 1);
  $: boardDisabled = $isLoading || !$gameState || !canControlCurrentTurn;
  $: showBotWaiting =
    $gameState !== null &&
    !isHumanVsHuman &&
    !$gameState.winner &&
    $gameState.currentPlayer !== 1 &&
    !$isLoading;
</script>

<svelte:head>
  <title>Big Brain | Quoridor SvelteKit</title>
  <meta
    name="description"
    content="Research-oriented Quoridor interface with backend gameplay, opponent selection, EEG monitoring, session logs, and export tools."
  />
</svelte:head>

<div class="min-h-screen bg-zinc-950 text-zinc-100">
  <AppHeader
    sessionId={$gameState?.sessionId ?? null}
    apiConnected={$apiConnected}
    lastApiPing={$lastApiPing}
    apiError={$apiError}
  />

  <div class="mx-auto max-w-[1720px] px-4 py-6 sm:px-6">
    <div class="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div class="space-y-6 xl:w-full xl:max-w-[980px] xl:justify-self-center">
        {#if !$gameState}
          <WelcomeScreen />
        {:else}
          {#if showBotWaiting}
            <div class="rounded border border-amber-700/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              Waiting for {formatOpponent(opponent)} to move.
            </div>
          {/if}

          <div class="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:p-6">
            <QuoridorBoard gameState={$gameState} disabled={boardDisabled} onMove={handleMove} />
          </div>
        {/if}

        {#if $gameState}
          <MoveHistory moves={$gameState.moveHistory} />
        {/if}

        <DebugConsole logs={$logs} maxHeight="300px" />
      </div>

      <div class="space-y-4 xl:sticky xl:top-6">
        <SessionControls
          {opponent}
          {eegEnabled}
          gameActive={$gameState !== null}
          disabled={$isLoading}
          onNewGame={handleNewGame}
          onReset={resetGame}
          onOpponentChange={handleOpponentChange}
          onEEGEnabledChange={handleEEGEnabledChange}
        />

        <NotationInput disabled={boardDisabled} onSubmit={handleMove} />

        <StatusPanel
          gameState={$gameState}
          apiStatus={{ connected: $apiConnected, lastPing: $lastApiPing, error: $apiError }}
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