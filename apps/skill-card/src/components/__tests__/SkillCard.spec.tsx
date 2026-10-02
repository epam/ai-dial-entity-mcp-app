import { createFakeMcpApp } from '@epam/ai-dial-mcp-app-kit/testing';
import { McpAppProvider } from '@epam/ai-dial-mcp-app-kit/react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import withFailures from '../../../fixtures/with-failures.json';
import noQualityCheck from '../../../fixtures/no-quality-check.json';
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
  it('renders header, actions and quality check', () => {
    renderCard(toData(withFailures));
    expect(
      screen.getByRole('heading', { name: 'good-morning-breakfast' }),
    ).toBeInTheDocument();
    expect(screen.getByText('GM')).toBeInTheDocument();
    expect(screen.getByText('Skill')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try it/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /quality check/i }),
    ).toBeInTheDocument();
  });

  it('omits the quality check section when absent', () => {
    renderCard(toData(noQualityCheck));
    expect(screen.queryByRole('button', { name: /quality check/i })).toBeNull();
  });
});
