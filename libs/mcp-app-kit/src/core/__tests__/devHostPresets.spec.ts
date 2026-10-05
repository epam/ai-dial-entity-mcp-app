import { describe, expect, it } from 'vitest';
import { HOST_PRESETS, HostPresetId } from '../../../dev-host/presets';
import { MCP_STYLE_VARIABLE_KEYS } from '../../testing';

const KEYS = new Set<string>(MCP_STYLE_VARIABLE_KEYS);

describe('dev host presets', () => {
  it('lists the 76 MCP standard style keys once each', () => {
    expect(MCP_STYLE_VARIABLE_KEYS).toHaveLength(76);
    expect(KEYS.size).toBe(76);
  });

  it('every preset defines the same keys in light and dark', () => {
    Object.values(HOST_PRESETS).forEach(({ light, dark }) => {
      expect(Object.keys(light).sort()).toEqual(Object.keys(dark).sort());
    });
  });

  it('presets only use MCP standard variable names', () => {
    Object.values(HOST_PRESETS).forEach(({ light, dark }) =>
      [...Object.keys(light), ...Object.keys(dark)].forEach((key) =>
        expect(KEYS, key).toContain(key),
      ),
    );
  });

  it('the none preset sends no variables', () => {
    expect(HOST_PRESETS[HostPresetId.None].light).toEqual({});
    expect(HOST_PRESETS[HostPresetId.None].dark).toEqual({});
  });

  it('the captured ChatGPT dark preset sends all 76 keys', () => {
    expect(Object.keys(HOST_PRESETS[HostPresetId.ChatGpt].dark)).toHaveLength(
      76,
    );
  });

  it('the reference preset sends the reference-design primary and radii', () => {
    const { light } = HOST_PRESETS[HostPresetId.Reference];
    expect(light['--color-background-inverse']).toBe('#d92b2b');
    expect(light['--color-text-inverse']).toBe('#ffffff');
    expect(light['--color-background-tertiary']).toBe('#f2e8e0');
    expect(light['--border-radius-md']).toBe('12px');
    expect(light['--border-radius-sm']).toBe('8px');
    expect(light['--border-radius-xl']).toBe('12px');
  });
});
