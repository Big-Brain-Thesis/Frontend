<div class="rounded-lg border border-zinc-800 bg-zinc-900 p-8">
  <div class="max-w-3xl space-y-6">
    <div>
      <div class="mono mb-2 text-xs uppercase tracking-[0.2em] text-zinc-500">Quoridor research</div>
      <h2 class="text-3xl font-semibold text-zinc-100">Big Brain</h2>
      <p class="mt-3 max-w-2xl text-zinc-400">
        Start a session from the right panel. The board, logs, mock backend state, EEG stream, export tools,
        and AI response flow are wired into Svelte stores instead of React hooks.
      </p>
    </div>

    <div class="grid gap-4 md:grid-cols-3">
      <div class="rounded border border-zinc-800 bg-zinc-950 p-4">
        <div class="mono text-xs uppercase tracking-wider text-blue-400">Board</div>
        <p class="mt-2 text-sm text-zinc-400">9×9 board, legal move highlights, move history, winner tracking.</p>
      </div>

      <div class="rounded border border-zinc-800 bg-zinc-950 p-4">
        <div class="mono text-xs uppercase tracking-wider text-purple-400">EEG</div>
        <p class="mt-2 text-sm text-zinc-400">Optional streaming panel with live samples and mock focus score.</p>
      </div>

      <div class="rounded border border-zinc-800 bg-zinc-950 p-4">
        <div class="mono text-xs uppercase tracking-wider text-emerald-400">Exports</div>
        <p class="mt-2 text-sm text-zinc-400">Position string, move list, JSON session export, and timestamped logs.</p>
      </div>
    </div>
  </div>
</div>
