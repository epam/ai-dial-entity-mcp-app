import { Avatar, AvatarShape } from '@epam/ai-dial-ui-kit';
import { type FC, memo } from 'react';
import type { SkillCardData } from '../contract';

type SkillHeaderProps = { skill: SkillCardData['skill'] };

const SkillHeader: FC<SkillHeaderProps> = ({ skill }) => (
  <header className="flex min-w-0 gap-4">
    <Avatar
      name={skill.name}
      initials={skill.initials}
      shape={AvatarShape.Square}
      size={44}
    />
    <div className="min-w-0 flex-1">
      <p className="text-xs font-semibold uppercase tracking-wider text-info">
        {skill.kindLabel}
      </p>
      <h1 className="mt-1 break-words text-heading-md font-semibold text-primary">
        {skill.name}
      </h1>
      <p className="mt-2 break-words text-md text-primary">
        {skill.description}
      </p>
    </div>
  </header>
);

export default memo(SkillHeader);
