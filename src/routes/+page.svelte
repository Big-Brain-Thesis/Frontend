<script lang="ts">
  import { onMount } from 'svelte';
  import AppHeader from '$lib/components/layout/AppHeader.svelte';
  import QuoridorBoard from '$lib/components/board/QuoridorBoard.svelte';
  import MoveHistory from '$lib/components/board/MoveHistory.svelte';
  import SessionControls from '$lib/components/session/SessionControls.svelte';
  import StatusPanel from '$lib/components/session/StatusPanel.svelte';
  import AdvancedPanel from '$lib/components/session/AdvancedPanel.svelte';
  import SessionArchive from '$lib/components/session/SessionArchive.svelte';
  import WelcomeScreen from '$lib/components/session/WelcomeScreen.svelte';
  import EEGPanel from '$lib/components/eeg/EEGPanel.svelte';
  import DebugConsole from '$lib/components/logs/DebugConsole.svelte';
  import NotationInput from '$lib/components/session/NotationInput.svelte';
  import {
    gameState,
    isLoading,
    isSubmitting,
    isBotThinking,
    apiConnected,
    lastApiPing,
    apiError,
    botAutoplay,
    botSpeedMs,
    savedGames,
    replayState,
    refreshApiHealth,
    startNewGame,
    submitMove,
    playBotMove,
    resetGame,
    setBotAutoplay,
    setBotSpeed,
    saveCurrentGame,
    refreshSavedGames,
    loadSavedGame,
    stepReplay,
    exitReplay
  } from '$lib/stores/game';
  import { logs } from '$lib/stores/logger';
  import {
    eegState,
    startEEGMonitoring,
    stopEEGMonitoring,
    reconnectEEG
  } from '$lib/stores/eeg';
  import type { PlayerController } from '$lib/types/game';

  let player1: PlayerController = 'human';
  let player2: PlayerController = 'dionysus';
  let eegEnabled = false;

  function formatController(value: PlayerController | string): string {
    switch (value) {
      case 'human':
        return 'Human';
      case 'dionysus':
        return 'Dionysus';
      case 'hermes':
        return 'Hermes';
      default:
        return value;
    }
  }

  function handleNewGame() {
    startNewGame('2-player', player1, player2, eegEnabled);
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

  function isTypingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;

    const tagName = target.tagName.toLowerCase();
    return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target.isContentEditable;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (isTypingTarget(event.target)) return;

    if ($replayState.active) {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        stepReplay(-1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        stepReplay(1);
      }
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setBotSpeed($botSpeedMs - 100);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setBotSpeed($botSpeedMs + 100);
    }
  }

  onMount(() => {
    refreshApiHealth();
    refreshSavedGames();

    const interval = window.setInterval(() => {
      refreshApiHealth();
    }, 3000);

    return () => {
      window.clearInterval(interval);
    };
  });

  $: currentPlayer = $gameState?.players[$gameState.currentPlayer - 1] ?? null;
  $: replayActive = $replayState.active;
  $: canControlCurrentTurn =
    $gameState !== null &&
    !replayActive &&
    !$gameState.winner &&
    $gameState.status === 'in-progress' &&
    currentPlayer !== null &&
    !currentPlayer.isAI;
  $: boardDisabled = !$gameState || !canControlCurrentTurn;
  $: canStepBot =
    $gameState !== null &&
    !replayActive &&
    !$gameState.winner &&
    $gameState.status === 'in-progress' &&
    currentPlayer !== null &&
    currentPlayer.isAI;
  $: showBotWaiting = canStepBot && !$isBotThinking;
</script>

<svelte:window on:keydown={handleKeydown} />

<svelte:head>
  <title>Big Brain | Quoridor SvelteKit</title>
  <meta
    name="description"
    content="Research-oriented Quoridor interface with backend gameplay, player selection, bot spectating, EEG monitoring, session logs, and local save/load."
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
        {/if}

        <div class="min-h-[760px] overflow-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:p-6">
          <QuoridorBoard gameState={$gameState} disabled={boardDisabled} onMove={handleMove} />
        </div>

        {#if replayActive}
          <div class="rounded border border-amber-700/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Replay mode. Use Arrow Left / Arrow Right to browse moves.
          </div>
        {:else if showBotWaiting}
          <div class="rounded border border-amber-700/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Waiting for Player {$gameState?.currentPlayer} bot
            ({formatController($gameState?.difficulty ?? '')}) to move.
          </div>
        {:else if $isSubmitting}
          <div class="rounded border border-blue-700/40 bg-blue-500/10 px-4 py-3 text-sm text-blue-200">
            Move sent to backend. Board already updated optimistically.
          </div>
        {/if}

        {#if $gameState}
          <MoveHistory moves={$gameState.moveHistory} />
        {/if}

        <DebugConsole logs={$logs} maxHeight="300px" />
      </div>

      <div class="space-y-4 xl:sticky xl:top-6">
        <SessionControls
          {player1}
          {player2}
          {eegEnabled}
          botAutoplay={$botAutoplay}
          botSpeedMs={$botSpeedMs}
          botThinking={$isBotThinking}
          {canStepBot}
          gameActive={$gameState !== null}
          disabled={$isLoading}
          onNewGame={handleNewGame}
          onReset={resetGame}
          onPlayer1Change={(value) => (player1 = value)}
          onPlayer2Change={(value) => (player2 = value)}
          onEEGEnabledChange={handleEEGEnabledChange}
          onBotAutoplayChange={setBotAutoplay}
          onBotSpeedChange={setBotSpeed}
          onStepBot={playBotMove}
        />

        <NotationInput disabled={boardDisabled} onSubmit={handleMove} />

        <SessionArchive
          gameState={$gameState}
          savedGames={$savedGames}
          replayState={$replayState}
          disabled={$isLoading}
          onSave={saveCurrentGame}
          onRefresh={refreshSavedGames}
          onLoad={loadSavedGame}
          onReplayStep={stepReplay}
          onReplayExit={exitReplay}
        />

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