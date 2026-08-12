import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/context";
import { getCustomerDetail } from "@/lib/admin/customers";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from "@/lib/commerce/order-status";
import { REVIEW_STATUS_TONE, USER_STATUS_TONE } from "@/lib/status-tone";
import type { OrderStatus } from "@/lib/constants";
import { formatDate, formatDateTime, formatPaise } from "@/lib/utils";
import { StatusBadge } from "@/components/commerce/status-badge";
import {
  CustomerStatusActions,
  CustomerTierForm,
} from "@/components/admin/customer-actions";

export const metadata: Metadata = { title: "Customer" };

/**
 * One customer account — SRS §73.
 *
 * The two controls on this page do genuinely different things and are kept
 * apart: the tier changes what the customer is charged, suspension changes
 * whether they can use the site at all. Putting them in one panel invites
 * someone to reach for the wrong one.
 */
export default async function AdminCustomerDetailPage({
  params,
}: PageProps<"/admin/customers/[id]">) {
  await requireAdmin("/admin/customers");
  const { id } = await params;

  const data = await getCustomerDetail(id);
  if (!data) notFound();

  const { customer, orders, stats, reviews, tickets } = data;
  const { user } = customer;

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/admin/customers"
        className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500 transition-colors hover:text-brand-600"
      >
        ← All customers
      </Link>

      <header className="mb-8 mt-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl">{user.fullName}</h1>
          <StatusBadge
            label={user.status}
            tone={USER_STATUS_TONE[user.status] ?? "neutral"}
          />
        </div>
        <p className="mt-2 text-sm text-ink-400">
          {user.email}
          {user.mobile && ` · ${user.mobile}`} · joined{" "}
          {formatDate(customer.createdAt)}
          {user.lastLoginAt &&
            ` · last signed in ${formatDateTime(user.lastLoginAt)}`}
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_18rem]">
        <div className="min-w-0 space-y-8">
          {/* ---- Orders ---- */}
          <section>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="font-display text-xl">Orders</h2>
              <p className="text-xs text-ink-400">
                {stats.orderCount} placed · {formatPaise(stats.lifetimeValue)}{" "}
                lifetime, cancellations excluded
              </p>
            </div>

            {orders.length === 0 ? (
              <div className="border border-ivory-400 bg-ivory-50 p-6 text-center text-sm text-ink-400">
                This customer has not ordered yet.
              </div>
            ) : (
              <ul className="border border-ivory-400 bg-ivory-50">
                {orders.map((order) => (
                  <li
                    key={order.id}
                    className="border-b border-ivory-300 last:border-b-0"
                  >
                    <Link
                      href={`/admin/orders/${order.orderNumber}`}
                      className="flex flex-wrap items-center gap-3 px-5 py-3 transition-colors hover:bg-ivory-200"
                    >
                      <span className="min-w-0 flex-1 text-sm text-ink-900">
                        {order.orderNumber}
                      </span>
                      <span className="text-xs text-ink-400">
                        {order._count.subOrders} seller
                        {order._count.subOrders === 1 ? "" : "s"}
                      </span>
                      <span className="text-xs text-ink-400">
                        {formatDate(order.placedAt)}
                      </span>
                      <span className="text-sm text-ink-900">
                        {formatPaise(order.totalAmount)}
                      </span>
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
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ---- Addresses ---- */}
          <section>
            <h2 className="mb-3 font-display text-xl">Addresses</h2>
            {user.addresses.length === 0 ? (
              <div className="border border-ivory-400 bg-ivory-50 p-6 text-center text-sm text-ink-400">
                No saved addresses.
              </div>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {user.addresses.map((address) => (
                  <li
                    key={address.id}
                    className="border border-ivory-400 bg-ivory-50 p-4"
                  >
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink-400">
                      {address.label}
                      {address.isDefaultShipping && " · default"}
                    </p>
                    <p className="mt-1.5 text-sm text-ink-900">
                      {address.fullName}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-ink-500">
                      {address.line1}, {address.city}, {address.state}{" "}
                      {address.pinCode}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ---- Reviews ---- */}
          <section>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="font-display text-xl">Reviews</h2>
              <Link
                href="/admin/reviews"
                className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500 transition-colors hover:text-brand-600"
              >
                Moderation queue →
              </Link>
            </div>
            {reviews.length === 0 ? (
              <div className="border border-ivory-400 bg-ivory-50 p-6 text-center text-sm text-ink-400">
                No reviews written.
              </div>
            ) : (
              <ul className="border border-ivory-400 bg-ivory-50">
                {reviews.map((review) => (
                  <li
                    key={review.id}
                    className="flex flex-wrap items-center gap-3 border-b border-ivory-300 px-5 py-3 last:border-b-0"
                  >
                    <span className="text-sm text-ink-900">
                      {review.rating} ★
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-ink-500">
                      {review.title ?? review.product.name}
                    </span>
                    <span className="text-xs text-ink-400">
                      {formatDate(review.createdAt)}
                    </span>
                    <StatusBadge
                      label={review.status}
                      tone={REVIEW_STATUS_TONE[review.status] ?? "neutral"}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ---- Tickets ---- */}
          <section>
            <h2 className="mb-3 font-display text-xl">Support tickets</h2>
            {tickets.length === 0 ? (
              <div className="border border-ivory-400 bg-ivory-50 p-6 text-center text-sm text-ink-400">
                No tickets raised.
              </div>
            ) : (
              <ul className="border border-ivory-400 bg-ivory-50">
                {tickets.map((ticket) => (
                  <li
                    key={ticket.id}
                    className="flex flex-wrap items-center gap-3 border-b border-ivory-300 px-5 py-3 last:border-b-0"
                  >
                    <span className="text-xs text-ink-400">
                      {ticket.ticketNumber}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-ink-900">
                      {ticket.subject}
                    </span>
                    <span className="text-xs text-ink-400">
                      {ticket.priority.toLowerCase()} priority
                    </span>
                    <StatusBadge label={ticket.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* ---- Controls ---- */}
        <aside className="space-y-6">
          <section className="border border-ivory-400 bg-ivory-50 p-5">
            <p className="mb-4 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400">
              Account
            </p>
            <dl className="mb-5 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-400">Email verified</dt>
                <dd className="text-ink-900">
                  {user.emailVerified ? "Yes" : "No"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-400">Mobile verified</dt>
                <dd className="text-ink-900">
                  {user.mobileVerified ? "Yes" : "No"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-400">Orders</dt>
                <dd className="text-ink-900">{stats.orderCount}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-400">Lifetime value</dt>
                <dd className="text-ink-900">
                  {formatPaise(stats.lifetimeValue)}
                </dd>
              </div>
            </dl>

            <CustomerStatusActions userId={user.id} status={user.status} />
          </section>

          <section className="border border-ivory-400 bg-ivory-50 p-5">
            <CustomerTierForm
              customerId={customer.id}
              customerType={customer.customerType}
              gstNumber={customer.gstNumber}
            />
          </section>
        </aside>
      </div>
    </div>
  );
}
