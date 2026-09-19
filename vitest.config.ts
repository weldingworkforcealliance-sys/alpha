import { configDefaults, defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./', import.meta.url)) } },
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    maxWorkers: 4,
    // Archive tests use node:test and run separately in CI.
    exclude: [...configDefaults.exclude, 'scripts/archive/**'],
  },
});
