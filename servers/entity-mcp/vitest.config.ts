import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'entity-mcp',
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
});
