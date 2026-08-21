import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { requireSeller } from "@/lib/seller/context";
import {
  listSellerOrders,
  sellerOrderCounts,
  type SellerOrderFilter,
} from "@/lib/seller/orders";
import {
  SUB_ORDER_STATUS_LABEL,
  subOrderTone,
} from "@/lib/commerce/order-status";
import { SUB_ORDER_STATUS } from "@/lib/constants";
import { formatDate, formatPaise } from "@/lib/utils";
import { StatusBadge } from "@/components/commerce/status-badge";

export const metadata: Metadata = { title: "Orders" };

const FILTERS: { key: SellerOrderFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "awaiting", label: "To confirm" },
  { key: "fulfilment", label: "In fulfilment" },
  { key: "transit", label: "On the way" },
  { key: "closed", label: "Completed" },
];

/**
 * Seller order queue — SRS §61.
 *
 * "To confirm" leads because it is the only view containing work the seller can
 * act on; the rest are visibility into what the Saawariya warehouse is doing
 * with their stock.
 */
export default async function SellerOrdersPage({
  searchParams,
}: PageProps<"/seller/orders">) {
  const seller = await requireSeller("/seller/orders");
  const params = await searchParams;

  const filter = (
    FILTERS.some((f) => f.key === params.status) ? params.status : "all"
  ) as SellerOrderFilter;
  const q = typeof params.q === "string" ? params.q : "";
  const page = Number(params.page) || 1;

  const [{ orders, total, pageCount }, counts] = await Promise.all([
    listSellerOrders(seller.sellerId, { filter, q, page }),
    sellerOrderCounts(seller.sellerId),
  ]);

  const href = (extra: Record<string, string | number>) => {
    const search = new URLSearchParams();
    if (filter !== "all") search.set("status", filter);
    if (q) search.set("q", q);
    for (const [key, value] of Object.entries(extra)) {
      if (value === "" || value === "all") search.delete(key);
      else search.set(key, String(value));
    }
    const qs = search.toString();
    return qs ? `/seller/orders?${qs}` : "/seller/orders";
  };

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <p className="eyebrow mb-2">Order management</p>
        <h1 className="font-display text-3xl">Orders</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-400">
          Confirm a new order to release your stock to the Saawariya warehouse.
          Picking, quality checks, packing and dispatch are handled there.
        </p>
      </header>

      <nav aria-label="Filter orders" className="mb-6">
        <ul className="flex flex-wrap gap-1 border-b border-ivory-400">
          {FILTERS.map((tab) => {
            const isActive = filter === tab.key;
            return (
              <li key={tab.key}>
                <Link
                  href={href({ status: tab.key, page: 1 })}
                  aria-current={isActive ? "page" : undefined}
                  className={`-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm transition-colors ${
                    isActive
                      ? "border-brand-600 text-brand-600"
                      : "border-transparent text-ink-500 hover:text-ink-900"
                  }`}
                >
                  {tab.label}
                  <span className="text-xs text-ink-400">
                    {counts[tab.key]}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <form action="/seller/orders" className="mb-6 flex gap-2">
        {filter !== "all" && (
          <input type="hidden" name="status" value={filter} />
        )}
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search by order number or product"
          aria-label="Search your orders"
          className="rounded-md w-full max-w-sm border border-ivory-400 bg-ivory-50 px-4 py-2.5 text-sm text-ink-900 placeholder:text-ink-400/60 focus:border-brand-600 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-md border border-ink-900/15 px-5 text-xs font-medium uppercase tracking-[0.12em] text-ink-900 transition-colors hover:bg-ivory-200"
        >
          Search
        </button>
      </form>

      {orders.length === 0 ? (
        <div className="rounded-md border border-ivory-400 bg-ivory-50 p-10 text-center">
          <p className="text-sm text-ink-400">
            {q
              ? `No orders match “${q}”.`
              : filter === "awaiting"
                ? "Nothing waiting on you. New orders appear here the moment they are placed."
                : "No orders in this view yet."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {orders.map((sub) => {
            const needsAction = sub.status === SUB_ORDER_STATUS.PLACED;
            const units = sub.items.reduce(
              (sum, item) => sum + item.quantity,
              0,
            );

            return (
              <li key={sub.id}>
                <Link
                  href={`/seller/orders/${sub.subOrderNumber}`}
                  className={`flex flex-wrap items-center gap-4 border bg-ivory-50 p-4 transition-colors ${
                    needsAction
                      ? "border-brand-600/40 hover:border-brand-600"
                      : "border-ivory-400 hover:border-ink-400"
                  }`}
                >
                  <div className="flex -space-x-2">
                    {sub.items
                      .filter((item) => item.imageUrl)
                      .slice(0, 3)
                      .map((item) => (
                        <span
                          key={item.id}
                          className="relative aspect-square w-11 overflow-hidden border-2 border-ivory-50 bg-ivory-200"
                        >
                          <Image
                            src={item.imageUrl as string}
                            alt=""
                            fill
                            sizes="44px"
                            className="object-cover"
                          />
                        </span>
                      ))}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink-900">{sub.subOrderNumber}</p>
                    <p className="mt-0.5 text-xs text-ink-400">
                      {formatDate(sub.createdAt)} ·{" "}
                      {sub.order.customer.user.fullName} ·{" "}
                      {sub.order.shipCity}, {sub.order.shipState}
                    </p>
                    <p className="mt-1 text-xs text-ink-500">
                      {units} unit{units === 1 ? "" : "s"} ·{" "}
                      {formatPaise(sub.subtotal)}
                    </p>
                  </div>

                  <StatusBadge
                    label={SUB_ORDER_STATUS_LABEL[sub.status] ?? sub.status}
                    tone={subOrderTone(sub.status)}
                  />
                </Link>
              </li>
            );
          })}
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
            Page {page} of {pageCount} · {total} order{total === 1 ? "" : "s"}
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
    </div>
  );
}
