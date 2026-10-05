import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    vi.fn(function () {
      return { observe: vi.fn(), disconnect: vi.fn(), unobserve: vi.fn() };
    }),
  );
});

afterEach(() => {
  cleanup();
});
