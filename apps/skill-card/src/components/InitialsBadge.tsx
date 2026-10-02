import { type FC, memo } from 'react';

type InitialsBadgeProps = { initials: string };

const InitialsBadge: FC<InitialsBadgeProps> = ({ initials }) => (
  <div
    aria-hidden="true"
    className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-accent-primary-alpha text-lg font-semibold text-accent-primary"
  >
    {initials}
  </div>
);

export default memo(InitialsBadge);
