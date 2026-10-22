import { z } from 'zod';

export const RENDER_TOOL_DESCRIPTION =
  "Draws a card for an entity from data you already have; nothing is looked up. Use it when another tool or system returned the entity's details (name, description, links, tools, prompt) and you want to show them as a card. Do not use it when you only have an entity id or name: call `show_entity_card` for that. Pass only what you actually know; leave out optional parts rather than inventing them.";

const nonEmpty = (max: number) => z.string().trim().min(1).max(max);

const httpUrl = z
  .string()
  .trim()
  .max(2048)
  .pipe(z.url({ protocol: /^https?$/ }));

const entitySchema = z.object({
  name: nonEmpty(200).describe('Entity name, shown as the card title.'),
  description: nonEmpty(2000).describe('Short description of the entity.'),
  kindLabel: nonEmpty(40)
    .optional()
    .describe('Entity type shown above the name, e.g. "Agent" or "Skill".'),
  initials: nonEmpty(20)
    .optional()
    .describe(
      'Avatar initials, at most three characters are used; derived from the name when omitted.',
    ),
});

const actionsSchema = z.object({
  tryUrl: httpUrl
    .optional()
    .describe('http(s) link for the "Try it" button; omit if unknown.'),
  editUrl: httpUrl
    .optional()
    .describe('http(s) link for the "Edit" button; omit if unknown.'),
});

const chipsSectionSchema = z.object({
  type: z.literal('chips'),
  label: nonEmpty(100),
  items: z.array(nonEmpty(200)).min(1).max(50),
});

const textSectionSchema = z.object({
  type: z.literal('text'),
  label: nonEmpty(100),
  text: nonEmpty(10000),
});

const sectionSchema = z.discriminatedUnion('type', [
  chipsSectionSchema,
  textSectionSchema,
]);

export const renderCardInputSchema = {
  entity: entitySchema,
  actions: actionsSchema
    .optional()
    .describe('Buttons shown on the card; leave out when there are no links.'),
  sections: z
    .array(sectionSchema)
    .max(20)
    .optional()
    .describe(
      'Labelled rows under the description, in order: `chips` (list of short strings, e.g. tools or data sources) or `text` (a paragraph, e.g. a prompt).',
    ),
};

export type RenderCardInput = z.infer<
  z.ZodObject<typeof renderCardInputSchema>
>;

/**
 * Builds the card payload from caller-supplied data, dropping parts that
 * were not provided so the result is the same shape `show_entity_card` returns.
 * @param input - validated arguments of `render_entity_card`
 */
export const buildRenderedPayload = ({
  entity,
  actions,
  sections,
}: RenderCardInput) => ({
  entity: {
    ...entity,
    ...(entity.initials && { initials: entity.initials.slice(0, 3) }),
  },
  actions: {
    ...(actions?.tryUrl && { tryUrl: actions.tryUrl }),
    ...(actions?.editUrl && { editUrl: actions.editUrl }),
  },
  sections: sections ?? [],
});
