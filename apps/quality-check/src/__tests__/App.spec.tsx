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
    expect(screen.getByTestId('quality-check-skeleton')).toBeInTheDocument();
  });

  it('renders the quality check from structured content', () => {
    const app = renderApp();
    act(() =>
      app.setSnapshot({
        phase: McpAppPhase.Ready,
        toolResult: { structuredContent: withFailures },
      }),
    );
    expect(
      screen.getByRole('button', { name: /quality check/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('92% passed')).toBeInTheDocument();
  });

  it('renders when the host only forwards a JSON text block', () => {
    renderApp(
      createFakeMcpApp({
        phase: McpAppPhase.Ready,
        toolResult: {
          content: [{ type: 'text', text: JSON.stringify(withFailures) }],
        },
      }),
    );
    expect(screen.getByText('92% passed')).toBeInTheDocument();
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
      "Couldn't display this quality check",
    );
    expect(warn).toHaveBeenCalledWith(
      '[quality-check] invalid payload:',
      'qualityCheck.passedPercent must be a number',
    );
    warn.mockRestore();
  });

  it('shows an error message when the tool fails, without warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    renderApp(
      createFakeMcpApp({
        phase: McpAppPhase.Error,
        error: 'skill not found',
        toolResult: {
          isError: true,
          content: [{ type: 'text', text: 'skill not found' }],
        },
      }),
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      "Couldn't load quality check",
    );
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
