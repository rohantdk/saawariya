/**
 * Time bucketing for the reporting screens.
 *
 * Pure — no database, no session. Phase 5 built this inside
 * `src/lib/seller/reports.ts` as a private function, which was right while one
 * report existed. Phase 8 adds the finance revenue report, which buckets a
 * different measure over the same axis, and a second copy of "emit every bucket
 * even when empty" is how two reports on the same data end up disagreeing about
 * what a quiet week looks like.
 *
 * It lives in its own module rather than in the seller one because the seller
 * module is `server-only`; the chart component that renders these points needs
 * the type, and a `server-only` module may export a type to a client but never a
 * value (the trap that broke the build in Phases 6 and 7).
 */

export const REPORT_RANGES = [
  { key: "30", label: "Last 30 days", days: 30 },
  { key: "90", label: "Last 90 days", days: 90 },
  { key: "365", label: "Last 12 months", days: 365 },
] as const;

export type ReportRangeKey = (typeof REPORT_RANGES)[number]["key"];

export function resolveRange(key?: string) {
  return REPORT_RANGES.find((range) => range.key === key) ?? REPORT_RANGES[1];
}

/** The start of the window, normalised to midnight so buckets align to days. */
export function rangeStart(days: number): Date {
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);
  return since;
}

export type SeriesPoint = { label: string; value: number; count: number };

/**
 * Bucket dated values for a bar chart.
 *
 * Buckets are days for a short range and months for a long one — 365 daily bars
 * on a panel this width is noise, and 3 monthly bars for a 30-day range says
 * nothing. Every bucket in the range is emitted even when empty, so a quiet week
 * shows as a gap rather than silently collapsing the axis and making the trend
 * look continuous.
 *
 * Rows with a null date are skipped rather than dropped into the first bucket: a
 * delivered sub-order with no `deliveredAt` is a data problem, and quietly
 * attributing its value to an arbitrary day would hide it.
 */
export function buildSeries(
  points: { at: Date | null; value: number }[],
  since: Date,
  days: number,
): SeriesPoint[] {
  const byMonth = days > 92;
  const buckets = new Map<string, { value: number; count: number }>();

  const keyOf = (date: Date) =>
    byMonth
      ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
      : date.toISOString().slice(0, 10);

  const cursor = new Date(since);
  const end = new Date();
  while (cursor <= end) {
    buckets.set(keyOf(cursor), { value: 0, count: 0 });
    if (byMonth) cursor.setMonth(cursor.getMonth() + 1);
    else cursor.setDate(cursor.getDate() + 1);
  }
  // The loop can stop just short of today's bucket when the step overshoots.
  buckets.set(keyOf(end), buckets.get(keyOf(end)) ?? { value: 0, count: 0 });

  for (const point of points) {
    if (!point.at) continue;
    const key = keyOf(point.at);
    const bucket = buckets.get(key) ?? { value: 0, count: 0 };
    bucket.value += point.value;
    bucket.count += 1;
    buckets.set(key, bucket);
  }

  const formatter = new Intl.DateTimeFormat(
    "en-IN",
    byMonth
      ? { month: "short", year: "2-digit" }
      : { day: "numeric", month: "short" },
  );

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, bucket]) => ({
      label: formatter.format(
        byMonth ? new Date(`${key}-01T00:00:00`) : new Date(`${key}T00:00:00`),
      ),
      value: bucket.value,
      count: bucket.count,
    }));
}
