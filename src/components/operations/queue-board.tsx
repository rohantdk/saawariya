import Link from "next/link";
import { StatusBadge } from "@/components/commerce/status-badge";
import {
  SUB_ORDER_STATUS_LABEL,
  subOrderTone,
} from "@/lib/commerce/order-status";
import type { OperationsQueue, QueueRow } from "@/lib/operations/queues";
import { formatDate } from "@/lib/utils";

/**
 * A desk's work, as tabs over one list.
 *
 * All three operations panels present the same thing — a set of status buckets,
 * a search, a list of parcels and a pager — so it is built once here. The desks
 * differ in which buckets exist and which buttons a row carries, and both of
 * those are passed in: `queues` from `src/lib/operations/queues.ts`, and the
 * buttons as a per-row render, because the legal moves depend on the row's
 * status and the viewer's permissions and neither is knowable here.
 *
 * A Server Component throughout, including the tabs and the search box. Every
 * control is a link or a plain form to the same page with a different query
 * string — the Phase 3 rule, for the same reasons: it works without JavaScript,
 * it is bookmarkable, and there is no client filter state to drift from the URL.
 */
export function QueueBoard({
  basePath,
  queues,
  counts,
  active,
  rows,
  total,
  page,
  pageCount,
  q,
  renderActions,
}: {
  basePath: string;
  queues: OperationsQueue[];
  counts: Record<string, number>;
  active: OperationsQueue;
  rows: QueueRow[];
  total: number;
  page: number;
  pageCount: number;
  q: string;
  renderActions?: (row: QueueRow) => React.ReactNode;
}) {
  const href = (extra: Record<string, string | number>) => {
    const search = new URLSearchParams();
    if (active.key !== queues[0].key) search.set("queue", active.key);
    if (q) search.set("q", q);
    for (const [key, value] of Object.entries(extra)) {
      if (value === "") search.delete(key);
      else search.set(key, String(value));
    }
    const qs = search.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <>
      <nav aria-label="Queues" className="mb-4">
        <ul className="flex flex-wrap gap-1 border-b border-ivory-400">
          {queues.map((queue) => {
            const isActive = queue.key === active.key;
            return (
              <li key={queue.key}>
                <Link
                  href={href({ queue: queue.key, page: "" })}
                  aria-current={isActive ? "page" : undefined}
                  className={`-mb-px inline-flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm transition-colors ${
                    isActive
                      ? "border-brand-600 text-brand-600"
                      : "border-transparent text-ink-500 hover:text-ink-900"
                  }`}
                >
                  {queue.label}
                  <span className="text-xs text-ink-400">
                    {counts[queue.key] ?? 0}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <p className="mb-5 max-w-2xl text-sm leading-relaxed text-ink-400">
        {active.hint}
      </p>

      <form action={basePath} className="mb-6 flex gap-2">
        {active.key !== queues[0].key && (
          <input type="hidden" name="queue" value={active.key} />
        )}
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Sub-order, order number, SKU or tracking number"
          aria-label="Search this queue"
          className="w-full max-w-md border border-ivory-400 bg-ivory-50 px-4 py-2.5 text-sm text-ink-900 placeholder:text-ink-400/60 focus:border-brand-600 focus:outline-none"
        />
        <button
          type="submit"
          className="border border-ink-900/15 px-5 text-xs font-medium uppercase tracking-[0.12em] text-ink-900 transition-colors hover:bg-ivory-200"
        >
          Search
        </button>
      </form>

      {rows.length === 0 ? (
        <div className="border border-ivory-400 bg-ivory-50 p-10 text-center">
          <p className="text-sm text-ink-400">
            {q
              ? `Nothing in ${active.label.toLowerCase()} matches “${q}”.`
              : `Nothing in ${active.label.toLowerCase()} right now.`}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li
              key={row.id}
              className="border border-ivory-400 bg-ivory-50 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`${basePath}/${row.subOrderNumber}`}
                    className="text-sm text-ink-900 underline-offset-4 hover:underline"
                  >
                    {row.subOrderNumber}
                  </Link>
                  <p className="mt-0.5 text-xs text-ink-400">
                    {row.seller.businessName} · {row.order.customer.user.fullName}{" "}
                    · {row.order.shipCity}, {row.order.shipState}{" "}
                    {row.order.shipPinCode}
                  </p>
                  <p className="mt-1 text-xs text-ink-500">
                    Placed {formatDate(row.order.placedAt)}
                    {row.shipment &&
                      ` · ${row.shipment.courierName} ${row.shipment.trackingNumber}`}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {row._count.qcInspections > 0 && (
                    <span className="text-[0.6875rem] uppercase tracking-[0.1em] text-ink-400">
                      {row._count.qcInspections} inspection
                      {row._count.qcInspections === 1 ? "" : "s"}
                    </span>
                  )}
                  <StatusBadge
                    label={SUB_ORDER_STATUS_LABEL[row.status] ?? row.status}
                    tone={subOrderTone(row.status)}
                  />
                </div>
              </div>

              <ul className="mt-3 space-y-1 border-t border-ivory-300 pt-3">
                {row.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-baseline gap-x-2 text-xs text-ink-500"
                  >
                    <span className="font-medium text-ink-900">
                      {item.quantity} ×
                    </span>
                    <span className="min-w-0">{item.productName}</span>
                    <span className="text-ink-400">{item.productSku}</span>
                  </li>
                ))}
              </ul>

              {renderActions && (
                <div className="mt-4">{renderActions(row)}</div>
              )}
            </li>
          ))}
        </ul>
      )}

      {pageCount > 1 && (
        <nav
          aria-label="Pagination"
          className="mt-8 flex items-center justify-between gap-4"
        >
          {page > 1 ? (
            <Link
              href={href({ page: page - 1 })}
              className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500 transition-colors hover:text-brand-600"
            >
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <p className="text-xs text-ink-400">
            Page {page} of {pageCount} · {total} parcel{total === 1 ? "" : "s"}
          </p>
          {page < pageCount ? (
            <Link
              href={href({ page: page + 1 })}
              className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500 transition-colors hover:text-brand-600"
            >
              Next →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}
