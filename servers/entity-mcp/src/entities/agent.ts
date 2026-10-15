import { createDeploymentType, mapDeployment } from './deployment.ts';
import { EntityKind } from './types.ts';

export const agentType = createDeploymentType({
  kind: EntityKind.Agent,
  route: 'applications',
  idPrefix: 'applications/',
  namesType: 'application',
  map: (raw, activeLocale) => ({
    ...mapDeployment(raw, activeLocale, 'Agent'),
    sections: [],
  }),
});
