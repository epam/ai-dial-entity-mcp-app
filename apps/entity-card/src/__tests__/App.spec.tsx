import { McpAppPhase } from '@epam/ai-dial-mcp-app-kit';
import { McpAppProvider } from '@epam/ai-dial-mcp-app-kit/react';
import { createFakeMcpApp } from '@epam/ai-dial-mcp-app-kit/testing';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import agent from '../../fixtures/agent.json';
import malformed from '../../fixtures/malformed.json';
import withFailures from '../../fixtures/default.json';
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
    expect(screen.getByTestId('entity-card-skeleton')).toBeInTheDocument();
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
      "Couldn't display this entity",
    );
    expect(warn).toHaveBeenCalledWith(
      '[entity-card] invalid payload:',
      'entity.name must be a non-empty string',
    );
    warn.mockRestore();
  });

  it('shows an error message when the tool fails or is cancelled', () => {
    renderApp(
      createFakeMcpApp({ phase: McpAppPhase.Error, error: 'Tool cancelled' }),
    );
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load entity");
  });

  it('shows an error message for the error phase of an error tool result without warning', () => {
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
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load entity");
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('shows an error message for a ready error tool result without warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    renderApp(
      createFakeMcpApp({
        phase: McpAppPhase.Ready,
        toolResult: {
          isError: true,
          content: [{ type: 'text', text: 'skill not found' }],
        },
      }),
    );
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load entity");
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('renders the agent from a JSON text block', () => {
    renderApp(
      createFakeMcpApp({
        phase: McpAppPhase.Ready,
        toolResult: {
          content: [{ type: 'text', text: JSON.stringify(agent) }],
        },
      }),
    );
    expect(
      screen.getByRole('heading', { name: 'Inbox Digest' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Tools' })).toBeInTheDocument();
  });

  it('renders the agent from structured content', () => {
    const app = renderApp();
    act(() =>
      app.setSnapshot({
        phase: McpAppPhase.Ready,
        toolResult: { structuredContent: agent },
      }),
    );
    expect(
      screen.getByRole('region', { name: 'Your data' }),
    ).toBeInTheDocument();
  });
});
