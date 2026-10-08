import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'entity-contract',
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
});
