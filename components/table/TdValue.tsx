import { TDState } from '@/lib/types';
import { getTdDisplay } from '@/lib/utils';

/**
 * TD Sequential value — "B 4" / "S 12".
 *
 * The letter and the count sit in a fixed 24px slot with the letter flush left, so
 * the B/S lands on the same vertical line on every row even though 10-13 are two
 * digits wide. The slot is what gets centred in the cell (and inside the signal
 * pill, which is exactly slot + padding), keeping faded text and pills on one line.
 */
export function TdValue({ td }: { td: TDState | null | undefined }) {
  const { letter, count, label, className, title } = getTdDisplay(td);

  return (
    <span title={title} className={className}>
      {letter ? (
        <span className="inline-flex w-[24px]">
          <span>{letter}</span>
          <span className="ml-[4px]">{count}</span>
        </span>
      ) : (
        label
      )}
    </span>
  );
}
