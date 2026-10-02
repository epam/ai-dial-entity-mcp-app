import {
  ToolResultStatus,
  useToolResult,
} from '@epam/ai-dial-mcp-app-kit/react';
import { type FC, memo, useEffect } from 'react';
import SkillCard from './components/SkillCard';
import SkillCardSkeleton from './components/SkillCardSkeleton';
import StatusNotice from './components/StatusNotice';
import { parseSkillCardPayload } from './contract';

const App: FC = () => {
  const result = useToolResult(parseSkillCardPayload);
  const invalidReason =
    result.status === ToolResultStatus.Invalid ? result.error : undefined;

  useEffect(() => {
    if (invalidReason)
      console.warn('[skill-card] invalid payload:', invalidReason);
  }, [invalidReason]);

  switch (result.status) {
    case ToolResultStatus.Loading:
      return <SkillCardSkeleton />;
    case ToolResultStatus.Error:
      return <StatusNotice message="Couldn't load skill" />;
    case ToolResultStatus.Invalid:
      return <StatusNotice message="Couldn't display this skill" />;
    case ToolResultStatus.Ready:
      return <SkillCard data={result.data} />;
  }
};

export default memo(App);
