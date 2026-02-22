import { defineConfig } from 'vitest/config';
import { fileURLToPath } from "url";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "./src"),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    // CI Stability Baseline v1.0
    // Do not change pool mode without validating fetch stability in CI.
    pool: 'forks',
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}', 'tests/**/*.spec.{ts,tsx}'],
  },
});

