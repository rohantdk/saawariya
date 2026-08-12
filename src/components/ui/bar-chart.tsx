import { formatPaise } from "@/lib/utils";
import type { SeriesPoint } from "@/lib/reporting/series";

/**
 * One bar series over time, with the figures underneath.
 *
 * No charting library. This is a single series of divs with a percentage
 * height; a dependency that ships a canvas renderer to draw twelve rectangles is
 * a poor trade in a project the client has to `npm install` on their own
 * machine. Phase 5 built it inline on the seller report and Phase 8 needed the
 * same thing for finance, so it moved here rather than being pasted.
 *
 * The bars are decorative. Every value is also reachable as text — a screen
 * reader gets the `sr-only` sentence per bar, and anybody can open "See the
 * figures" for the table. A hover tooltip would put the actual numbers out of
 * reach of a keyboard, which for a page whose entire purpose is the numbers is
 * not a detail.
 */
export function BarChart({
  series,
  countNoun,
  emptyMessage,
}: {
  series: SeriesPoint[];
  /** Singular noun for the count behind each bar — "order", "payout". */
  countNoun: string;
  emptyMessage: string;
}) {
  const peak = Math.max(...series.map((point) => point.value), 1);
  const total = series.reduce((sum, point) => sum + point.value, 0);

  if (total === 0) {
    return (
      <p className="border border-ivory-400 bg-ivory-50 px-5 py-4 text-sm text-ink-400">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="border border-ivory-400 bg-ivory-50 p-5">
      {/*
        `gap-px` until there is room for `gap-1`.

        A 90-day range renders 91 bars, and at a 4px gap the gutters alone need
        360px — more than the whole 335px content column on a 375px screen. The
        bars themselves shrink to nothing (they are `flex-1 min-w-0`), but a gap
        is a fixed length that no amount of shrinking recovers, so the list
        pushed the page into horizontal scroll. Same family as the Phase 6
        `min-width: auto` finding: the thing that would not shrink was not the
        content this time, it was the space between it.
      */}
      <ol className="flex h-48 items-end gap-px sm:gap-1">
        {series.map((point, index) => (
          <li
            key={`${point.label}-${index}`}
            className="group relative flex h-full min-w-0 flex-1 flex-col justify-end"
          >
            <span
              className="w-full bg-brand-600/80 transition-colors group-hover:bg-brand-600"
              style={{
                height: `${Math.max(
                  (point.value / peak) * 100,
                  point.value > 0 ? 2 : 0,
                )}%`,
              }}
            />
            <span className="sr-only">
              {point.label}: {formatPaise(point.value)} from {point.count}{" "}
              {countNoun}
              {point.count === 1 ? "" : "s"}
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-2 flex justify-between text-xs text-ink-400">
        <span>{series[0]?.label}</span>
        <span>{series[series.length - 1]?.label}</span>
      </div>

      <details className="mt-4 border-t border-ivory-300 pt-3">
        <summary className="cursor-pointer text-xs font-medium uppercase tracking-[0.12em] text-ink-400 hover:text-ink-900">
          See the figures
        </summary>
        <table className="mt-3 w-full border-collapse text-xs">
          <thead>
            <tr className="text-left text-ink-400">
              <th className="pb-1 font-medium">Period</th>
              <th className="pb-1 text-right font-medium capitalize">
                {countNoun}s
              </th>
              <th className="pb-1 text-right font-medium">Value</th>
            </tr>
          </thead>
          <tbody>
            {series
              .filter((point) => point.value > 0)
              .map((point, index) => (
                <tr key={`${point.label}-${index}`}>
                  <td className="py-1 text-ink-500">{point.label}</td>
                  <td className="py-1 text-right text-ink-500">
                    {point.count}
                  </td>
                  <td className="py-1 text-right text-ink-900">
                    {formatPaise(point.value)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
