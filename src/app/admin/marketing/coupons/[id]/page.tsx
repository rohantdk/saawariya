import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireDesk } from "@/lib/admin/context";
import { findCoupon } from "@/lib/marketing/coupons";
import { ROLES, type OrderStatus } from "@/lib/constants";
import { ORDER_STATUS_TONE } from "@/lib/commerce/order-status";
import { formatDate, formatPaise } from "@/lib/utils";
import { StatusBadge } from "@/components/commerce/status-badge";
import { CouponForm } from "@/components/marketing/coupon-form";

export const metadata: Metadata = { title: "Coupon" };

/**
 * One coupon, with what it has actually done — SRS §126, §129.
 *
 * The order list beneath the form is the point of this page. A coupon's
 * settings are a guess about behaviour; the orders are the behaviour. Cancelled
 * orders are shown too, greyed by their status badge, because a code whose
 * redemptions were mostly cancelled is telling you something a redemption count
 * alone would hide.
 */
export default async function CouponDetailPage({
  params,
}: PageProps<"/admin/marketing/coupons/[id]">) {
  await requireDesk(ROLES.MARKETING, "/admin/marketing/coupons");
  const { id } = await params;

  const coupon = await findCoupon(id);
  if (!coupon) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/admin/marketing/coupons"
        className="mb-4 inline-block text-xs font-medium uppercase tracking-[0.14em] text-ink-500 transition-colors hover:text-brand-600"
      >
        ← All coupons
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow mb-2">SRS §126 — Coupon</p>
          <h1 className="font-mono text-3xl text-ink-900">{coupon.code}</h1>
        </div>
        <StatusBadge label={coupon.state.label} />
      </header>

      <div className="mb-8 grid grid-cols-3 gap-3 border border-ivory-400 bg-ivory-50 p-5">
        <div className="min-w-0">
          <p className="text-xs text-ink-400">Surviving orders</p>
          <p className="font-display text-2xl text-ink-900">{coupon.orders}</p>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-ink-400">Given away</p>
          <p className="font-display text-2xl text-ink-900">
            {formatPaise(coupon.discountGiven)}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-ink-400">Order value</p>
          <p className="font-display text-2xl text-ink-900">
            {formatPaise(coupon.revenueInfluenced)}
          </p>
        </div>
      </div>

      <section className="mb-10">
        <h2 className="mb-4 font-display text-xl">Settings</h2>
        <CouponForm coupon={coupon} />
      </section>

      <section>
        <h2 className="mb-1 font-display text-xl">Where it was used</h2>
        <p className="mb-4 text-sm text-ink-400">
          The ten most recent orders carrying this code, cancelled ones included
          — a code whose redemptions were mostly cancelled is worth knowing about.
        </p>

        {coupon.recent.length === 0 ? (
          <p className="border border-ivory-400 bg-ivory-50 px-5 py-4 text-sm text-ink-400">
            Nobody has used this code yet.
          </p>
        ) : (
          <div className="overflow-x-auto border border-ivory-400 bg-ivory-50">
            <table className="w-full min-w-[32rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-ivory-400 text-left text-xs uppercase tracking-[0.1em] text-ink-400">
                  <th className="px-4 py-3 font-medium">Order</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 text-right font-medium">Discount</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {coupon.recent.map((order) => (
                  <tr
                    key={order.orderNumber}
                    className="border-b border-ivory-300 last:border-b-0"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/orders/${order.orderNumber}`}
                        className="text-ink-900 underline-offset-4 hover:text-brand-600 hover:underline"
                      >
                        {order.orderNumber}
                      </Link>
                      <span className="block text-xs text-ink-400">
                        {formatDate(order.placedAt)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-500">
                      {order.customer.user.fullName}
                    </td>
                    <td className="px-4 py-3 text-right text-ink-900">
                      {formatPaise(order.discountAmount)}
                    </td>
                    <td className="px-4 py-3 text-right text-ink-500">
                      {formatPaise(order.totalAmount)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        label={order.status}
                        tone={
                          ORDER_STATUS_TONE[order.status as OrderStatus] ??
                          "neutral"
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
