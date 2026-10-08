import {
  DIAL_KIT_ICON_STROKE,
  NeutralButton,
  Notification,
  NotificationType,
  NotificationVariant,
  PrimaryButton,
} from '@epam/ai-dial-ui-kit';
import { useOpenLink } from '@epam/ai-dial-mcp-app-kit/react';
import { IconPencil, IconPlayerPlay } from '@tabler/icons-react';
import { type FC, memo, useCallback, useState } from 'react';
import type { EntityCardData } from '@epam/ai-dial-entity-contract';

type ActionButtonsProps = { actions: EntityCardData['actions'] };

const ActionButtons: FC<ActionButtonsProps> = ({ actions }) => {
  const openLink = useOpenLink();
  const [hasFailed, setHasFailed] = useState(false);

  const handleOpen = useCallback(
    async (url: string) => {
      setHasFailed(false);
      try {
        await openLink(url);
      } catch {
        setHasFailed(true);
      }
    },
    [openLink],
  );

  const { tryUrl, editUrl } = actions;
  if (!tryUrl && !editUrl) return null;

  return (
    <div className="flex flex-col gap-2 pl-[60px]">
      <div className="flex flex-wrap gap-2">
        {tryUrl && (
          <PrimaryButton
            label="Try it"
            iconBefore={
              <IconPlayerPlay
                size={20}
                stroke={DIAL_KIT_ICON_STROKE}
                aria-hidden="true"
              />
            }
            onClick={() => void handleOpen(tryUrl)}
          />
        )}
        {editUrl && (
          <NeutralButton
            label="Edit"
            iconBefore={
              <IconPencil
                size={20}
                stroke={DIAL_KIT_ICON_STROKE}
                aria-hidden="true"
              />
            }
            onClick={() => void handleOpen(editUrl)}
          />
        )}
      </div>
      {hasFailed && (
        <Notification
          type={NotificationType.SectionMessage}
          variant={NotificationVariant.Error}
          message="Couldn't open the link. Try again."
        />
      )}
    </div>
  );
};

export default memo(ActionButtons);
