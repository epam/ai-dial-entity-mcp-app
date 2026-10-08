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
import EntityCard from './components/EntityCard';
import EntityCardSkeleton from './components/EntityCardSkeleton';
import { parseEntityCardPayload } from '@epam/ai-dial-entity-contract';

const DEFAULT_ERROR_MESSAGE = "Couldn't load entity";

/**
 * Picks the error notification text: the tool result's own message when it
 * has non-whitespace content, otherwise the generic fallback.
 * @param error - the tool result's optional error text
 */
const getErrorMessage = (error: string | undefined): string => {
  if (error?.trim()) return error;
  return DEFAULT_ERROR_MESSAGE;
};

const App: FC = () => {
  const result = useToolResult(parseEntityCardPayload);
  const invalidReason =
    result.status === ToolResultStatus.Invalid ? result.error : undefined;

  useEffect(() => {
    if (invalidReason)
      console.warn('[entity-card] invalid payload:', invalidReason);
  }, [invalidReason]);

  switch (result.status) {
    case ToolResultStatus.Loading:
      return <EntityCardSkeleton />;
    case ToolResultStatus.Error:
      return (
        <Notification
          type={NotificationType.SectionMessage}
          variant={NotificationVariant.Error}
          message={getErrorMessage(result.error)}
        />
      );
    case ToolResultStatus.Invalid:
      return (
        <Notification
          type={NotificationType.SectionMessage}
          variant={NotificationVariant.Warning}
          message="Couldn't display this entity"
        />
      );
    case ToolResultStatus.Ready:
      return <EntityCard data={result.data} />;
  }
};

export default memo(App);
