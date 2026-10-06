import { CardShell } from '@epam/ai-dial-ui-kit';
import { type FC, memo } from 'react';
import type { SkillCardData } from '../contract';
import ActionButtons from './ActionButtons';
import { STATIC_CARD_CLASS } from './cardSurface';
import SkillHeader from './SkillHeader';

type SkillCardProps = { data: SkillCardData };

const SkillCard: FC<SkillCardProps> = ({ data }) => (
  <CardShell className={`${STATIC_CARD_CLASS} gap-4`}>
    <SkillHeader skill={data.skill} />
    <ActionButtons actions={data.actions} />
  </CardShell>
);

export default memo(SkillCard);
