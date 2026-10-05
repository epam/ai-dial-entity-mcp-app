import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { parseSkillCardPayload } from '../../contract';
import QualityCheck from '../QualityCheck';

const qualityCheck = {
  passedPercent: 92,
  items: [
    { id: 'a', label: 'Trigger phrases', passed: true },
    {
      id: 'b',
      label: 'Inherits firm standards',
      passed: false,
      hint: 'Inherit style.',
    },
    { id: 'b', label: 'Duplicate id item', passed: true },
  ],
};

const badgeFor = (percent: number) =>
  screen.getByText(`${percent}% passed`).parentElement!;

const contentOf = (toggle: HTMLElement) =>
  document.getElementById(toggle.getAttribute('aria-controls')!)!;

describe('QualityCheck', () => {
  it('renders expanded with the percent badge and all items', () => {
    render(<QualityCheck qualityCheck={qualityCheck} />);
    const toggle = screen.getByRole('button', { name: /quality check/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toContainElement(badgeFor(92));
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText('Duplicate id item')).toBeInTheDocument();
  });

  it('announces pass/fail state and shows hints only for failed items', () => {
    render(<QualityCheck qualityCheck={qualityCheck} />);
    const [first, second] = screen.getAllByRole('listitem');
    expect(first).toHaveTextContent('Passed: Trigger phrases');
    expect(second).toHaveTextContent('Failed: Inherits firm standards');
    expect(second).toHaveTextContent('Inherit style.');
  });

  it('has no hover background on the header (the block is not a hover target)', () => {
    render(<QualityCheck qualityCheck={qualityCheck} />);
    const toggle = screen.getByRole('button', { name: /quality check/i });
    expect(toggle).not.toHaveClass('hover:bg-control-accent-alpha-hover');
    expect(toggle).toHaveClass('hover:bg-transparent');
  });

  it('makes collapsed content inert and restores it on expand (mouse and keyboard)', async () => {
    render(<QualityCheck qualityCheck={qualityCheck} />);
    const toggle = screen.getByRole('button', { name: /quality check/i });
    expect(contentOf(toggle).closest('[inert]')).toBeNull();
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(contentOf(toggle).closest('[inert]')).not.toBeNull();
    toggle.focus();
    await userEvent.keyboard('{Enter}');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(contentOf(toggle).closest('[inert]')).toBeNull();
  });

  it('shows a fractional server percentage rounded', () => {
    const parsed = parseSkillCardPayload({
      skill: { name: 'a', description: 'b' },
      actions: {},
      qualityCheck: { passedPercent: 91.666, items: [] },
    });
    if (!parsed.ok || !parsed.data.qualityCheck)
      throw new Error('fixture must parse');
    render(<QualityCheck qualityCheck={parsed.data.qualityCheck} />);
    expect(badgeFor(92)).toHaveAttribute('data-tone', 'success');
  });

  it.each([
    [92, 'success', 'mcp-tone-success'],
    [60, 'warning', 'mcp-tone-warning'],
    [10, 'error', 'mcp-tone-danger'],
  ])(
    'gives a %d percent badge tone %s via %s',
    (passedPercent, tone, toneClass) => {
      render(<QualityCheck qualityCheck={{ passedPercent, items: [] }} />);
      const badge = badgeFor(passedPercent);
      expect(badge).toHaveAttribute('data-tone', tone);
      expect(badge).toHaveClass(toneClass);
    },
  );
});
