import { afterEach, describe, expect, test, vi } from 'vitest';
import { IncompleteEntity } from './shared.ts';
import { promptType } from './prompt.ts';
import { TEST_CTX, mockCore } from './test-utils.ts';
import { EntityKind } from './types.ts';

afterEach(() => vi.restoreAllMocks());

describe('promptType', () => {
  test('matchesId only for the prompts/ prefix', () => {
    expect(promptType.matchesId('prompts/b/x')).toBe(true);
    expect(promptType.matchesId('skills/b/x')).toBe(false);
  });

  test('fetch reads /v1/prompts with encoded segments', async () => {
    const spy = mockCore({ '/v1/prompts/b/folder/my%20prompt': {} });
    await promptType.fetch(TEST_CTX, 'prompts/b/folder/my prompt');
    expect(String(spy.mock.calls[0]![0])).toBe(
      'https://core.example.com/v1/prompts/b/folder/my%20prompt',
    );
  });

  test('map uses the name, a one-line description from content and a Prompt text section', () => {
    expect(
      promptType.map(
        { name: 'Greeter', content: 'Say hello.\n\nBe   brief.' },
        'en',
      ),
    ).toEqual({
      name: 'Greeter',
      description: 'Say hello. Be brief.',
      kindLabel: 'Prompt',
      sections: [
        { type: 'text', label: 'Prompt', text: 'Say hello.\n\nBe   brief.' },
      ],
    });
  });

  test("map prefers the record's own description", () => {
    expect(
      promptType.map(
        { name: 'n', description: 'Greets people.', content: 'Say hello.' },
        'en',
      ).description,
    ).toBe('Greets people.');
  });

  test('map cuts a long description at 200 characters with an ellipsis', () => {
    const mapped = promptType.map(
      { name: 'n', content: 'a'.repeat(500) },
      'en',
    );
    expect(mapped.description).toBe(`${'a'.repeat(200)}…`);
  });

  test('map throws IncompleteEntity without content or name', () => {
    expect(() => promptType.map({ name: 'n' }, 'en')).toThrow(IncompleteEntity);
    expect(() => promptType.map({ content: 'c' }, 'en')).toThrow(
      IncompleteEntity,
    );
  });

  test('list returns bucket prompts by name with no inline record', async () => {
    mockCore({
      '/v1/bucket': { bucket: 'bkt' },
      '/v1/metadata/prompts/bkt/?recursive=true&limit=1000': {
        items: [
          {
            nodeType: 'ITEM',
            name: 'Greeter',
            url: 'prompts/bkt/folder/Greeter',
          },
          { nodeType: 'FOLDER', name: 'folder', url: 'prompts/bkt/folder/' },
        ],
      },
    });
    await expect(promptType.list(TEST_CTX)).resolves.toEqual([
      {
        kind: EntityKind.Prompt,
        id: 'prompts/bkt/folder/Greeter',
        names: ['Greeter'],
      },
    ]);
  });
});
