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

describe('QualityCheck', () => {
  it('renders expanded with the percent badge and all items', () => {
    render(<QualityCheck qualityCheck={qualityCheck} />);
    const toggle = screen.getByRole('button', { name: /quality check/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('92% passed')).toBeInTheDocument();
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

  it('collapses and expands with mouse and keyboard', async () => {
    render(<QualityCheck qualityCheck={qualityCheck} />);
    const toggle = screen.getByRole('button', { name: /quality check/i });
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('list')).toBeNull();
    toggle.focus();
    await userEvent.keyboard('{Enter}');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('list')).toBeInTheDocument();
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
    expect(screen.getByText('92% passed')).toHaveAttribute(
      'data-tone',
      'success',
    );
  });

  it.each([
    [92, 'success'],
    [60, 'warning'],
    [10, 'error'],
  ])('uses the %d%% tone %s on the badge', (passedPercent, tone) => {
    render(<QualityCheck qualityCheck={{ passedPercent, items: [] }} />);
    expect(screen.getByText(`${passedPercent}% passed`)).toHaveAttribute(
      'data-tone',
      tone,
    );
  });
});
