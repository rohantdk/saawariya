import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  Boxes,
  Hourglass,
  Inbox,
  PackageSearch,
} from "lucide-react";
import { requireOperations } from "@/lib/operations/context";
import {
  listStockMovements,
  listWarehouseInventory,
  warehouseSummary,
} from "@/lib/operations/warehouse";
import { findQueue, listQueue, WAREHOUSE_QUEUES } from "@/lib/operations/queues";
import { STOCK_REASON_LABEL } from "@/lib/seller/inventory";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusBadge } from "@/components/commerce/status-badge";
import {
  SUB_ORDER_STATUS_LABEL,
  subOrderTone,
} from "@/lib/commerce/order-status";
import { ROLES } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Warehouse" };

/**
 * The warehouse landing page — SRS §93, §98.
 *
 * Deliberately not a second copy of the queue board. A queue length says how
 * much there is; this screen says what is *wrong* — which parcels have been
 * sitting more than a day, which lines are about to run out, and what the
 * ledger has recorded lately. All three are questions the queues cannot answer
 * because they are sorted by arrival, not by trouble.
 */
export default async function WarehouseDashboardPage() {
  await requireOperations(ROLES.WAREHOUSE, "/operations/warehouse");

  const [summary, oldest, alerts, ledger] = await Promise.all([
    warehouseSummary(),
    listQueue(findQueue(WAREHOUSE_QUEUES, "inbound")),
    listWarehouseInventory({ filter: "alerts" }),
    listStockMovements({}),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <p className="eyebrow mb-2">Warehouse</p>
        <h1 className="font-display text-3xl">Warehouse</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-400">
          Saawariya holds and ships every seller&rsquo;s goods. A parcel arrives
          here the moment its seller confirms it, and leaves when logistics hands
          it to a courier.
        </p>
      </header>

      <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile
          href="/operations/warehouse/queue?queue=inbound"
          icon={<Inbox className="h-4 w-4" />}
          value={summary.inbound}
          label="Inbound"
          hint="Confirmed, not yet pulled in"
          tone={summary.inbound > 0 ? "attention" : "default"}
        />
        <StatTile
          href="/operations/warehouse/queue?queue=picking"
          icon={<PackageSearch className="h-4 w-4" />}
          value={summary.onFloor}
          label="On the floor"
          hint="Queued, picking or picked"
        />
        <StatTile
          href="/operations/warehouse/queue?queue=packing"
          icon={<Boxes className="h-4 w-4" />}
          value={summary.packing}
          label="Packing"
          hint="Passed QC, being boxed"
        />
        <StatTile
          icon={<Hourglass className="h-4 w-4" />}
          value={summary.ageing}
          label="Older than a day"
          hint="Still here after 24 hours"
          tone={summary.ageing > 0 ? "attention" : "default"}
        />
        <StatTile
          href="/operations/warehouse/inventory"
          icon={<AlertTriangle className="h-4 w-4" />}
          value={summary.alerts}
          label="Stock alerts"
          hint="Low or out of stock"
          tone={summary.alerts > 0 ? "attention" : "default"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 className="font-display text-xl">Waiting longest</h2>
            <Link
              href="/operations/warehouse/queue"
              className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500 transition-colors hover:text-brand-600"
            >
              All queues
            </Link>
          </div>

          {oldest.rows.length === 0 ? (
            <p className="rounded-md border border-ivory-400 bg-ivory-50 p-6 text-sm text-ink-400">
              Nothing inbound. Every confirmed parcel has been pulled in.
            </p>
          ) : (
            <ul className="space-y-2">
              {oldest.rows.slice(0, 5).map((row) => (
                <li key={row.id}>
                  <Link
                    href={`/operations/warehouse/queue/${row.subOrderNumber}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-ivory-400 bg-ivory-50 p-3 transition-colors hover:border-ink-400"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm text-ink-900">
                        {row.subOrderNumber}
                      </span>
                      <span className="mt-0.5 block text-xs text-ink-400">
                        {row.seller.businessName} ·{" "}
                        {row.items.reduce((sum, i) => sum + i.quantity, 0)}{" "}
                        unit
                        {row.items.reduce((sum, i) => sum + i.quantity, 0) === 1
                          ? ""
                          : "s"}{" "}
                        · confirmed {formatDate(row.confirmedAt ?? row.createdAt)}
                      </span>
                    </span>
                    <StatusBadge
                      label={SUB_ORDER_STATUS_LABEL[row.status] ?? row.status}
                      tone={subOrderTone(row.status)}
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 className="font-display text-xl">Stock alerts</h2>
            <Link
              href="/operations/warehouse/inventory"
              className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500 transition-colors hover:text-brand-600"
            >
              All stock
            </Link>
          </div>

          {alerts.items.length === 0 ? (
            <p className="rounded-md border border-ivory-400 bg-ivory-50 p-6 text-sm text-ink-400">
              Nothing low or out of stock.
            </p>
          ) : (
            <ul className="space-y-2">
              {alerts.items.slice(0, 5).map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-ivory-400 bg-ivory-50 p-3"
                >
                  <span className="min-w-0">
                    <span className="block text-sm text-ink-900">
                      {item.product.name}
                    </span>
                    <span className="mt-0.5 block text-xs text-ink-400">
                      {item.product.sku} · {item.product.seller.businessName}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-display text-lg text-ink-900">
                      {item.stockQty}
                    </span>
                    <span className="block text-[0.6875rem] text-ink-400">
                      {item.reservedQty} reserved
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-10">
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <h2 className="font-display text-xl">Recent stock movements</h2>
          <Link
            href="/operations/warehouse/movements"
            className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500 transition-colors hover:text-brand-600"
          >
            Full ledger
          </Link>
        </div>

        {ledger.movements.length === 0 ? (
          <p className="rounded-md border border-ivory-400 bg-ivory-50 p-6 text-sm text-ink-400">
            The ledger is empty.
          </p>
        ) : (
          <ul className="divide-y divide-ivory-300 rounded-md border border-ivory-400 bg-ivory-50">
            {ledger.movements.slice(0, 6).map((movement) => (
              <li
                key={movement.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 p-3 text-xs"
              >
                <span className="min-w-0 flex-1 text-ink-900">
                  {movement.inventory.product.name}
                </span>
                <span className="text-ink-400">
                  {STOCK_REASON_LABEL[movement.reason] ?? movement.reason}
                </span>
                <span
                  className={
                    movement.changeQty > 0
                      ? "text-success"
                      : movement.changeQty < 0
                        ? "text-danger"
                        : "text-ink-400"
                  }
                >
                  {movement.changeQty > 0 ? "+" : ""}
                  {movement.changeQty}
                </span>
                <span className="text-ink-400">
                  {formatDateTime(movement.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
