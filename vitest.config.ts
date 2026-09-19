import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Archive tests use node:test and run separately in CI.
    exclude: [...configDefaults.exclude, 'scripts/archive/**'],
  },
});
