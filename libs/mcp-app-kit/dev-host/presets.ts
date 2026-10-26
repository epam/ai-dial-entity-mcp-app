import type { McpUiStyles } from '@modelcontextprotocol/ext-apps/app-bridge';
import type { McpAppStyleExtensions } from '../src/core';

export enum HostPresetId {
  Claude = 'claude',
  ChatGpt = 'chatgpt',
  Dial = 'dial',
  Reference = 'reference',
  None = 'none',
}

type Tokens = Partial<McpUiStyles>;

export type HostPreset = {
  label: string;
  light: Tokens;
  dark: Tokens;
  styleExtensions?: McpAppStyleExtensions;
};

const STATES = [
  'primary',
  'secondary',
  'tertiary',
  'inverse',
  'ghost',
  'info',
  'danger',
  'success',
  'warning',
  'disabled',
] as const;
const RING_STATES = [
  'primary',
  'secondary',
  'inverse',
  'info',
  'danger',
  'success',
  'warning',
] as const;

type ColorRow = Record<(typeof STATES)[number], string>;
type RingRow = Record<(typeof RING_STATES)[number], string>;

/**
 * Builds the 37 MCP colour variables from one row per group.
 * @param background - `--color-background-*` values
 * @param text - `--color-text-*` values
 * @param border - `--color-border-*` values
 * @param ring - `--color-ring-*` values
 */
const colors = (
  background: ColorRow,
  text: ColorRow,
  border: ColorRow,
  ring: RingRow,
): Tokens =>
  Object.fromEntries([
    ...STATES.map((state) => [
      `--color-background-${state}`,
      background[state],
    ]),
    ...STATES.map((state) => [`--color-text-${state}`, text[state]]),
    ...STATES.map((state) => [`--color-border-${state}`, border[state]]),
    ...RING_STATES.map((state) => [`--color-ring-${state}`, ring[state]]),
  ]) as Tokens;

/**
 * Builds the radius and border-width variables.
 * @param xs - `--border-radius-xs`
 * @param sm - `--border-radius-sm`
 * @param md - `--border-radius-md`
 * @param lg - `--border-radius-lg`
 * @param xl - `--border-radius-xl`
 * @param width - `--border-width-regular`
 */
const radii = (
  xs: string,
  sm: string,
  md: string,
  lg: string,
  xl: string,
  width = '1px',
): Tokens => ({
  '--border-radius-xs': xs,
  '--border-radius-sm': sm,
  '--border-radius-md': md,
  '--border-radius-lg': lg,
  '--border-radius-xl': xl,
  '--border-radius-full': '9999px',
  '--border-width-regular': width,
});

/** DIAL D18 type scale (equal to ui-kit's own text-class literals). */
const DIAL_TYPE: Tokens = {
  '--font-weight-normal': '400',
  '--font-weight-medium': '500',
  '--font-weight-semibold': '600',
  '--font-weight-bold': '700',
  '--font-text-xs-size': '12px',
  '--font-text-sm-size': '14px',
  '--font-text-md-size': '16px',
  '--font-text-lg-size': '16px',
  '--font-heading-xs-size': '16px',
  '--font-heading-sm-size': '18px',
  '--font-heading-md-size': '20px',
  '--font-heading-lg-size': '22px',
  '--font-heading-xl-size': '28px',
  '--font-heading-2xl-size': '32px',
  '--font-heading-3xl-size': '32px',
  '--font-text-xs-line-height': '16px',
  '--font-text-sm-line-height': '20px',
  '--font-text-md-line-height': '24px',
  '--font-text-lg-line-height': '26px',
  '--font-heading-xs-line-height': '24px',
  '--font-heading-sm-line-height': '26px',
  '--font-heading-md-line-height': '28px',
  '--font-heading-lg-line-height': '32px',
  '--font-heading-xl-line-height': '40px',
  '--font-heading-2xl-line-height': '48px',
  '--font-heading-3xl-line-height': '48px',
};

