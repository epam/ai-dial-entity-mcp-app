import { type FC, memo } from 'react';
import type { SkillCardData } from '../contract';
import ActionButtons from './ActionButtons';
import QualityCheck from './QualityCheck';
import SkillHeader from './SkillHeader';

type SkillCardProps = { data: SkillCardData };

const SkillCard: FC<SkillCardProps> = ({ data }) => (
  <div className="flex flex-col gap-4">
    <article className="bg-layer-1 rounded-xl p-5">
      <SkillHeader skill={data.skill} />
      <ActionButtons actions={data.actions} />
    </article>
    {data.qualityCheck && <QualityCheck qualityCheck={data.qualityCheck} />}
  </div>
);

export default memo(SkillCard);
