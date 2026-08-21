import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, PackageCheck, Truck, XCircle } from "lucide-react";
import { requireOperations } from "@/lib/operations/context";
import {
  deliveryReport,
  failedDeliveries,
  logisticsSummary,
} from "@/lib/operations/logistics";
import {
  findQueue,
  listQueue,
  LOGISTICS_QUEUES,
} from "@/lib/operations/queues";
import { StatTile } from "@/components/ui/stat-tile";
import { DispatchForm } from "@/components/operations/dispatch-form";
import { ROLES } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Logistics" };

/**
 * The logistics landing page — SRS §107, §110.
 *
 * Dispatch is done from here, not only from the queue: choosing a courier is
 * the entire action, so making someone open a detail page to perform it would
 * add a click to the most repeated task on the desk.
 *
 * Failed attempts get their own list because nothing else surfaces them. The
 * sub-order still reads "out for delivery" — correctly, since the courier will
 * re-attempt — so a queue sorted by order status cannot show which parcels are
 * in trouble.
 */
export default async function LogisticsDashboardPage() {
  await requireOperations(ROLES.LOGISTICS, "/operations/logistics");

  const [summary, ready, failures, report] = await Promise.all([
    logisticsSummary(),
    listQueue(findQueue(LOGISTICS_QUEUES, "dispatch")),
    failedDeliveries(),
    deliveryReport(90),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <p className="eyebrow mb-2">Logistics</p>
        <h1 className="font-display text-3xl">Logistics</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-400">
          Assign a courier to each packed parcel, then move it along as the
          network reports it. Dispatching is also what takes the goods off the
          warehouse shelf.
        </p>
      </header>

      <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          href="/operations/logistics/queue?queue=dispatch"
          icon={<PackageCheck className="h-4 w-4" />}
          value={summary.ready}
          label="Ready to dispatch"
          tone={summary.ready > 0 ? "attention" : "default"}
        />
        <StatTile
          href="/operations/logistics/queue?queue=transit"
          icon={<Truck className="h-4 w-4" />}
          value={summary.inTransit + summary.outForDelivery}
          label="With a courier"
          hint={`${summary.outForDelivery} out for delivery`}
        />
        <StatTile
          icon={<CheckCircle2 className="h-4 w-4" />}
          value={summary.deliveredToday}
          label="Delivered today"
        />
        <StatTile
          icon={<XCircle className="h-4 w-4" />}
          value={summary.failed}
          label="Failed attempts"
          hint="Awaiting a re-attempt"
          tone={summary.failed > 0 ? "attention" : "default"}
        />
      </div>

      <section className="mb-10">
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <h2 className="font-display text-xl">Ready to dispatch</h2>
          <Link
            href="/operations/logistics/queue"
            className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500 transition-colors hover:text-brand-600"
          >
            All shipments
          </Link>
        </div>

        {ready.rows.length === 0 ? (
          <p className="rounded-md border border-ivory-400 bg-ivory-50 p-6 text-sm text-ink-400">
            Nothing packed and waiting. The warehouse will send parcels here as
            they finish.
          </p>
        ) : (
          <ul className="space-y-3">
            {ready.rows.slice(0, 5).map((row) => (
              <li
                key={row.id}
                className="rounded-md border border-ivory-400 bg-ivory-50 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <Link
                      href={`/operations/logistics/queue/${row.subOrderNumber}`}
                      className="text-sm text-ink-900 underline-offset-4 hover:underline"
                    >
                      {row.subOrderNumber}
                    </Link>
                    <p className="mt-0.5 text-xs text-ink-400">
                      {row.order.customer.user.fullName} ·{" "}
                      {row.order.shipCity}, {row.order.shipState}{" "}
                      {row.order.shipPinCode}
                    </p>
                    <p className="mt-1 text-xs text-ink-500">
                      Packed{" "}
                      {row.packedAt ? formatDateTime(row.packedAt) : "—"}
                    </p>
                  </div>

                  <DispatchForm subOrderId={row.id} compact />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 font-display text-xl">Failed attempts</h2>
          {failures.length === 0 ? (
            <p className="rounded-md border border-ivory-400 bg-ivory-50 p-6 text-sm text-ink-400">
              No failed attempts outstanding.
            </p>
          ) : (
            <ul className="divide-y divide-ivory-300 rounded-md border border-ivory-400 bg-ivory-50">
              {failures.slice(0, 6).map((shipment) => (
                <li key={shipment.id} className="p-3">
                  <Link
                    href={`/operations/logistics/queue/${shipment.subOrder.subOrderNumber}`}
                    className="text-sm text-ink-900 underline-offset-4 hover:underline"
                  >
                    {shipment.subOrder.subOrderNumber}
                  </Link>
                  <p className="mt-0.5 text-xs text-danger">
                    {shipment.failureReason}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-400">
                    {shipment.courierName} · {shipment.trackingNumber} ·{" "}
                    {shipment.subOrder.order.shipCity}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 className="font-display text-xl">Couriers</h2>
            <Link
              href="/operations/logistics/reports"
              className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500 transition-colors hover:text-brand-600"
            >
              Full report
            </Link>
          </div>

          {report.couriers.length === 0 ? (
            <p className="rounded-md border border-ivory-400 bg-ivory-50 p-6 text-sm text-ink-400">
              No shipments in the last {report.days} days.
            </p>
          ) : (
            <ul className="divide-y divide-ivory-300 rounded-md border border-ivory-400 bg-ivory-50">
              {report.couriers.map((courier) => (
                <li
                  key={courier.courier}
                  className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm"
                >
                  <span className="min-w-0 text-ink-900">
                    {courier.courier}
                  </span>
                  <span className="shrink-0 text-xs text-ink-400">
                    {courier.shipments} parcel
                    {courier.shipments === 1 ? "" : "s"} ·{" "}
                    {courier.avgTransitDays === null
                      ? "no completed journeys"
                      : `${courier.avgTransitDays.toFixed(1)} days average`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