const DIAL_FONTS: Tokens = {
  '--font-sans': 'Inter, sans-serif',
  '--font-mono': "ui-monospace, 'SFMono-Regular', 'Fira Code', monospace",
};

const DIAL_SHADOWS: Tokens = {
  '--shadow-hairline': '0 1px 4px 0 #2764d933, 0 1px 2px 0 #161b2d08',
  '--shadow-sm': '0 8px 10px 0 #2764d914',
  '--shadow-md': '0 8px 24px 0 #2764d90f',
  '--shadow-lg': '0 8px 44px 0 #2764d914',
};

/** Captured from ChatGPT (dark theme) on 2026-10-05 — `styles.variables` only. */
const CHATGPT_DARK: Tokens = {
  '--color-background-primary': '#212121',
  '--color-background-secondary': '#181818',
  '--color-background-tertiary': '#131313',
  '--color-background-inverse': '#f3f3f3',
  '--color-background-ghost': 'color-mix(in oklab,#fff 0.0%,transparent)',
  '--color-background-info': '#0285ff21',
  '--color-background-danger': '#fa423e29',
  '--color-background-success': '#04b84c26',
  '--color-background-warning': '#fb6a2229',
  '--color-background-disabled': 'color-mix(in oklab,#fff 5.0%,transparent)',
  '--color-text-primary': '#fff',
  '--color-text-secondary': '#cdcdcd',
  '--color-text-tertiary': '#8f8f8f',
  '--color-text-inverse': '#0d0d0d',
  '--color-text-ghost': '#fff',
  '--color-text-info': '#539af8',
  '--color-text-danger': '#ff6764',
  '--color-text-success': '#53b559',
  '--color-text-warning': '#d25e28',
  '--color-text-disabled': '#5d5d5d',
  '--color-border-primary': 'color-mix(in oklab,#fff 12.0%,transparent)',
  '--color-border-secondary': 'color-mix(in oklab,#fff 6.0%,transparent)',
  '--color-border-tertiary': 'color-mix(in oklab,#fff 20.0%,transparent)',
  '--color-border-inverse': '#0d0d0d',
  '--color-border-ghost': 'color-mix(in oklab,#fff 0.0%,transparent)',
  '--color-border-info': '#0285ff21',
  '--color-border-danger': '#fa423e29',
  '--color-border-success': '#04b84c26',
  '--color-border-warning': '#fb6a2229',
  '--color-border-disabled': 'color-mix(in oklab,#fff 6.0%,transparent)',
  '--color-ring-primary': '#3a83f7',
  '--color-ring-secondary': '#3a83f7',
  '--color-ring-inverse': '#3a83f7',
  '--color-ring-info': '#3a83f7',
  '--color-ring-danger': '#ff8583',
  '--color-ring-success': '#3a83f7',
  '--color-ring-warning': '#3a83f7',
  '--font-sans':
    '"ui-sans-serif", "-apple-system", "system-ui", "Segoe UI", "Helvetica", "Apple Color Emoji", "Arial", "sans-serif", "Segoe UI Emoji", "Segoe UI Symbol"',
  '--font-mono':
    '"ui-monospace", "SFMono-Regular", "SF Mono", "Menlo", "Consolas", "Liberation Mono", "monospace"',
  '--font-weight-normal': '400',
  '--font-weight-medium': '500',
  '--font-weight-semibold': '600',
  '--font-weight-bold': '700',
  '--font-text-xs-size': '.75rem',
  '--font-text-sm-size': '.875rem',
  '--font-text-md-size': '1rem',
  '--font-text-lg-size': '1.125rem',
  '--font-heading-xs-size': '1rem',
  '--font-heading-sm-size': '1.125rem',
  '--font-heading-md-size': '1.25rem',
  '--font-heading-lg-size': '1.5rem',
  '--font-heading-xl-size': '2rem',
  '--font-heading-2xl-size': '2.25rem',
  '--font-heading-3xl-size': '3rem',
  '--font-text-xs-line-height': '1.125rem',
  '--font-text-sm-line-height': '1.25rem',
  '--font-text-md-line-height': '1.5rem',
  '--font-text-lg-line-height': '1.8125rem',
  '--font-heading-xs-line-height': '1.5rem',
  '--font-heading-sm-line-height': '1.625rem',
  '--font-heading-md-line-height': '1.625rem',
  '--font-heading-lg-line-height': '1.75rem',
  '--font-heading-xl-line-height': '2.375rem',
  '--font-heading-2xl-line-height': '2.625rem',
  '--font-heading-3xl-line-height': '3rem',
  '--border-radius-xs': '.25rem',
  '--border-radius-sm': '.375rem',
  '--border-radius-md': '.5rem',
  '--border-radius-lg': '.625rem',
  '--border-radius-xl': '.75rem',
  '--border-radius-full': '9999px',
  '--border-width-regular': '.5px',
  '--shadow-hairline': '0 0 0 .5px #ffffff1f',
  '--shadow-sm': '0 1px 2px -1px rgb(0 0 0 / .2)',
  '--shadow-md': '0 2px 4px -1px rgb(0 0 0 / .2)',
  '--shadow-lg': '0 4px 8px -2px rgb(0 0 0 / .36)',
};

