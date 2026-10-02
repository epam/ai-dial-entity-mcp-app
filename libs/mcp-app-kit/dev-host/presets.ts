import type { McpUiStyles } from '@modelcontextprotocol/ext-apps/app-bridge';

export enum HostPresetId {
  Claude = 'claude',
  ChatGpt = 'chatgpt',
  Dial = 'dial',
  None = 'none',
}

type Tokens = Partial<McpUiStyles>;

export type HostPreset = { label: string; light: Tokens; dark: Tokens };

const tokens = (
  bgPrimary: string,
  bgSecondary: string,
  textPrimary: string,
  textSecondary: string,
  border: string,
  font: string,
): Tokens => ({
  '--color-background-primary': bgPrimary,
  '--color-background-secondary': bgSecondary,
  '--color-background-tertiary': bgSecondary,
  '--color-text-primary': textPrimary,
  '--color-text-secondary': textSecondary,
  '--color-border-primary': border,
  '--color-border-secondary': border,
  '--color-border-tertiary': border,
  '--font-sans': font,
});

export const HOST_PRESETS: Record<HostPresetId, HostPreset> = {
  [HostPresetId.Claude]: {
    label: 'Claude-like',
    light: tokens(
      '#ffffff',
      '#f5f4ed',
      '#141413',
      '#3d3d3a',
      '#1f1e1d26',
      'ui-sans-serif, system-ui',
    ),
    dark: tokens(
      '#262624',
      '#1f1e1d',
      '#faf9f5',
      '#c2c0b6',
      '#faf9f526',
      'ui-sans-serif, system-ui',
    ),
  },
  [HostPresetId.ChatGpt]: {
    label: 'ChatGPT-like',
    light: tokens(
      '#ffffff',
      '#f3f3f3',
      '#0d0d0d',
      '#5d5d5d',
      '#0000001a',
      'ui-sans-serif, system-ui',
    ),
    dark: tokens(
      '#212121',
      '#303030',
      '#ffffff',
      '#afafaf',
      '#ffffff1a',
      'ui-sans-serif, system-ui',
    ),
  },
  [HostPresetId.Dial]: {
    label: 'AI DIAL-like',
    light: tokens(
      '#ffffff',
      '#f3f4f6',
      '#141a23',
      '#6c7380',
      '#dde1e6',
      'Inter, sans-serif',
    ),
    dark: tokens(
      '#0c101d',
      '#161b2d',
      '#eef1f7',
      '#9fa6bd',
      '#333942',
      'Inter, sans-serif',
    ),
  },
  [HostPresetId.None]: { label: 'None (no variables)', light: {}, dark: {} },
};
