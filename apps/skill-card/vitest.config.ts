import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'skill-card',
    environment: 'jsdom',
    include: ['src/**/*.spec.{ts,tsx}'],
    setupFiles: ['./src/test-setup.ts'],
  },
});
