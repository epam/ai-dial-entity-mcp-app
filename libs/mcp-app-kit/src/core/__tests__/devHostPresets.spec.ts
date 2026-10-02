import { describe, expect, it } from 'vitest';
import { HOST_PRESETS, HostPresetId } from '../../../dev-host/presets';

describe('dev host presets', () => {
  it('every preset defines the same keys in light and dark', () => {
    Object.values(HOST_PRESETS).forEach(({ light, dark }) => {
      expect(Object.keys(light).sort()).toEqual(Object.keys(dark).sort());
    });
  });

  it('the none preset sends no variables', () => {
    expect(HOST_PRESETS[HostPresetId.None].light).toEqual({});
  });

  it('presets only use MCP standard variable names', () => {
    Object.values(HOST_PRESETS).forEach(({ light }) =>
      Object.keys(light).forEach((key) =>
        expect(key).toMatch(/^--(color|font)-/),
      ),
    );
  });
});
