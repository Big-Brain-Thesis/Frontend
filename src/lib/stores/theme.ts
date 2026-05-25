import { writable } from "svelte/store";

export type Theme = "dark" | "light";

const STORAGE_KEY = "bigbrain-theme";
const DEFAULT_THEME: Theme = "dark";

function isTheme(value: string | null | undefined): value is Theme {
  return value === "dark" || value === "light";
}

function readInitialTheme(): Theme {
  if (typeof window === "undefined") return DEFAULT_THEME;

  const documentTheme = document.documentElement.dataset.theme;
  if (isTheme(documentTheme)) return documentTheme;

  try {
    const storedTheme = window.localStorage.getItem(STORAGE_KEY);
    return isTheme(storedTheme) ? storedTheme : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export const theme = writable<Theme>(readInitialTheme());

theme.subscribe((value) => {
  if (typeof window === "undefined") return;

  document.documentElement.dataset.theme = value;
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Theme still applies for this session if browser storage is unavailable.
  }
});

export function toggleTheme() {
  theme.update((value) => (value === "dark" ? "light" : "dark"));
}
