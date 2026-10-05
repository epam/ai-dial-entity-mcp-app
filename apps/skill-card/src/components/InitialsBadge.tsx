import { type FC, memo } from 'react';

type InitialsBadgeProps = { initials: string };

const InitialsBadge: FC<InitialsBadgeProps> = ({ initials }) => (
  <div
    aria-hidden="true"
    className="bg-accent-primary-alpha text-accent-primary flex size-11 shrink-0 items-center justify-center rounded-lg text-lg font-semibold"
  >
    {initials}
  </div>
);

export default memo(InitialsBadge);
