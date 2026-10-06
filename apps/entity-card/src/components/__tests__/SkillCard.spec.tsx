import { createFakeMcpApp } from '@epam/ai-dial-mcp-app-kit/testing';
import { McpAppProvider } from '@epam/ai-dial-mcp-app-kit/react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import withFailures from '../../../fixtures/default.json';
import { parseSkillCardPayload, type SkillCardData } from '../../contract';
import SkillCard from '../SkillCard';

const toData = (raw: unknown): SkillCardData => {
  const result = parseSkillCardPayload(raw);
  if (!result.ok) throw new Error(result.reason);
  return result.data;
};

const renderCard = (data: SkillCardData) =>
  render(
    <McpAppProvider app={createFakeMcpApp()}>
      <SkillCard data={data} />
    </McpAppProvider>,
  );

describe('SkillCard', () => {
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
});
