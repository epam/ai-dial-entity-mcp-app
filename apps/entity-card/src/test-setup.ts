import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

vi.stubGlobal(
  'ResizeObserver',
  vi.fn(function () {
    return { observe: vi.fn(), disconnect: vi.fn(), unobserve: vi.fn() };
  }),
);

afterEach(() => {
  cleanup();
});
