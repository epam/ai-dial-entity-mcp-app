export enum HostKind {
  ChatGpt = 'chatgpt',
  Other = 'other',
}

/**
 * Detects host families that need special handling. ChatGPT exposes
 * `window.openai` inside its widget iframe; every other host is spec-only.
 * @param win - window to inspect (defaults to the global window)
 */
export const detectHostKind = (win: Window = window): HostKind =>
  'openai' in win ? HostKind.ChatGpt : HostKind.Other;
