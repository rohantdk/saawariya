import type { Metadata } from "next";
import Link from "next/link";
import { requireDesk } from "@/lib/admin/context";
import { getFinanceReport } from "@/lib/finance/reports";
import { REPORT_RANGES, resolveRange } from "@/lib/reporting/series";
import {
  PAYMENT_METHOD_LABEL,
  REFUND_REASON_LABEL,
  ROLES,
  type PaymentMethod,
} from "@/lib/constants";
import { formatDate, formatPaise } from "@/lib/utils";
import { StatTile } from "@/components/ui/stat-tile";
import { BarChart } from "@/components/ui/bar-chart";

export const metadata: Metadata = { title: "Financial reports" };

/**
 * Revenue, commission and payout reporting — SRS §122.
 *
 * Holds itself to the same two rules the seller report states, because a seller
 * comparing their figures against one quoted by finance must not find two
 * different answers: revenue counts **delivered** sub-orders only, and it is the
 * **subtotal** — gross line value before any platform-funded coupon, which is
 * the commission base.
 *
 * "Net to the platform" is commission minus refunds, deliberately not
 * "revenue minus payouts". A refund is money the platform gives back to a
 * customer; a payout is money it passes on to a seller. Netting those two
 * against each other would hide both.
 */
export default async function FinanceReportsPage({
  searchParams,
}: PageProps<"/admin/finance/reports">) {
  await requireDesk(ROLES.FINANCE, "/admin/finance/reports");
  const params = await searchParams;

  const range = resolveRange(
    typeof params.range === "string" ? params.range : undefined,
  );
  const report = await getFinanceReport(range.days);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <p className="eyebrow mb-2">SRS §122 — Financial reports</p>
        <h1 className="font-display text-3xl">Reports</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-400">
          Revenue counts parcels that reached the customer, before commission —
          the same basis the seller reports use, so the two cannot disagree.
          Since {formatDate(report.since)}.
        </p>
      </header>

      <nav aria-label="Report period" className="mb-6">
        <ul className="flex flex-wrap gap-1 border-b border-ivory-400">
          {REPORT_RANGES.map((option) => {
            const isActive = option.key === range.key;
            return (
              <li key={option.key}>
                <Link
                  href={`/admin/finance/reports?range=${option.key}`}
                  aria-current={isActive ? "page" : undefined}
                  className={`-mb-px inline-block border-b-2 px-4 py-2.5 text-sm transition-colors ${
                    isActive
                      ? "border-brand-600 text-brand-600"
                      : "border-transparent text-ink-500 hover:text-ink-900"
                  }`}
                >
                  {option.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          value={formatPaise(report.revenue)}
          label="Delivered revenue"
          hint={`${report.orderCount} parcel${
            report.orderCount === 1 ? "" : "s"
          } · ${formatPaise(report.averageOrderValue)} average`}
        />
        <StatTile
          value={formatPaise(report.commission)}
          label="Commission charged"
          hint="On settlements raised in this period"
        />
        <StatTile
          value={formatPaise(report.refunded)}
          label="Refunded"
          hint="Approved or already paid back"
        />
        <StatTile
          value={formatPaise(report.netToPlatform)}
          label="Net to the platform"
          hint="Commission less refunds"
          tone={report.netToPlatform < 0 ? "attention" : "default"}
        />
      </div>

      <section className="mb-10">
        <h2 className="mb-4 font-display text-xl">Revenue over time</h2>
        <BarChart
          series={report.series}
          countNoun="parcel"
          emptyMessage="No parcels were delivered in this period."
        />
      </section>

      <section className="mb-10">
        <h2 className="mb-1 font-display text-xl">Payouts released</h2>
        <p className="mb-4 text-sm text-ink-400">
          {formatPaise(report.released)} released, {formatPaise(report.owed)}{" "}
          still owed to sellers from this period.
        </p>
        <BarChart
          series={report.payoutSeries}
          countNoun="payout"
          emptyMessage="No payouts were released in this period."
        />
      </section>

      {/*
        `min-w-0` on both cells. A grid item defaults to `min-width: auto` and
        refuses to shrink below its content's min-content width, so the
        `min-w-[28rem]` on the scrollable table below forced the whole track to
        450px inside a 335px container and put the page into horizontal scroll.
        The table is meant to scroll inside its own box, not to widen the page.
        Same finding as the admin dashboard in Phase 6.
      */}
      <div className="grid gap-8 lg:grid-cols-2">
        <section className="min-w-0">
          <h2 className="mb-4 font-display text-xl">Commission by seller</h2>

          {report.bySeller.length === 0 ? (
            <p className="border border-ivory-400 bg-ivory-50 px-5 py-4 text-sm text-ink-400">
              No settlements were raised in this period.
            </p>
          ) : (
            <div className="overflow-x-auto border border-ivory-400 bg-ivory-50">
              <table className="w-full min-w-[28rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-ivory-400 text-left text-xs uppercase tracking-[0.1em] text-ink-400">
                    <th className="px-4 py-3 font-medium">Seller</th>
                    <th className="px-4 py-3 text-right font-medium">Gross</th>
                    <th className="px-4 py-3 text-right font-medium">
                      Commission
                    </th>
                    <th className="px-4 py-3 text-right font-medium">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {report.bySeller.map((row) => (
                    <tr
                      key={row.sellerId}
                      className="border-b border-ivory-300 last:border-b-0"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/finance/settlements?sellerId=${row.sellerId}&status=all`}
                          className="text-ink-900 underline-offset-4 hover:text-brand-600 hover:underline"
                        >
                          {row.businessName}
                        </Link>
                        <span className="block text-xs text-ink-400">
                          {row.count} payout{row.count === 1 ? "" : "s"} at{" "}
                          {row.commissionPercent}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-ink-500">
                        {formatPaise(row.gross)}
                      </td>
                      <td className="px-4 py-3 text-right text-ink-900">
                        {formatPaise(row.commission)}
                      </td>
                      <td className="px-4 py-3 text-right text-ink-500">
                        {formatPaise(row.net)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="min-w-0 space-y-8">
          <div>
            <h2 className="mb-4 font-display text-xl">How customers paid</h2>

            {report.byMethod.length === 0 ? (
              <p className="border border-ivory-400 bg-ivory-50 px-5 py-4 text-sm text-ink-400">
                No successful payments in this period.
              </p>
            ) : (
              <ul className="border border-ivory-400 bg-ivory-50">
                {report.byMethod.map((row) => (
                  <li
                    key={row.method}
                    className="flex items-center justify-between gap-4 border-b border-ivory-300 px-4 py-3 last:border-b-0"
                  >
                    <span className="min-w-0 text-sm text-ink-900">
                      {PAYMENT_METHOD_LABEL[row.method as PaymentMethod] ??
                        row.method}
                      <span className="block text-xs text-ink-400">
                        {row.count} payment{row.count === 1 ? "" : "s"}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm text-ink-900">
                      {formatPaise(row.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h2 className="mb-4 font-display text-xl">Why money went back</h2>

            {report.refundsByReason.length === 0 ? (
              <p className="border border-ivory-400 bg-ivory-50 px-5 py-4 text-sm text-ink-400">
                Nothing was refunded in this period.
              </p>
            ) : (
              <ul className="border border-ivory-400 bg-ivory-50">
                {report.refundsByReason.map((row) => (
                  <li
                    key={row.reason}
                    className="flex items-center justify-between gap-4 border-b border-ivory-300 px-4 py-3 last:border-b-0"
                  >
                    <span className="min-w-0 text-sm text-ink-900">
                      {REFUND_REASON_LABEL[row.reason] ?? row.reason}
                      <span className="block text-xs text-ink-400">
                        {row.count} refund{row.count === 1 ? "" : "s"}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm text-ink-900">
                      {formatPaise(row.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
