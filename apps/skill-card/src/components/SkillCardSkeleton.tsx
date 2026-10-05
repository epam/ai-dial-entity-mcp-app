import { Skeleton } from '@epam/ai-dial-ui-kit';
import { type FC, memo } from 'react';

const SkillCardSkeleton: FC = () => (
  <div
    data-testid="skill-card-skeleton"
    aria-busy="true"
    className="bg-layer-1 rounded-xl p-5"
  >
    <Skeleton active avatar paragraph={{ rows: 3 }} />
  </div>
);

export default memo(SkillCardSkeleton);
