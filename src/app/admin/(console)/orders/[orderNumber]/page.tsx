import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/context";
import { getOrderDetail } from "@/lib/admin/orders";
import { availableTransitions } from "@/lib/order-state-machine";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  SUB_ORDER_STATUS_LABEL,
  subOrderTone,
} from "@/lib/commerce/order-status";
import { REFUND_STATUS_TONE, SETTLEMENT_STATUS_TONE } from "@/lib/status-tone";
import {
  CUSTOMER_TYPE,
  PAYMENT_METHOD_LABEL,
  PRICE_TIER,
  type OrderStatus,
  type PaymentMethod,
} from "@/lib/constants";
import { formatDateTime, formatPaise } from "@/lib/utils";
import { StatusBadge } from "@/components/commerce/status-badge";
import { OrderOverride } from "@/components/admin/order-override";

export const metadata: Metadata = { title: "Order" };

/**
 * One order, in full — SRS §78.
 *
 * The override controls are rendered from `availableTransitions()` with the
 * admin's own permission set, so the console never draws a move that does not
 * exist in the state machine, and `assertTransition` re-checks on submit.
 *
 * Unlike the seller's view, the customer's full delivery address **is** shown
 * here. The seller is deliberately not given it — under the platform-warehouse
 * model they never ship the parcel — but the platform does need it, and this is
 * the screen where a delivery problem is diagnosed.
 */
