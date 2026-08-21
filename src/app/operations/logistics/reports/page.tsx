import type { Metadata } from "next";
import Link from "next/link";
import { requireOperations } from "@/lib/operations/context";
import { deliveryReport, failedDeliveries } from "@/lib/operations/logistics";
import { StatTile } from "@/components/ui/stat-tile";
import { ROLES } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Delivery performance" };

const RANGES = [30, 90, 365];

/**
 * Delivery performance — SRS §110.
 *
 * Grouped by courier because that is the only lever this desk has: the report
 * exists so someone can stop giving parcels to the carrier that loses them.
 *
 * Transit time is measured on the **shipment** — dispatch to delivery — not on
 * the sub-order. A parcel that sat in the warehouse for three days and was then
 * delivered overnight should not count three days against the courier that
 * delivered it overnight.
 */
export default async function LogisticsReportsPage({
  searchParams,
}: PageProps<"/operations/logistics/reports">) {
  await requireOperations(ROLES.LOGISTICS, "/operations/logistics/reports");
  const params = await searchParams;

  const requested = Number(params.days);
  const days = RANGES.includes(requested) ? requested : 90;

  const [report, failures] = await Promise.all([
    deliveryReport(days),
    failedDeliveries(),
  ]);

  const busiest = report.couriers.reduce(
    (max, courier) => Math.max(max, courier.shipments),
    0,
  );

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <p className="eyebrow mb-2">Delivery performance</p>
        <h1 className="font-display text-3xl">Performance</h1>
      </header>

      <nav aria-label="Report range" className="mb-6">
        <ul className="flex flex-wrap gap-1 border-b border-ivory-400">
          {RANGES.map((range) => {
            const isActive = days === range;
            return (
              <li key={range}>
                <Link
                  href={
                    range === 90
                      ? "/operations/logistics/reports"
                      : `/operations/logistics/reports?days=${range}`
                  }
                  aria-current={isActive ? "page" : undefined}
                  className={`-mb-px inline-block border-b-2 px-3.5 py-2.5 text-sm transition-colors ${
                    isActive
                      ? "border-brand-600 text-brand-600"
                      : "border-transparent text-ink-500 hover:text-ink-900"
                  }`}
                >
                  {range === 365 ? "Last year" : `Last ${range} days`}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile value={report.shipments} label="Shipments" />
        <StatTile value={report.delivered} label="Delivered" />
        <StatTile
          value={report.failed}
          label="Failed attempts"
          tone={report.failed > 0 ? "attention" : "default"}
        />
        <StatTile
          value={
            report.avgTransitDays === null
              ? "—"
              : `${report.avgTransitDays.toFixed(1)}d`
          }
          label="Average transit"
          hint="Dispatch to delivery"
        />
      </div>

      {report.couriers.length === 0 ? (
        <p className="rounded-md border border-ivory-400 bg-ivory-50 p-10 text-center text-sm text-ink-400">
          No shipments in the last {days} days.
        </p>
      ) : (
        <section className="mb-10">
          <h2 className="mb-4 font-display text-xl">By courier</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-ivory-400 text-left">
                  <th className="pb-2 text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-ink-400">
                    Courier
                  </th>
                  <th className="pb-2 text-right text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-ink-400">
                    Parcels
                  </th>
                  <th className="pb-2 text-right text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-ink-400">
                    Delivered
                  </th>
                  <th className="pb-2 text-right text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-ink-400">
                    Failed
                  </th>
                  <th className="pb-2 text-right text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-ink-400">
                    Avg transit
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.couriers.map((courier) => (
                  <tr key={courier.courier} className="border-b border-ivory-300">
                    <td className="py-3">
                      <p className="text-ink-900">{courier.courier}</p>
                      <div
                        className="mt-1.5 h-1.5 w-40 bg-ivory-300"
                        role="presentation"
                      >
                        <div
                          className="h-full bg-brand-600"
                          style={{
                            width: `${busiest === 0 ? 0 : (courier.shipments / busiest) * 100}%`,
                          }}
                        />
                      </div>
                    </td>
                    <td className="py-3 text-right text-ink-900">
                      {courier.shipments}
                    </td>
                    <td className="py-3 text-right text-ink-500">
                      {courier.delivered}
                      {courier.deliveryRate !== null && (
                        <span className="ml-1 text-xs text-ink-400">
                          ({courier.deliveryRate}%)
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-right text-ink-500">
                      {courier.failed}
                    </td>
                    <td className="py-3 text-right text-ink-500">
                      {courier.avgTransitDays === null
                        ? "—"
                        : `${courier.avgTransitDays.toFixed(1)}d`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-ink-400">
            An em dash under average transit means no parcel with that courier
            has completed its journey yet — not that it arrived instantly.
          </p>
        </section>
      )}

      <section>
        <h2 className="mb-4 font-display text-xl">Outstanding failed attempts</h2>
        {failures.length === 0 ? (
          <p className="rounded-md border border-ivory-400 bg-ivory-50 p-6 text-sm text-ink-400">
            Nothing outstanding.
          </p>
        ) : (
          <ul className="divide-y divide-ivory-300 rounded-md border border-ivory-400 bg-ivory-50">
            {failures.map((shipment) => (
              <li
                key={shipment.id}
                className="flex flex-wrap items-start justify-between gap-3 p-4"
              >
                <div className="min-w-0">
                  <Link
                    href={`/operations/logistics/queue/${shipment.subOrder.subOrderNumber}`}
                    className="text-sm text-ink-900 underline-offset-4 hover:underline"
                  >
                    {shipment.subOrder.subOrderNumber}
                  </Link>
                  <p className="mt-0.5 text-xs text-ink-400">
                    {shipment.subOrder.order.shipShippingName} ·{" "}
                    {shipment.subOrder.order.shipCity},{" "}
                    {shipment.subOrder.order.shipState}
                  </p>
                  <p className="mt-1 text-xs text-danger">
                    {shipment.failureReason}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-ink-500">
                    {shipment.courierName}
                  </p>
                  <p className="font-mono text-[0.6875rem] text-ink-400">
                    {shipment.trackingNumber}
                  </p>
                  <p className="mt-0.5 text-[0.6875rem] text-ink-400">
                    {formatDateTime(shipment.updatedAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
