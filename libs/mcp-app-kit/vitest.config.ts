import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'kit',
    environment: 'jsdom',
    include: ['src/**/*.spec.{ts,tsx}', 'dev-host/**/*.spec.ts'],
    setupFiles: ['./src/test-setup.ts'],
  },
});
