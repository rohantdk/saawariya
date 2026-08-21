import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Package } from "lucide-react";
import { formatDate, formatPaise } from "@/lib/utils";
import { requireCustomer } from "@/lib/commerce/context";
import {
  getOrderFilterCounts,
  listCustomerOrders,
  type OrderListFilter,
} from "@/lib/commerce/orders";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
} from "@/lib/commerce/order-status";
import {
  PAYMENT_METHOD_LABEL,
  type OrderStatus,
  type PaymentMethod,
} from "@/lib/constants";
import { StatusBadge } from "@/components/commerce/status-badge";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "My orders" };

const FILTERS: { slug: OrderListFilter; label: string }[] = [
  { slug: "all", label: "All" },
  { slug: "active", label: "In progress" },
  { slug: "delivered", label: "Delivered" },
  { slug: "cancelled", label: "Cancelled" },
];

/**
 * Order history — SRS §45.
 *
 * The filter tabs are links carrying a query parameter, not client state — the
 * same reasoning as the Phase 3 catalogue filters. Each tab shows its own count
 * so an empty tab is visibly empty rather than looking broken.
 */
export default async function OrdersPage(props: PageProps<"/account/orders">) {
  const [customer, searchParams] = await Promise.all([
    requireCustomer("/account/orders"),
    props.searchParams,
  ]);

  const requested =
    typeof searchParams.filter === "string" ? searchParams.filter : "all";
  const filter: OrderListFilter = FILTERS.some((f) => f.slug === requested)
    ? (requested as OrderListFilter)
    : "all";

  const page = Number(searchParams.page) || 1;

  const [{ orders, pageCount, page: currentPage, total }, counts] =
    await Promise.all([
      listCustomerOrders(customer.customerId, { filter, page }),
      getOrderFilterCounts(customer.customerId),
    ]);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-3xl sm:text-4xl">My orders</h1>
      <p className="mt-2 text-sm text-ink-400">
        {counts.all === 0
          ? "Orders you place will appear here."
          : `${counts.all} order${counts.all === 1 ? "" : "s"} placed to date.`}
      </p>

      {counts.all > 0 && (
        <nav aria-label="Filter orders" className="mt-6">
          <ul className="flex flex-wrap gap-2">
            {FILTERS.map((option) => {
              const isActive = option.slug === filter;
              return (
                <li key={option.slug}>
                  <Link
                    href={
                      option.slug === "all"
                        ? "/account/orders"
                        : `/account/orders?filter=${option.slug}`
                    }
                    aria-current={isActive ? "page" : undefined}
                    className={
                      isActive
                        ? "inline-block border border-brand-600 bg-brand-600 px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] text-cream"
                        : "inline-block border border-ivory-400 px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] text-ink-500 transition-colors hover:border-ink-400"
                    }
                  >
                    {option.label} ({counts[option.slug]})
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      {orders.length === 0 ? (
        <div className="mt-8 border border-ivory-400 bg-ivory-50 p-10 text-center">
          <span
            aria-hidden="true"
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-ivory-200 text-ink-400"
          >
            <Package className="h-5 w-5" />
          </span>
          <p className="text-sm text-ink-400">
            {counts.all === 0
              ? "You have not placed an order yet."
              : "No orders in this view."}
          </p>
          {counts.all === 0 && (
            <ButtonLink href="/shop" className="mt-5">
              Browse the shop
            </ButtonLink>
          )}
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {orders.map((order) => {
            const payment = order.payments[0] ?? null;
            const items = order.subOrders.flatMap((sub) => sub.items);

            return (
              <li
                key={order.id}
                className="border border-ivory-400 bg-ivory-50"
              >
                <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b border-ivory-400 p-4">
                  <div>
                    <Link
                      href={`/account/orders/${order.orderNumber}`}
                      className="font-display text-lg text-ink-900 hover:text-brand-600"
                    >
                      {order.orderNumber}
                    </Link>
                    <p className="mt-1 text-xs text-ink-400">
                      Placed {formatDate(order.placedAt)}
                      {payment &&
                        ` · ${PAYMENT_METHOD_LABEL[payment.method as PaymentMethod]}`}
                      {order.subOrders.length > 1 &&
                        ` · ${order.subOrders.length} parcels`}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <StatusBadge
                      label={ORDER_STATUS_LABEL[order.status as OrderStatus]}
                      tone={ORDER_STATUS_TONE[order.status as OrderStatus]}
                    />
                    <p className="font-display text-lg text-ink-900">
                      {formatPaise(order.totalAmount)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 p-4">
                  <ul className="flex flex-wrap gap-2">
                    {items.slice(0, 5).map((item) => (
                      <li
                        key={item.id}
                        className="relative aspect-[3/4] w-12 overflow-hidden bg-ivory-200"
                      >
                        {item.imageUrl && (
                          <Image
                            src={item.imageUrl}
                            alt={item.productName}
                            fill
                            sizes="48px"
                            className="object-cover"
                          />
                        )}
                      </li>
                    ))}
                    {items.length > 5 && (
                      <li className="flex aspect-[3/4] w-12 items-center justify-center bg-ivory-200 text-xs text-ink-400">
                        +{items.length - 5}
                      </li>
                    )}
                  </ul>

                  <Link
                    href={`/account/orders/${order.orderNumber}`}
                    className="ml-auto text-xs font-medium uppercase tracking-[0.14em] text-brand-600 hover:underline"
                  >
                    View details
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Pagination — links, so a page is bookmarkable and works without JS. */}
      {pageCount > 1 && (
        <nav aria-label="Order pages" className="mt-8 flex justify-center gap-2">
          {Array.from({ length: pageCount }, (_, index) => index + 1).map(
            (number) => {
              const params = new URLSearchParams();
              if (filter !== "all") params.set("filter", filter);
              if (number > 1) params.set("page", String(number));
              const query = params.toString();

              return (
                <Link
                  key={number}
                  href={`/account/orders${query ? `?${query}` : ""}`}
                  aria-current={number === currentPage ? "page" : undefined}
                  className={
                    number === currentPage
                      ? "border border-brand-600 bg-brand-600 px-3.5 py-2 text-xs text-cream"
                      : "border border-ivory-400 px-3.5 py-2 text-xs text-ink-500 transition-colors hover:border-ink-400"
                  }
                >
                  {number}
                </Link>
              );
            },
          )}
        </nav>
      )}

      {total > 0 && (
        <p className="mt-4 text-center text-xs text-ink-400">
          Showing {orders.length} of {total}
        </p>
      )}
    </div>
  );
}
