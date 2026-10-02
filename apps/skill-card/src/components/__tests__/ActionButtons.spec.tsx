import { createFakeMcpApp } from '@epam/ai-dial-mcp-app-kit/testing';
import { McpAppProvider } from '@epam/ai-dial-mcp-app-kit/react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import ActionButtons from '../ActionButtons';

const renderButtons = (actions: { tryUrl?: string; editUrl?: string }) => {
  const app = createFakeMcpApp();
  render(
    <McpAppProvider app={app}>
      <ActionButtons actions={actions} />
    </McpAppProvider>,
  );
  return app;
};

describe('ActionButtons', () => {
  it('opens each url through the host', async () => {
    const app = renderButtons({
      tryUrl: 'https://a.test/try',
      editUrl: 'https://a.test/edit',
    });
    await userEvent.click(screen.getByRole('button', { name: /try it/i }));
    await userEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(app.openedLinks).toEqual([
      'https://a.test/try',
      'https://a.test/edit',
    ]);
  });

  it('hides a button whose url is missing', () => {
    renderButtons({ editUrl: 'https://a.test/edit' });
    expect(screen.queryByRole('button', { name: /try it/i })).toBeNull();
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
  });

  it('renders nothing when there are no urls', () => {
    renderButtons({});
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows an inline message when the host refuses, and clears it on retry', async () => {
    const app = renderButtons({ tryUrl: 'https://a.test/try' });
    app.failOpenLink();
    await userEvent.click(screen.getByRole('button', { name: /try it/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /couldn't open the link/i,
    );
    await userEvent.click(screen.getByRole('button', { name: /try it/i }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(app.openedLinks).toEqual(['https://a.test/try']);
  });
});
