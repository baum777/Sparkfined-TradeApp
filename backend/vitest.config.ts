import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      HELIUS_API_KEY: 'test-helius-api-key',
      NODE_ENV: 'test',
    },
    include: ['tests/**/*.spec.ts', 'src/**/__tests__/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
    setupFiles: [resolve(__dirname, 'tests/setup.ts')],
  },
});
