import { createDeploymentType, mapDeployment } from './deployment.ts';
import { nonEmptyText, pickField } from './shared.ts';
import { EntityKind } from './types.ts';

export const toolsetType = createDeploymentType({
  kind: EntityKind.Toolset,
  route: 'toolsets',
  idPrefix: 'toolsets/',
  map: (raw, activeLocale) => {
    const allowed = pickField(raw, 'allowed_tools', 'allowedTools');
    const tools = Array.isArray(allowed)
      ? allowed.flatMap((tool) => nonEmptyText(tool) ?? [])
      : [];
    return {
      ...mapDeployment(raw, activeLocale, 'Toolset'),
      sections: tools.length
        ? [{ type: 'chips', label: 'Tools', items: tools }]
        : [],
    };
  },
});
