import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [sveltekit()],
  resolve: {
    alias: {
      $test: fileURLToPath(new URL('./src/test', import.meta.url)),
      '$lib/test': fileURLToPath(new URL('./src/test', import.meta.url))
    },
    conditions: ['browser']
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.{test,integration}.ts'],
    exclude: ['e2e/**', 'node_modules/**', '.svelte-kit/**'],
    clearMocks: true,
    restoreMocks: true
  }
});