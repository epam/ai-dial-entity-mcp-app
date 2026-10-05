import { McpAppPhase } from '@epam/ai-dial-mcp-app-kit';
import { McpAppProvider } from '@epam/ai-dial-mcp-app-kit/react';
import { createFakeMcpApp } from '@epam/ai-dial-mcp-app-kit/testing';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import malformed from '../../fixtures/malformed.json';
import withFailures from '../../fixtures/with-failures.json';
import App from '../App';

const renderApp = (
  app = createFakeMcpApp({ phase: McpAppPhase.ToolPending }),
) => {
  render(
    <McpAppProvider app={app}>
      <App />
    </McpAppProvider>,
  );
  return app;
};

describe('App', () => {
  it('shows the skeleton while waiting', () => {
    renderApp();
    expect(screen.getByTestId('skill-card-skeleton')).toBeInTheDocument();
  });

  it('renders the card from structured content', () => {
    const app = renderApp();
    act(() =>
      app.setSnapshot({
        phase: McpAppPhase.Ready,
        toolResult: { structuredContent: withFailures },
      }),
    );
    expect(
      screen.getByRole('heading', { name: 'good-morning-breakfast' }),
    ).toBeInTheDocument();
  });

  it('renders the card when the host only forwards a JSON text block', () => {
    renderApp(
      createFakeMcpApp({
        phase: McpAppPhase.Ready,
        toolResult: {
          content: [{ type: 'text', text: JSON.stringify(withFailures) }],
        },
      }),
    );
    expect(
      screen.getByRole('heading', { name: 'good-morning-breakfast' }),
    ).toBeInTheDocument();
  });

  it('shows a notice and warns for an invalid payload', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    renderApp(
      createFakeMcpApp({
        phase: McpAppPhase.Ready,
        toolResult: { structuredContent: malformed },
      }),
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      "Couldn't display this skill",
    );
    expect(warn).toHaveBeenCalledWith(
      '[skill-card] invalid payload:',
      'skill.name must be a non-empty string',
    );
    warn.mockRestore();
  });

  it('shows an error message when the tool fails or is cancelled', () => {
    renderApp(
      createFakeMcpApp({ phase: McpAppPhase.Error, error: 'Tool cancelled' }),
    );
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load skill");
  });
});
