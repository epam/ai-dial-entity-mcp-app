import { CardShell, Skeleton } from '@epam/ai-dial-ui-kit';
import { type FC, memo } from 'react';
import { STATIC_CARD_CLASS } from './cardSurface';

/**
 * Skeleton bars are `bg-layer-raised`, the card's own colour; the wrapper
 * re-points that variable at the sunken layer so the bars stay visible.
 */
const SkillCardSkeleton: FC = () => (
  <CardShell
    data-testid="skill-card-skeleton"
    aria-busy="true"
    className={STATIC_CARD_CLASS}
  >
    <div className="[--bg-layer-raised:var(--bg-layer-sunken)]">
      <Skeleton active avatar paragraph={{ rows: 3 }} />
    </div>
  </CardShell>
);

export default memo(SkillCardSkeleton);
