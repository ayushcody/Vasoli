import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    // Deployment guard tests use node:test and run via `npm run pilot:ops:test`.
    exclude: ['**/node_modules/**', '**/dist/**', '**/tests/e2e/**', '**/scripts/pilot/deployment-preflight.test.mjs'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
