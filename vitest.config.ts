import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import { config } from 'dotenv';

config({ path: '.env.test', override: true });

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 15_000,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
});