export default async function AdminOrderDetailPage({
  params,
}: PageProps<"/admin/orders/[orderNumber]">) {
  const admin = await requireAdmin("/admin/orders");
  const { orderNumber } = await params;

  const order = await getOrderDetail(orderNumber);
  if (!order) notFound();

  const payment = order.payments[0];
  const refunds = order.payments.flatMap((p) => p.refunds);

  // The parts must always sum to the whole — the invariant SubOrder.discountAmount
  // exists to preserve. Shown rather than assumed, because a discounted
  // multi-seller order is exactly where it would silently stop being true.
  const reconciled = order.subOrders.reduce(
    (sum, sub) => sum + sub.subtotal - sub.discountAmount + sub.shippingAmount,
    0,
  );

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/admin/orders"
        className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500 transition-colors hover:text-brand-600"
      >
        ← All orders
      </Link>

      <header className="mb-8 mt-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl">{order.orderNumber}</h1>
          <StatusBadge
            label={
              ORDER_STATUS_LABEL[order.status as OrderStatus] ?? order.status
            }
            tone={ORDER_STATUS_TONE[order.status as OrderStatus] ?? "neutral"}
          />
        </div>
        <p className="mt-2 text-sm text-ink-400">
          Placed {formatDateTime(order.placedAt)} by{" "}
          <Link
            href={`/admin/customers/${order.customer.id}`}
            className="text-ink-500 underline-offset-4 hover:text-brand-600 hover:underline"
          >
            {order.customer.user.fullName}
          </Link>
          {order.customer.customerType === CUSTOMER_TYPE.WHOLESALE &&
            " · wholesale account"}
        </p>
        {order.cancelReason && (
          <p className="mt-2 text-sm text-danger">
            Cancelled: {order.cancelReason}
          </p>
        )}
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_18rem]">
        <div className="min-w-0 space-y-8">
          {/* ---- Sub-orders ---- */}
          {order.subOrders.map((subOrder) => {
            const transitions = availableTransitions(
              subOrder.status,
              admin.permissions,
            ).map((t) => ({ to: t.to, label: t.label, actor: t.actor }));

            return (
              <section
                key={subOrder.id}
                className="rounded-md border border-ivory-400 bg-ivory-50"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ivory-300 px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-sm text-ink-900">
                      {subOrder.subOrderNumber}
                    </p>
                    <Link
                      href={`/admin/sellers/${subOrder.seller.id}`}
                      className="text-xs text-ink-400 underline-offset-4 hover:text-brand-600 hover:underline"
                    >
                      {subOrder.seller.businessName}
                    </Link>
                  </div>
                  <StatusBadge
                    label={
                      SUB_ORDER_STATUS_LABEL[subOrder.status] ?? subOrder.status
                    }
                    tone={subOrderTone(subOrder.status)}
                  />
                </div>

                <ul>
                  {subOrder.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-wrap items-center gap-4 border-b border-ivory-300 px-5 py-4"
                    >
                      <span className="relative aspect-square w-14 shrink-0 overflow-hidden bg-ivory-200">
                        {item.imageUrl && (
                          <Image
                            src={item.imageUrl}
                            alt=""
                            fill
                            sizes="56px"
                            className="object-cover"
                          />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/admin/products/${item.productId}`}
                          className="truncate text-sm text-ink-900 underline-offset-4 hover:text-brand-600 hover:underline"
                        >
                          {item.productName}
                        </Link>
                        <p className="mt-0.5 text-xs text-ink-400">
                          {item.productSku} · {item.quantity} ×{" "}
                          {formatPaise(item.unitPrice)}
                          {item.priceTier === PRICE_TIER.WHOLESALE &&
                            " (wholesale)"}
                        </p>
                      </div>
                      <span className="text-sm text-ink-900">
                        {formatPaise(item.lineTotal)}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ivory-300 px-5 py-3 text-xs text-ink-400">
                  <span>
                    Gross {formatPaise(subOrder.subtotal)}
                    {subOrder.discountAmount > 0 &&
                      ` − ${formatPaise(subOrder.discountAmount)} coupon share`}
                    {subOrder.shippingAmount > 0 &&
                      ` + ${formatPaise(subOrder.shippingAmount)} shipping`}
                  </span>
                  <span className="text-ink-900">
                    {formatPaise(
                      subOrder.subtotal -
                        subOrder.discountAmount +
                        subOrder.shippingAmount,
                    )}
                  </span>
                </div>

                {subOrder.settlement && (
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ivory-300 px-5 py-3">
                    <span className="text-xs text-ink-400">
                      Settlement — {formatPaise(subOrder.settlement.grossAmount)}{" "}
                      gross, {formatPaise(subOrder.settlement.commissionAmount)}{" "}
                      commission,{" "}
                      <span className="text-ink-900">
                        {formatPaise(subOrder.settlement.netAmount)}
                      </span>{" "}
                      to the seller
                    </span>
                    <StatusBadge
                      label={subOrder.settlement.status}
                      tone={
                        SETTLEMENT_STATUS_TONE[subOrder.settlement.status] ??
                        "neutral"
                      }
                    />
                  </div>
                )}

                <div className="px-5 py-4">
                  <OrderOverride
                    subOrderId={subOrder.id}
                    subOrderNumber={subOrder.subOrderNumber}
                    transitions={transitions}
                  />
                </div>
              </section>
            );
          })}

          {/* ---- Timeline ---- */}
          <section>
            <h2 className="mb-3 font-display text-xl">Timeline</h2>
            {order.events.length === 0 ? (
              <div className="rounded-md border border-ivory-400 bg-ivory-50 p-6 text-center text-sm text-ink-400">
                No pipeline events recorded yet.
              </div>
            ) : (
              <ol className="rounded-md border border-ivory-400 bg-ivory-50">
                {order.events.map((event) => {
                  const subOrder = order.subOrders.find(
                    (s) => s.id === event.subOrderId,
                  );
                  return (
                    <li
                      key={event.id}
                      className="flex flex-wrap gap-x-4 gap-y-1 border-b border-ivory-300 px-5 py-3 last:border-b-0"
                    >
                      <span className="w-40 shrink-0 text-xs text-ink-400">
                        {formatDateTime(event.createdAt)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="text-sm text-ink-900">
                          {event.fromStatus
                            ? `${event.fromStatus.replace(/_/g, " ").toLowerCase()} → ${event.toStatus.replace(/_/g, " ").toLowerCase()}`
                            : event.toStatus.replace(/_/g, " ").toLowerCase()}
                        </span>
                        {event.note && (
                          <span className="mt-0.5 block text-xs leading-relaxed text-ink-500">
                            {event.note}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-xs text-ink-400">
                        {subOrder ? `${subOrder.subOrderNumber} · ` : ""}
                        {event.actorRole.replace(/_/g, " ").toLowerCase()}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>

        {/* ---- Sidebar ---- */}
        <aside className="space-y-6">
          <section className="rounded-md border border-ivory-400 bg-ivory-50 p-5">
            <p className="mb-4 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400">
              Money
            </p>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-400">Goods</dt>
                <dd className="text-ink-900">{formatPaise(order.subtotal)}</dd>
              </div>
              {order.discountAmount > 0 && (
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-400">
                    Discount{order.couponCode && ` (${order.couponCode})`}
                  </dt>
                  <dd className="text-success">
                    −{formatPaise(order.discountAmount)}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-ink-400">Shipping</dt>
                <dd className="text-ink-900">
                  {order.shippingAmount === 0
                    ? "Free"
                    : formatPaise(order.shippingAmount)}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-ivory-300 pt-3">
                <dt className="text-ink-900">Total</dt>
                <dd className="text-ink-900">
                  {formatPaise(order.totalAmount)}
                </dd>
              </div>
              <div className="flex justify-between gap-4 text-xs">
                <dt className="text-ink-400">
                  GST included ({order.taxAmount > 0 ? "extracted" : "n/a"})
                </dt>
                <dd className="text-ink-400">{formatPaise(order.taxAmount)}</dd>
              </div>
              <div className="flex justify-between gap-4 text-xs">
                <dt className="text-ink-400">Sub-orders reconcile</dt>
                <dd
                  className={
                    reconciled === order.totalAmount
                      ? "text-success"
                      : "text-danger"
                  }
                >
                  {formatPaise(reconciled)}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-md border border-ivory-400 bg-ivory-50 p-5">
            <p className="mb-4 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400">
              Payment
            </p>
            {payment ? (
              <>
                <p className="text-sm text-ink-900">
                  {PAYMENT_METHOD_LABEL[payment.method as PaymentMethod] ??
                    payment.method}
                </p>
                <p className="mt-0.5 text-xs text-ink-400">
                  {payment.status.toLowerCase()}
                  {payment.paidAt && ` · ${formatDateTime(payment.paidAt)}`}
                </p>
                {payment.gatewayRef && (
                  <p className="mt-1 text-xs text-ink-400">
                    {payment.gatewayRef}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-ink-400">No payment recorded.</p>
            )}

            {refunds.length > 0 && (
              <ul className="mt-4 space-y-2 border-t border-ivory-300 pt-4">
                {refunds.map((refund) => (
                  <li
                    key={refund.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="text-xs text-ink-400">
                      Refund {formatPaise(refund.amount)}
                    </span>
                    <StatusBadge
                      label={refund.status}
                      tone={REFUND_STATUS_TONE[refund.status] ?? "neutral"}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-md border border-ivory-400 bg-ivory-50 p-5">
            <p className="mb-4 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400">
              Delivery address
            </p>
            <p className="text-sm text-ink-900">{order.shipShippingName}</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-500">
              {order.shipLine1}
              {order.shipLine2 && `, ${order.shipLine2}`}
              <br />
              {order.shipCity}, {order.shipState} {order.shipPinCode}
              <br />
              {order.shipMobile}
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
