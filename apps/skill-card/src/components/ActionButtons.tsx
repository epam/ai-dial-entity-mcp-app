import { DialNeutralButton, DialPrimaryButton } from '@epam/ai-dial-ui-kit';
import { useOpenLink } from '@epam/ai-dial-mcp-app-kit/react';
import { IconPencil, IconPlayerPlay } from '@tabler/icons-react';
import { type FC, memo, useCallback, useState } from 'react';
import type { SkillCardData } from '../contract';

type ActionButtonsProps = { actions: SkillCardData['actions'] };

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
    <div className="mt-4 flex flex-col gap-2 pl-[60px]">
      <div className="flex flex-wrap gap-2">
        {tryUrl && (
          <DialPrimaryButton
            label="Try it"
            iconBefore={<IconPlayerPlay size={16} aria-hidden="true" />}
            onClick={() => void handleOpen(tryUrl)}
          />
        )}
        {editUrl && (
          <DialNeutralButton
            label="Edit"
            iconBefore={<IconPencil size={16} aria-hidden="true" />}
            onClick={() => void handleOpen(editUrl)}
          />
        )}
      </div>
      {hasFailed && (
        <p role="alert" className="text-xs text-error">
          Couldn't open the link. Try again.
        </p>
      )}
    </div>
  );
};

export default memo(ActionButtons);
