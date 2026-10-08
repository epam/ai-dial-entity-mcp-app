import { createFakeMcpApp } from '@epam/ai-dial-mcp-app-kit/testing';
import { McpAppProvider } from '@epam/ai-dial-mcp-app-kit/react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import agent from '../../../fixtures/agent.json';
import withFailures from '../../../fixtures/default.json';
import {
  parseEntityCardPayload,
  type EntityCardData,
} from '@epam/ai-dial-entity-contract';
import EntityCard from '../EntityCard';

const toData = (raw: unknown): EntityCardData => {
  const result = parseEntityCardPayload(raw);
  if (!result.ok) throw new Error(result.reason);
  return result.data;
};

const renderCard = (data: EntityCardData) =>
  render(
    <McpAppProvider app={createFakeMcpApp()}>
      <EntityCard data={data} />
    </McpAppProvider>,
  );

describe('EntityCard', () => {
  it('renders header and actions', () => {
    renderCard(toData(withFailures));
    expect(
      screen.getByRole('heading', { name: 'good-morning-breakfast' }),
    ).toBeInTheDocument();
    expect(screen.getByText('GM')).toBeInTheDocument();
    expect(screen.getByText('Skill')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try it/i })).toBeInTheDocument();
  });

  it('renders a static 2.0 card: no hover lift, no shadow, token radius', () => {
    renderCard(toData(withFailures));
    const card = screen.getByRole('article');
    expect(card).toHaveClass(
      'shadow-none',
      'hover:translate-y-0',
      'hover:shadow-none',
      'rounded-[var(--mcp-card-radius,20px)]',
    );
    [
      'shadow-md',
      'hover:-translate-y-[3px]',
      'hover:shadow-lg',
      'rounded-[20px]',
    ].forEach((builtIn) => expect(card).not.toHaveClass(builtIn));
  });

  it('shows the initials in a decorative 2.0 avatar and the kind label', () => {
    renderCard(toData(withFailures));
    expect(
      screen.getByText('GM').closest('[aria-hidden="true"]'),
    ).not.toBeNull();
    expect(screen.getByText('Skill')).toHaveClass('text-info');
  });

  it('renders an agent with its sections between the header and the buttons', () => {
    renderCard(toData(agent));
    expect(
      screen.getByRole('heading', { name: 'Inbox Digest' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Agent')).toBeInTheDocument();
    const labels = screen
      .getAllByRole('region')
      .map((region) => region.getAttribute('aria-labelledby'))
      .map((id) => document.getElementById(id!)?.textContent);
    expect(labels).toEqual(['Your data', 'Tools', 'Prompt', 'Schedule']);
    expect(screen.getByRole('button', { name: /try it/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
  });

  it('places sections after the header and before the buttons', () => {
    renderCard(toData(agent));
    const after = Node.DOCUMENT_POSITION_FOLLOWING;
    const heading = screen.getByRole('heading', { name: 'Inbox Digest' });
    const regions = screen.getAllByRole('region');
    const first = regions[0]!;
    const last = regions.at(-1)!;
    const tryIt = screen.getByRole('button', { name: /try it/i });
    expect(heading.compareDocumentPosition(first) & after).toBeTruthy();
    expect(last.compareDocumentPosition(tryIt) & after).toBeTruthy();
  });

  it('renders sections with the same label both, in payload order', () => {
    renderCard(
      toData({
        entity: { name: 'dup', description: 'Duplicate labels.' },
        sections: [
          { type: 'text', label: 'Notes', text: 'first' },
          { type: 'text', label: 'Notes', text: 'second' },
        ],
      }),
    );
    expect(screen.getAllByRole('region', { name: 'Notes' })).toHaveLength(2);
    expect(screen.getByText('first')).toBeInTheDocument();
    expect(screen.getByText('second')).toBeInTheDocument();
  });

  it('renders a skill without sections', () => {
    renderCard(toData(withFailures));
    expect(screen.queryAllByRole('region')).toHaveLength(0);
    expect(screen.queryAllByRole('list')).toHaveLength(0);
    expect(
      screen.getByRole('heading', { name: 'good-morning-breakfast' }),
    ).toBeInTheDocument();
  });

  it('renders the description as 14px small text', () => {
    renderCard(toData(agent));
    expect(screen.getByText(/Summarizes your inbox every morning/)).toHaveClass(
      'text-sm',
    );
  });
});
