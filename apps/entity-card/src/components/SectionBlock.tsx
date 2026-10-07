import { Badge } from '@epam/ai-dial-ui-kit';
import { type FC, memo, useId } from 'react';
import { type CardSection, SectionType } from '@epam/ai-dial-entity-contract';

type SectionBlockProps = { section: CardSection };

const SectionBlock: FC<SectionBlockProps> = ({ section }) => {
  const labelId = useId();

  return (
    <section
      aria-labelledby={labelId}
      className="flex min-w-0 flex-col gap-2 pl-[60px]"
    >
      <p id={labelId} className="text-xs text-secondary">
        {section.label}
      </p>
      {section.type === SectionType.Chips ? (
        <ul className="flex flex-wrap gap-2">
          {section.items.map((item, index) => (
            <li key={`${item}-${index}`} className="min-w-0 max-w-full">
              <Badge
                label={item}
                className="max-w-full"
                textClassName="truncate text-xs"
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="whitespace-pre-line break-words text-sm text-primary">
          {section.text}
        </p>
      )}
    </section>
  );
};

export default memo(SectionBlock);
