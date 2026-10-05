import { IconCheck, IconChevronDown, IconX } from '@tabler/icons-react';
import { type FC, memo, useCallback, useId, useState } from 'react';
import type { QualityCheckData } from '../contract';
import { getPassTone, PassTone } from '../qualityTone';

const TONE_CLASSES: Record<PassTone, string> = {
  [PassTone.Success]: 'bg-success text-success',
  [PassTone.Warning]: 'bg-warning text-warning',
  [PassTone.Error]: 'bg-error text-error',
};

type QualityCheckProps = { qualityCheck: QualityCheckData };

const QualityCheck: FC<QualityCheckProps> = ({ qualityCheck }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const listId = useId();
  const tone = getPassTone(qualityCheck.passedPercent);

  const handleToggle = useCallback(() => setIsExpanded((value) => !value), []);

  return (
    <section className="bg-layer-2 rounded-xl border border-secondary p-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-expanded={isExpanded}
          aria-controls={listId}
          onClick={handleToggle}
          className="flex flex-1 items-center gap-3 text-left text-sm font-semibold text-primary"
        >
          <IconChevronDown
            size={18}
            aria-hidden="true"
            className={
              isExpanded
                ? 'rotate-180 transition-transform'
                : 'transition-transform'
            }
          />
          Quality check
        </button>
        <span
          data-tone={tone}
          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${TONE_CLASSES[tone]}`}
        >
          {`${qualityCheck.passedPercent}% passed`}
        </span>
      </div>
      <ul id={listId} hidden={!isExpanded} className="mt-4 flex flex-col gap-3">
        {qualityCheck.items.map((item, index) => (
          <li
            key={`${item.id}-${index}`}
            className="flex gap-3 text-sm text-primary"
          >
            {item.passed ? (
              <IconCheck
                size={18}
                aria-hidden="true"
                className="shrink-0 text-success"
              />
            ) : (
              <IconX
                size={18}
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
                <p className="mt-1 break-words text-xs text-secondary">
                  {item.hint}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default memo(QualityCheck);
