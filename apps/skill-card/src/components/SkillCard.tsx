import { CardShell } from '@epam/ai-dial-ui-kit';
import { type FC, memo } from 'react';
import type { SkillCardData } from '../contract';
import ActionButtons from './ActionButtons';
import { STATIC_CARD_CLASS } from './cardSurface';
import QualityCheck from './QualityCheck';
import SkillHeader from './SkillHeader';

type SkillCardProps = { data: SkillCardData };

const SkillCard: FC<SkillCardProps> = ({ data }) => (
  <div className="flex flex-col gap-4">
    <CardShell className={`${STATIC_CARD_CLASS} gap-4`}>
      <SkillHeader skill={data.skill} />
      <ActionButtons actions={data.actions} />
    </CardShell>
    {data.qualityCheck && <QualityCheck qualityCheck={data.qualityCheck} />}
  </div>
);

export default memo(SkillCard);
