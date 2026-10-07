import { CardShell } from '@epam/ai-dial-ui-kit';
import { type FC, memo } from 'react';
import type { EntityCardData } from '@epam/ai-dial-entity-contract';
import ActionButtons from './ActionButtons';
import { STATIC_CARD_CLASS } from './cardSurface';
import EntityHeader from './EntityHeader';
import SectionBlock from './SectionBlock';

type EntityCardProps = { data: EntityCardData };

const EntityCard: FC<EntityCardProps> = ({ data }) => (
  <CardShell className={`${STATIC_CARD_CLASS} gap-4`}>
    <EntityHeader entity={data.entity} />
    {data.sections.map((section, index) => (
      <SectionBlock key={`${section.label}-${index}`} section={section} />
    ))}
    <ActionButtons actions={data.actions} />
  </CardShell>
);

export default memo(EntityCard);