/** Approximation: ChatGPT light colours; type scale and radii as in dark. */
const CHATGPT_LIGHT: Tokens = {
  ...CHATGPT_DARK,
  ...colors(
    {
      primary: '#ffffff',
      secondary: '#f9f9f9',
      tertiary: '#f3f3f3',
      inverse: '#0d0d0d',
      ghost: 'transparent',
      info: '#0285ff1a',
      danger: '#e02e2a1a',
      success: '#00a2401a',
      warning: '#e255071a',
      disabled: '#0d0d0d0d',
    },
    {
      primary: '#0d0d0d',
      secondary: '#5d5d5d',
      tertiary: '#8f8f8f',
      inverse: '#ffffff',
      ghost: '#0d0d0d',
      info: '#0285ff',
      danger: '#e02e2a',
      success: '#008635',
      warning: '#e25507',
      disabled: '#b4b4b4',
    },
    {
      primary: '#0d0d0d1a',
      secondary: '#0d0d0d0d',
      tertiary: '#0d0d0d26',
      inverse: '#ffffff',
      ghost: 'transparent',
      info: '#0285ff1a',
      danger: '#e02e2a1a',
      success: '#00a2401a',
      warning: '#e255071a',
      disabled: '#0d0d0d0d',
    },
    {
      primary: '#0285ff',
      secondary: '#0285ff',
      inverse: '#0285ff',
      info: '#0285ff',
      danger: '#e02e2a',
      success: '#0285ff',
      warning: '#0285ff',
    },
  ),
  '--shadow-hairline': '0 0 0 .5px #0000001f',
  '--shadow-sm': '0 1px 2px -1px rgb(0 0 0 / .1)',
  '--shadow-md': '0 2px 4px -1px rgb(0 0 0 / .1)',
  '--shadow-lg': '0 4px 8px -2px rgb(0 0 0 / .16)',
};

const CLAUDE_COMMON: Tokens = {
  '--font-sans': 'ui-sans-serif, system-ui, sans-serif',
  '--font-mono': 'ui-monospace, monospace',
  ...DIAL_TYPE,
  ...radii('4px', '6px', '8px', '10px', '12px'),
};

