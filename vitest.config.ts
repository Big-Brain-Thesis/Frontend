import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [sveltekit()],
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
