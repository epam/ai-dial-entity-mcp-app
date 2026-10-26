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
      <p className="text-xs font-semibold tracking-wider text-info uppercase">
        {entity.kindLabel}
      </p>
      <h1 className="mt-1 text-heading-md font-semibold break-words text-primary">
        {entity.name}
      </h1>
      <p className="mt-2 text-sm break-words text-primary">
        {entity.description}
      </p>
    </div>
  </header>
);

export default memo(EntityHeader);
