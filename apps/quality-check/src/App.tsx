import {
  Notification,
  NotificationType,
  NotificationVariant,
} from '@epam/ai-dial-ui-kit';
import {
  ToolResultStatus,
  useToolResult,
} from '@epam/ai-dial-mcp-app-kit/react';
import { type FC, memo, useEffect } from 'react';
import QualityCheck from './components/QualityCheck';
import QualityCheckSkeleton from './components/QualityCheckSkeleton';
import { parseQualityCheckPayload } from './contract';

const App: FC = () => {
  const result = useToolResult(parseQualityCheckPayload);
  const invalidReason =
    result.status === ToolResultStatus.Invalid ? result.error : undefined;

  useEffect(() => {
    if (invalidReason)
      console.warn('[quality-check] invalid payload:', invalidReason);
  }, [invalidReason]);

  switch (result.status) {
    case ToolResultStatus.Loading:
      return <QualityCheckSkeleton />;
    case ToolResultStatus.Error:
      return (
        <Notification
          type={NotificationType.SectionMessage}
          variant={NotificationVariant.Error}
          message="Couldn't load quality check"
        />
      );
    case ToolResultStatus.Invalid:
      return (
        <Notification
          type={NotificationType.SectionMessage}
          variant={NotificationVariant.Warning}
          message="Couldn't display this quality check"
        />
      );
    case ToolResultStatus.Ready:
      return <QualityCheck qualityCheck={result.data} />;
  }
};

export default memo(App);
