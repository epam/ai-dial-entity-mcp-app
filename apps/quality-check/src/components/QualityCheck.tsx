import {
  Accordion,
  AccordionCaretPosition,
  Badge,
  BadgeColor,
  BadgeVariant,
  DIAL_KIT_ICON_STROKE,
} from '@epam/ai-dial-ui-kit';
import { IconCheck, IconX } from '@tabler/icons-react';
import { type FC, memo } from 'react';
import type { QualityCheckData } from '../contract';
import { getPassTone, PassTone } from '../qualityTone';
import { CARD_RADIUS_CLASS } from './cardSurface';

/** Badge colour per tone; the `mcp-tone-*` class re-points it at the host's tone tokens. */
const TONE_BADGE: Record<PassTone, { color: BadgeColor; className: string }> = {
  [PassTone.Success]: {
    color: BadgeColor.Green,
    className: 'mcp-tone-success',
  },
  [PassTone.Warning]: {
    color: BadgeColor.Brown,
    className: 'mcp-tone-warning',
  },
  [PassTone.Error]: { color: BadgeColor.Red, className: 'mcp-tone-danger' },
};

type QualityCheckProps = { qualityCheck: QualityCheckData };

const QualityCheck: FC<QualityCheckProps> = ({ qualityCheck }) => {
  const tone = getPassTone(qualityCheck.passedPercent);
  const badge = TONE_BADGE[tone];

  return (
    <Accordion
      defaultExpanded
      caretPosition={AccordionCaretPosition.Start}
      className={`${CARD_RADIUS_CLASS} border border-secondary`}
      headerClassName="hover:bg-transparent [&>span]:flex-1"
      title={
        <span className="flex items-center justify-between gap-3">
          <span className="truncate text-md font-semibold text-primary">
            Quality check
          </span>
          <Badge
            variant={BadgeVariant.Filled}
            color={badge.color}
            className={badge.className}
            data-tone={tone}
            label={`${qualityCheck.passedPercent}% passed`}
            textClassName="text-xs font-semibold uppercase tracking-wider"
          />
        </span>
      }
    >
      <ul className="relative flex flex-col gap-3">
        {qualityCheck.items.map((item, index) => (
          <li
            key={`${item.id}-${index}`}
            className="flex gap-3 text-md text-primary"
          >
            {item.passed ? (
              <IconCheck
                size={20}
                stroke={DIAL_KIT_ICON_STROKE}
                aria-hidden="true"
                className="shrink-0 text-success"
              />
            ) : (
              <IconX
                size={20}
                stroke={DIAL_KIT_ICON_STROKE}
                aria-hidden="true"
                className="shrink-0 text-error"
              />
            )}
            <div className="min-w-0">
              <span className="sr-only">
                {item.passed ? 'Passed: ' : 'Failed: '}
              </span>
              <span className="break-words">{item.label}</span>
              {!item.passed && item.hint && (
                <p className="mt-1 text-sm break-words text-secondary">
                  {item.hint}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Accordion>
  );
};

export default memo(QualityCheck);
