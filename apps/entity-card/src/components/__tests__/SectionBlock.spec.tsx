import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SectionType } from '@epam/ai-dial-entity-contract';
import SectionBlock from '../SectionBlock';

describe('SectionBlock', () => {
  it('renders a labelled region with one list item per chip', () => {
    render(
      <SectionBlock
        section={{
          type: SectionType.Chips,
          label: 'Tools',
          items: ['Urgency scorer', 'Thread summarizer'],
        }}
      />,
    );
    const region = screen.getByRole('region', { name: 'Tools' });
    const items = within(region).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      'Urgency scorer',
      'Thread summarizer',
    ]);
  });

  it('renders the label as secondary text that names the region, not a heading', () => {
    render(
      <SectionBlock
        section={{ type: SectionType.Text, label: 'Prompt', text: 'x' }}
      />,
    );
    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.getByRole('region', { name: 'Prompt' })).toBeInTheDocument();
    expect(screen.getByText('Prompt')).toHaveClass('text-xs', 'text-secondary');
  });

  it('renders duplicate chip labels as separate items', () => {
    render(
      <SectionBlock
        section={{ type: SectionType.Chips, label: 'Data', items: ['a', 'a'] }}
      />,
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('truncates a very long chip label instead of overflowing', () => {
    const long = `${'x'.repeat(200)}.csv`;
    render(
      <SectionBlock
        section={{ type: SectionType.Chips, label: 'Data', items: [long] }}
      />,
    );
    const item = screen.getByRole('listitem');
    expect(item).toHaveClass('min-w-0', 'max-w-full');
    expect(screen.getByText(long)).toHaveClass('truncate', 'text-xs');
  });

  it('renders text with its line breaks kept and long words wrapped', () => {
    render(
      <SectionBlock
        section={{
          type: SectionType.Text,
          label: 'Prompt',
          text: 'line one\nline two https://example.com/a-very-long-url',
        }}
      />,
    );
    const region = screen.getByRole('region', { name: 'Prompt' });
    const paragraph = within(region).getByText(/line one/);
    expect(paragraph).toHaveClass(
      'whitespace-pre-line',
      'break-words',
      'text-sm',
    );
    expect(paragraph.textContent).toBe(
      'line one\nline two https://example.com/a-very-long-url',
    );
  });
});
