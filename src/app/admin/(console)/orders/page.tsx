import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/context";
import { listOrders, orderCounts } from "@/lib/admin/orders";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  SUB_ORDER_STATUS_LABEL,
  subOrderTone,
} from "@/lib/commerce/order-status";
import {
  CUSTOMER_TYPE,
  ORDER_STATUS,
  PAYMENT_METHOD_LABEL,
  type OrderStatus,
  type PaymentMethod,
} from "@/lib/constants";
import { formatDate, formatPaise } from "@/lib/utils";
import { StatusBadge } from "@/components/commerce/status-badge";

export const metadata: Metadata = { title: "Orders" };

const TABS = [
  { key: "all", label: "All" },
  { key: ORDER_STATUS.PENDING, label: "Awaiting seller" },
  { key: ORDER_STATUS.PROCESSING, label: "In fulfilment" },
  { key: ORDER_STATUS.PARTIALLY_SHIPPED, label: "Part dispatched" },
  { key: ORDER_STATUS.SHIPPED, label: "Dispatched" },
  { key: ORDER_STATUS.DELIVERED, label: "Delivered" },
  { key: ORDER_STATUS.CANCELLED, label: "Cancelled" },
  { key: ORDER_STATUS.RETURNED, label: "Returned" },
];

/**
 * Every order on the platform — SRS §78.
 *
 * Each row shows its sub-orders as separate pills rather than one status,
 * because the order status is a *summary* of them. An order reading "Part
 * dispatched" is only useful if you can see which seller's parcel has gone.
 */
export default async function AdminOrdersPage({
  searchParams,
}: PageProps<"/admin/orders">) {
  await requireAdmin("/admin/orders");
  const params = await searchParams;

  const status = typeof params.status === "string" ? params.status : "all";
  const q = typeof params.q === "string" ? params.q : "";
  const page = Number(params.page) || 1;

  const [{ orders, total, pageCount, page: current }, counts] =
    await Promise.all([listOrders({ status, q, page }), orderCounts()]);

  const keep = (extra: Record<string, string | number>) => {
    const search = new URLSearchParams();
    if (status !== "all") search.set("status", status);
    if (q) search.set("q", q);
    for (const [key, value] of Object.entries(extra)) {
      if (value === "" || value === "all") search.delete(key);
      else search.set(key, String(value));
    }
    const qs = search.toString();
    return qs ? `/admin/orders?${qs}` : "/admin/orders";
  };

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <p className="eyebrow mb-2">Order management</p>
        <h1 className="font-display text-3xl">Orders</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-400">
          One order, one payment, and a sub-order per seller. The pipeline runs
          on the sub-orders; the order status is derived from them.
        </p>
      </header>

      <nav aria-label="Filter by status" className="mb-5">
        <ul className="flex flex-wrap gap-1 border-b border-ivory-400">
          {TABS.map((tab) => {
            const isActive = status === tab.key;
            return (
              <li key={tab.key}>
                <Link
                  href={keep({ status: tab.key, page: 1 })}
                  aria-current={isActive ? "page" : undefined}
                  className={`-mb-px inline-flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm transition-colors ${
                    isActive
                      ? "border-brand-600 text-brand-600"
                      : "border-transparent text-ink-500 hover:text-ink-900"
                  }`}
                >
                  {tab.label}
                  <span className="text-xs text-ink-400">
                    {counts[tab.key] ?? 0}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <form action="/admin/orders" className="mb-6 flex gap-2">
        {status !== "all" && (
          <input type="hidden" name="status" value={status} />
        )}
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Order number, sub-order, customer name or email"
          aria-label="Search orders"
          className="rounded-md w-full max-w-md border border-ivory-400 bg-ivory-50 px-4 py-2.5 text-sm text-ink-900 placeholder:text-ink-400/60 focus:border-brand-600 focus:outline-none"
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
            {q ? `No orders match “${q}”.` : "No orders in this view."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => {
            const payment = order.payments[0];
            return (
              <li key={order.id}>
                <Link
                  href={`/admin/orders/${order.orderNumber}`}
                  className="block rounded-md border border-ivory-400 bg-ivory-50 p-4 transition-colors hover:border-ink-400"
                >
                  <div className="flex flex-wrap items-start gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink-900">
                        {order.orderNumber}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-400">
                        {order.customer.user.fullName}
                        {order.customer.customerType ===
                          CUSTOMER_TYPE.WHOLESALE && " · wholesale"}{" "}
                        · {order.shipCity}, {order.shipState}
                      </p>
                      <p className="mt-1 text-xs text-ink-500">
                        {formatDate(order.placedAt)}
                        {payment &&
                          ` · ${PAYMENT_METHOD_LABEL[payment.method as PaymentMethod] ?? payment.method} (${payment.status.toLowerCase()})`}
                        {order.couponCode && ` · ${order.couponCode}`}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <StatusBadge
                        label={
                          ORDER_STATUS_LABEL[order.status as OrderStatus] ??
                          order.status
                        }
                        tone={
                          ORDER_STATUS_TONE[order.status as OrderStatus] ??
                          "neutral"
                        }
                      />
                      <span className="text-sm text-ink-900">
                        {formatPaise(order.totalAmount)}
                      </span>
                    </div>
                  </div>

                  <ul className="mt-3 flex flex-wrap gap-2 border-t border-ivory-300 pt-3">
                    {order.subOrders.map((subOrder) => (
                      <li
                        key={subOrder.id}
                        className="flex items-center gap-2 text-xs text-ink-400"
                      >
                        <span>{subOrder.seller.businessName}</span>
                        <StatusBadge
                          label={
                            SUB_ORDER_STATUS_LABEL[subOrder.status] ??
                            subOrder.status
                          }
                          tone={subOrderTone(subOrder.status)}
                        />
                      </li>
                    ))}
                  </ul>
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
          {current > 1 ? (
            <Link
              href={keep({ page: current - 1 })}
              className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500 transition-colors hover:text-brand-600"
            >
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <p className="text-xs text-ink-400">
            Page {current} of {pageCount} · {total} order
            {total === 1 ? "" : "s"}
          </p>
          {current < pageCount ? (
            <Link
              href={keep({ page: current + 1 })}
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
