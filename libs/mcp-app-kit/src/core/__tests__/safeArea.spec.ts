import { describe, expect, it } from 'vitest';
import { detectHostKind, HostKind } from '../host/hostKind';
import { resolveSafeArea } from '../host/safeArea';

describe('detectHostKind', () => {
  it('detects ChatGPT by window.openai', () => {
    expect(detectHostKind({ openai: {} } as unknown as Window)).toBe(
      HostKind.ChatGpt,
    );
  });

  it('falls back to other', () => {
    expect(detectHostKind({} as Window)).toBe(HostKind.Other);
  });
});

describe('resolveSafeArea', () => {
  it('uses host insets when provided', () => {
    const insets = { top: 1, right: 2, bottom: 3, left: 4 };
    expect(resolveSafeArea({ safeAreaInsets: insets }, HostKind.Other)).toEqual(
      insets,
    );
  });

  it('applies the inline desktop fallback when a non-ChatGPT host sends no insets', () => {
    expect(
      resolveSafeArea(
        { displayMode: 'inline', platform: 'desktop' },
        HostKind.Other,
      ),
    ).toEqual({ top: 12, right: 12, bottom: 12, left: 12 });
  });

  it('applies the inline mobile fallback', () => {
    expect(
      resolveSafeArea(
        { displayMode: 'inline', platform: 'mobile' },
        HostKind.Other,
      ),
    ).toEqual({ top: 8, right: 8, bottom: 8, left: 8 });
  });

  it('applies no fallback for ChatGPT', () => {
    expect(
      resolveSafeArea({ displayMode: 'inline' }, HostKind.ChatGpt),
    ).toEqual({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    });
  });
});
