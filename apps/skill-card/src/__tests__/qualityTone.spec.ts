import { describe, expect, it } from 'vitest';
import { getPassTone, PassTone } from '../qualityTone';

describe('getPassTone', () => {
  it.each([
    [100, PassTone.Success],
    [80, PassTone.Success],
    [79, PassTone.Warning],
    [50, PassTone.Warning],
    [49, PassTone.Error],
    [0, PassTone.Error],
  ])('%d%% → %s', (percent, tone) => {
    expect(getPassTone(percent)).toBe(tone);
  });
});