/** DIAL's D18 default (light) values. */
const DIAL_LIGHT: Tokens = {
  ...colors(
    {
      primary: '#fcfcfc',
      secondary: '#f5f7fa',
      tertiary: '#eef1f7',
      inverse: '#57647a',
      ghost: 'transparent',
      info: '#e1eaf9',
      danger: '#f3d6d8',
      success: '#dbf1eb',
      warning: '#faf0cf',
      disabled: '#dce0e8',
    },
    {
      primary: '#161b2d',
      secondary: '#57647a',
      tertiary: '#848e9c',
      inverse: '#fcfcfc',
      ghost: '#848e9c',
      info: '#1d4ed8',
      danger: '#ae2f2f',
      success: '#007274',
      warning: '#7f6300',
      disabled: '#848e9c',
    },
    {
      primary: '#57647a',
      secondary: '#d1dbea',
      tertiary: '#e0e6f0',
      inverse: '#57647a',
      ghost: 'transparent',
      info: '#1d4ed8',
      danger: '#ae2f2f',
      success: '#007274',
      warning: '#eec840',
      disabled: '#848e9c',
    },
    {
      primary: '#161b2d',
      secondary: '#6785fb',
      inverse: '#161b2d',
      info: '#1d4ed8',
      danger: '#ae2f2f',
      success: '#007274',
      warning: '#eec840',
    },
  ),
  ...DIAL_FONTS,
  ...DIAL_TYPE,
  ...radii('2px', '4px', '6px', '8px', '12px'),
  ...DIAL_SHADOWS,
};

/** Approximation: DIAL dark colours; everything else as in light. */
const DIAL_DARK: Tokens = {
  ...DIAL_LIGHT,
  ...colors(
    {
      primary: '#161b2d',
      secondary: '#0c101d',
      tertiary: '#242c42',
      inverse: '#9fa6bd',
      ghost: 'transparent',
      info: '#1c2c47',
      danger: '#402027',
      success: '#1d3841',
      warning: '#3f3d25',
      disabled: '#242c42',
    },
    {
      primary: '#eef1f7',
      secondary: '#9fa6bd',
      tertiary: '#7c8293',
      inverse: '#0c101d',
      ghost: '#7c8293',
      info: '#7da4ff',
      danger: '#f76464',
      success: '#37babc',
      warning: '#eec840',
      disabled: '#7c8293',
    },
    {
      primary: '#696e7c',
      secondary: '#333942',
      tertiary: '#242c42',
      inverse: '#696e7c',
      ghost: 'transparent',
      info: '#7da4ff',
      danger: '#f76464',
      success: '#37babc',
      warning: '#eec840',
      disabled: '#696e7c',
    },
    {
      primary: '#eef1f7',
      secondary: '#6785fb',
      inverse: '#eef1f7',
      info: '#7da4ff',
      danger: '#f76464',
      success: '#37babc',
      warning: '#eec840',
    },
  ),
};

/** The reference design's host (light only): design spec §6.7 values. */
const REFERENCE: Tokens = {
  ...colors(
    {
      primary: '#ffffff',
      secondary: '#f6f4f0',
      tertiary: '#f2e8e0',
      inverse: '#d92b2b',
      ghost: 'transparent',
      info: '#e1eafa',
      danger: '#ffdbe0',
      success: '#dbf1eb',
      warning: '#faf0cf',
      disabled: '#cececd',
    },
    {
      primary: '#1a1a1a',
      secondary: '#6f7073',
      tertiary: '#7e7f82',
      inverse: '#ffffff',
      ghost: '#7e7f82',
      info: '#1d4ed8',
      danger: '#9b1a29',
      success: '#007c2f',
      warning: '#7f6300',
      disabled: '#6f7073',
    },
    {
      primary: '#857f76',
      secondary: '#e1dcd4',
      tertiary: '#ede8df',
      inverse: '#857f76',
      ghost: 'transparent',
      info: '#1d4ed8',
      danger: '#9b1a29',
      success: '#007c2f',
      warning: '#eec840',
      disabled: '#6f7073',
    },
    {
      primary: '#1a1a1a',
      secondary: '#1a1a1a',
      inverse: '#1a1a1a',
      info: '#1d4ed8',
      danger: '#9b1a29',
      success: '#007c2f',
      warning: '#eec840',
    },
  ),
  '--font-sans': 'Inter, sans-serif',
  '--font-mono': 'ui-monospace, monospace',
  ...DIAL_TYPE,
  ...radii('2px', '8px', '12px', '12px', '12px'),
};

