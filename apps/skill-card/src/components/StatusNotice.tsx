import { IconAlertCircle } from '@tabler/icons-react';
import { type FC, memo } from 'react';

type StatusNoticeProps = { message: string };

const StatusNotice: FC<StatusNoticeProps> = ({ message }) => (
  <div
    role="status"
    className="flex items-center gap-2 rounded-xl bg-layer-2 p-4 text-sm text-secondary"
  >
    <IconAlertCircle
      size={18}
      aria-hidden="true"
      className="shrink-0 text-error"
    />
    {message}
  </div>
);

export default memo(StatusNotice);
