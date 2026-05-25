<script lang="ts">
  import { theme, toggleTheme } from "$lib/stores/theme";

  $: isLight = $theme === "light";
  $: label = isLight ? "Switch to dark theme" : "Switch to light theme";
</script>

<button
  type="button"
  class="theme-toggle"
  aria-label={label}
  aria-pressed={isLight}
  title={label}
  on:click={toggleTheme}
>
  {#if isLight}
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M20.99 13.44a8 8 0 1 1-10.43-10.43 7 7 0 1 0 10.43 10.43Z" />
    </svg>
  {:else}
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  {/if}
</button>
