import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { startInlineHeightSync } from '../../core/host/inlineHeightSync';
import { createFakeMcpApp } from '../../testing';
import { McpAppProvider } from '../McpAppProvider';

vi.mock('../../core/host/inlineHeightSync', () => ({
  startInlineHeightSync: vi.fn(),
}));

const start = vi.mocked(startInlineHeightSync);
const stop = vi.fn();

describe('McpAppProvider inline height sync', () => {
  beforeEach(() => {
    start.mockReset().mockReturnValue(stop);
    stop.mockReset();
  });

  it('starts when the display mode is absent and stops in fullscreen', () => {
    const app = createFakeMcpApp({ hostContext: { theme: 'dark' } });
    render(<McpAppProvider app={app}>child</McpAppProvider>);
    expect(start).toHaveBeenCalledTimes(1);

    act(() => app.setSnapshot({ hostContext: { displayMode: 'fullscreen' } }));
    expect(stop).toHaveBeenCalledTimes(1);

    act(() => app.setSnapshot({ hostContext: { displayMode: 'inline' } }));
    expect(start).toHaveBeenCalledTimes(2);
  });

  it('does not start while the app is fullscreen', () => {
    const app = createFakeMcpApp({
      hostContext: { displayMode: 'fullscreen' },
    });
    render(<McpAppProvider app={app}>child</McpAppProvider>);
    expect(start).not.toHaveBeenCalled();
  });

  it('stops on unmount', () => {
    const app = createFakeMcpApp({ hostContext: { displayMode: 'inline' } });
    const { unmount } = render(
      <McpAppProvider app={app}>child</McpAppProvider>,
    );
    unmount();
    expect(stop).toHaveBeenCalledTimes(1);
  });
});
