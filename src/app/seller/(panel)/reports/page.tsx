import type { Metadata } from "next";
import Link from "next/link";
import { requireSeller } from "@/lib/seller/context";
import {
  getSellerReport,
  REPORT_RANGES,
  resolveRange,
} from "@/lib/seller/reports";
import { formatPaise } from "@/lib/utils";
import { StatTile } from "@/components/ui/stat-tile";
import { BarChart } from "@/components/ui/bar-chart";

export const metadata: Metadata = { title: "Reports" };

/**
 * Sales and revenue — SRS §63.
 *
 * The chart is `BarChart` — plain HTML bars, no charting library, with every
 * figure also reachable as text. It moved to `components/ui/` in Phase 8 when
 * the finance revenue report needed the same thing.
 */
export default async function SellerReportsPage({
  searchParams,
}: PageProps<"/seller/reports">) {
  const seller = await requireSeller("/seller/reports");
  const params = await searchParams;

  const range = resolveRange(
    typeof params.range === "string" ? params.range : undefined,
  );
  const report = await getSellerReport(seller.sellerId, range.days);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <p className="eyebrow mb-2">SRS §63 — Sales reports</p>
        <h1 className="font-display text-3xl">Reports</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-400">
          Revenue counts parcels that reached the customer, before commission.
          Orders still in fulfilment are shown separately — they can still be
          cancelled.
        </p>
      </header>

      {/* ---- Range ---- */}
      <nav aria-label="Report range" className="mb-8">
        <ul className="flex flex-wrap gap-1 border-b border-ivory-400">
          {REPORT_RANGES.map((option) => {
            const isActive = range.key === option.key;
            return (
              <li key={option.key}>
                <Link
                  href={`/seller/reports?range=${option.key}`}
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

      <div className="mb-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          value={formatPaise(report.revenue)}
          label="Revenue"
          hint={`${report.orderCount} delivered order${report.orderCount === 1 ? "" : "s"}`}
        />
        <StatTile value={String(report.units)} label="Units sold" />
        <StatTile
          value={formatPaise(report.averageOrderValue)}
          label="Average order"
        />
        <StatTile
          href="/seller/orders?status=fulfilment"
          value={formatPaise(report.inFlight.value)}
          label="In fulfilment"
          hint={`${report.inFlight.count} order${report.inFlight.count === 1 ? "" : "s"} not yet delivered`}
        />
      </div>

      {/* ---- Revenue over time ---- */}
      <section className="mb-10">
        <h2 className="mb-4 font-display text-xl">Revenue over time</h2>

        <BarChart
          series={report.series}
          countNoun="order"
          emptyMessage="No parcels were delivered in this period."
        />
      </section>

      {/* ---- Top products ---- */}
      <section>
        <h2 className="mb-4 font-display text-xl">Best sellers</h2>

        {report.topProducts.length === 0 ? (
          <p className="border border-ivory-400 bg-ivory-50 px-5 py-4 text-sm text-ink-400">
            Nothing delivered in this period yet.
          </p>
        ) : (
          <ul className="border border-ivory-400 bg-ivory-50">
            {report.topProducts.map((row) => (
              <li
                key={row.productId}
                className="flex flex-wrap items-center justify-between gap-4 border-b border-ivory-300 px-5 py-3 last:border-b-0"
              >
                <Link
                  href={`/seller/products/${row.productId}`}
                  className="min-w-0 flex-1 truncate text-sm text-ink-900 transition-colors hover:text-brand-600"
                >
                  {row.productName}
                </Link>
                <p className="shrink-0 text-xs text-ink-400">
                  {row._sum.quantity ?? 0} unit
                  {(row._sum.quantity ?? 0) === 1 ? "" : "s"}
                </p>
                <p className="shrink-0 text-sm text-ink-900">
                  {formatPaise(row._sum.lineTotal ?? 0)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {report.cancelled > 0 && (
        <p className="mt-8 text-xs text-ink-400">
          {report.cancelled} order{report.cancelled === 1 ? "" : "s"} cancelled
          in this period, not counted above.
        </p>
      )}
    </div>
  );
}
