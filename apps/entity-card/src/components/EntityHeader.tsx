import { Avatar, AvatarShape } from '@epam/ai-dial-ui-kit';
import { type FC, memo } from 'react';
import type { EntityCardData } from '@epam/ai-dial-entity-contract';

type EntityHeaderProps = { entity: EntityCardData['entity'] };

const EntityHeader: FC<EntityHeaderProps> = ({ entity }) => (
  <header className="flex min-w-0 gap-4">
    <Avatar
      name={entity.name}
      initials={entity.initials}
      shape={AvatarShape.Square}
      size={44}
    />
    <div className="min-w-0 flex-1">
      <p className="text-xs font-semibold uppercase tracking-wider text-info">
        {entity.kindLabel}
      </p>
      <h1 className="mt-1 break-words text-heading-md font-semibold text-primary">
        {entity.name}
      </h1>
      <p className="mt-2 break-words text-sm text-primary">
        {entity.description}
      </p>
    </div>
  </header>
);

export default memo(EntityHeader);