export const HOST_PRESETS: Record<HostPresetId, HostPreset> = {
  [HostPresetId.Claude]: {
    label: 'Claude-like (approximate)',
    light: {
      ...colors(
        {
          primary: '#ffffff',
          secondary: '#f5f4ed',
          tertiary: '#f0eee6',
          inverse: '#141413',
          ghost: 'transparent',
          info: '#d6e4f6',
          danger: '#f7eceb',
          success: '#e9f1dc',
          warning: '#f6eee1',
          disabled: '#f0eee6',
        },
        {
          primary: '#141413',
          secondary: '#3d3d3a',
          tertiary: '#73726c',
          inverse: '#faf9f5',
          ghost: '#73726c',
          info: '#2c6db7',
          danger: '#a73d39',
          success: '#437c22',
          warning: '#805c1f',
          disabled: '#a3a29d',
        },
        {
          primary: '#1f1e1d26',
          secondary: '#1f1e1d1a',
          tertiary: '#1f1e1d0f',
          inverse: '#faf9f5',
          ghost: 'transparent',
          info: '#2c6db7',
          danger: '#a73d39',
          success: '#437c22',
          warning: '#805c1f',
          disabled: '#1f1e1d1a',
        },
        {
          primary: '#2c84db',
          secondary: '#2c84db',
          inverse: '#faf9f5',
          info: '#2c84db',
          danger: '#a73d39',
          success: '#437c22',
          warning: '#805c1f',
        },
      ),
      ...CLAUDE_COMMON,
    },
    dark: {
      ...colors(
        {
          primary: '#262624',
          secondary: '#1f1e1d',
          tertiary: '#141413',
          inverse: '#faf9f5',
          ghost: 'transparent',
          info: '#1e2a3a',
          danger: '#3a1f1d',
          success: '#1f2e17',
          warning: '#3a2e17',
          disabled: '#30302e',
        },
        {
          primary: '#faf9f5',
          secondary: '#c2c0b6',
          tertiary: '#9c9a92',
          inverse: '#141413',
          ghost: '#9c9a92',
          info: '#80aadd',
          danger: '#e5807b',
          success: '#93c26b',
          warning: '#d8a65a',
          disabled: '#6b6a65',
        },
        {
          primary: '#faf9f526',
          secondary: '#faf9f51a',
          tertiary: '#faf9f50f',
          inverse: '#141413',
          ghost: 'transparent',
          info: '#80aadd',
          danger: '#e5807b',
          success: '#93c26b',
          warning: '#d8a65a',
          disabled: '#faf9f51a',
        },
        {
          primary: '#80aadd',
          secondary: '#80aadd',
          inverse: '#141413',
          info: '#80aadd',
          danger: '#e5807b',
          success: '#93c26b',
          warning: '#d8a65a',
        },
      ),
      ...CLAUDE_COMMON,
    },
  },
  [HostPresetId.ChatGpt]: {
    label: 'ChatGPT (dark captured, light approximate)',
    light: CHATGPT_LIGHT,
    dark: CHATGPT_DARK,
  },
  [HostPresetId.Dial]: {
    label: 'AI DIAL (D18; dark approximate)',
    light: DIAL_LIGHT,
    dark: DIAL_DARK,
    styleExtensions: {
      variables: {
        '--button-radius': '9999px',
        '--button-radius-small': '9999px',
        '--button-primary-gradient-start': '#1d4ed8',
        '--button-primary-gradient-end': '#885df2',
        '--button-primary-gradient-hover-start': '#6785fb',
        '--button-primary-gradient-hover-end': '#885df2',
        '--button-primary-gradient-active-start': '#1d4ed8',
        '--button-primary-gradient-active-end': '#7c3aed',
        '--button-primary-text': '#fcfcfc',
      },
    },
  },
  [HostPresetId.Reference]: {
    label: 'Reference design (light only)',
    light: REFERENCE,
    dark: REFERENCE,
  },
  [HostPresetId.None]: { label: 'None (no variables)', light: {}, dark: {} },
};
