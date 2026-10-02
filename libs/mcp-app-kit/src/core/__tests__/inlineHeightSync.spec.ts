import { describe, expect, it, vi } from 'vitest';
import { startInlineHeightSync } from '../host/inlineHeightSync';

describe('startInlineHeightSync', () => {
  it('writes the measured height to <html> and resets it on stop', () => {
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      vi.fn(function () {
        return { observe, disconnect };
      }),
    );
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    const root = document.documentElement;
    vi.spyOn(root, 'getBoundingClientRect').mockReturnValue({
      height: 120.2,
    } as DOMRect);

    const stop = startInlineHeightSync(root);
    expect(root.style.height).toBe('121px');
    expect(observe).toHaveBeenCalledWith(document.body);

    stop();
    expect(disconnect).toHaveBeenCalled();
    expect(root.style.height).toBe('');
    vi.unstubAllGlobals();
  });
});
