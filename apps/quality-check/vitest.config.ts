import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'quality-check',
    environment: 'jsdom',
    include: ['src/**/*.spec.{ts,tsx}'],
    setupFiles: ['./src/test-setup.ts'],
  },
});
