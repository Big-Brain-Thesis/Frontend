import base from './vitest.config';
import { mergeConfig } from 'vitest/config';

export default mergeConfig(base, {
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.integration.test.ts', 'e2e/**', 'node_modules/**', '.svelte-kit/**']
  }
});
