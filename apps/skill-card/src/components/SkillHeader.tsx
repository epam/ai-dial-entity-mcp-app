import { type FC, memo } from 'react';
import type { SkillCardData } from '../contract';
import InitialsBadge from './InitialsBadge';

type SkillHeaderProps = { skill: SkillCardData['skill'] };

const SkillHeader: FC<SkillHeaderProps> = ({ skill }) => (
  <header className="flex min-w-0 gap-4">
    <InitialsBadge initials={skill.initials} />
    <div className="min-w-0 flex-1">
      <p className="text-xs font-semibold uppercase tracking-wider text-accent-primary">
        {skill.kindLabel}
      </p>
      <h1 className="mt-1 break-words text-base font-semibold text-primary">
        {skill.name}
      </h1>
      <p className="mt-2 break-words text-sm text-secondary">
        {skill.description}
      </p>
    </div>
  </header>
);

export default memo(SkillHeader);
