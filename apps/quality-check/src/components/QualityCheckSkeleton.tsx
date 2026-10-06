import { CardShell, Skeleton } from '@epam/ai-dial-ui-kit';
import { type FC, memo } from 'react';
import { CARD_RADIUS_CLASS } from './cardSurface';

/**
 * Skeleton bars are `bg-layer-raised`, the card's own colour; the wrapper
 * re-points that variable at the sunken layer so the bars stay visible.
 */
const QualityCheckSkeleton: FC = () => (
  <CardShell
    data-testid="quality-check-skeleton"
    aria-busy="true"
    className={`${CARD_RADIUS_CLASS} shadow-none transition-none hover:translate-y-0 hover:shadow-none`}
  >
    <div className="[--bg-layer-raised:var(--bg-layer-sunken)]">
      <Skeleton active paragraph={{ rows: 3 }} />
    </div>
  </CardShell>
);

export default memo(QualityCheckSkeleton);
