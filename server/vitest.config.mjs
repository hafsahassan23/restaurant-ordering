import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: { NODE_ENV: 'test' },
    globalSetup: ['./tests/globalSetup.js'], // separate test database, migrated and seeded
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 60000,
  },
});