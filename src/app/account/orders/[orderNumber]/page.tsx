import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Store, Truck } from "lucide-react";
import { formatDate, formatDateTime, formatPaise } from "@/lib/utils";
import { requireCustomer } from "@/lib/commerce/context";
import { getCommerceSettings } from "@/lib/commerce/settings";
import { orderDispatch } from "@/lib/commerce/dispatch";
import {
  canCancel,
  getCustomerOrder,
  returnEligibility,
} from "@/lib/commerce/orders";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  SUB_ORDER_STATUS_LABEL,
  customerSubOrderLabel,
  subOrderTone,
} from "@/lib/commerce/order-status";
import {
  PAYMENT_METHOD_LABEL,
  SHIPMENT_STATUS_LABEL,
  type OrderStatus,
  type PaymentMethod,
  type ShipmentStatus,
} from "@/lib/constants";
import { StatusBadge } from "@/components/commerce/status-badge";
import { TrackingTimeline } from "@/components/commerce/tracking-timeline";
import {
  CancelOrderPanel,
  ReturnRequestPanel,
} from "@/components/commerce/order-actions";

export async function generateMetadata(
  props: PageProps<"/account/orders/[orderNumber]">,
): Promise<Metadata> {
  const { orderNumber } = await props.params;
  return { title: `Order ${orderNumber}` };
}

/**
 * Order detail and tracking — SRS §45, §46.
 *
 * Structured around SubOrders rather than the Order, because a SubOrder is what
 * physically ships. A customer who bought from three weavers has three parcels,
 * three timelines and potentially three tracking numbers, and flattening that
 * into one status would be a lie the moment two of them diverge.
 */
export default async function OrderDetailPage(
  props: PageProps<"/account/orders/[orderNumber]">,
) {
  const [{ orderNumber }, customer, settings] = await Promise.all([
    props.params,
    requireCustomer(),
    getCommerceSettings(),
  ]);

  const order = await getCustomerOrder(customer.customerId, orderNumber);
  if (!order) notFound();

  const payment = order.payments[0] ?? null;
  const billing = parseBilling(order.billingJson);

  // Return eligibility is per parcel and depends on a platform setting, so it
  // is resolved on the server, once per sub-order.
  const returnStates = await Promise.all(
    order.subOrders.map((subOrder) => returnEligibility(subOrder)),
  );

  // Same rule as the confirmation page: per parcel, governed by its slowest line.
  const dispatch = orderDispatch({
    placedAt: order.placedAt,
    dispatchDays: settings.dispatchDays,
    parcels: order.subOrders,
  });

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/account/orders"
        className="mb-6 inline-flex items-center gap-1 text-xs font-medium uppercase tracking-[0.14em] text-ink-400 transition-colors hover:text-brand-600"
      >
        <ChevronLeft aria-hidden="true" className="h-3.5 w-3.5" />
        All orders
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div>
          <h1 className="font-display text-3xl">{order.orderNumber}</h1>
          <p className="mt-1.5 text-sm text-ink-400">
            Placed {formatDate(order.placedAt)}
            {order.subOrders.length > 1 &&
              ` · ${order.subOrders.length} parcels`}
          </p>
        </div>
        <StatusBadge
          label={ORDER_STATUS_LABEL[order.status as OrderStatus]}
          tone={ORDER_STATUS_TONE[order.status as OrderStatus]}
        />
      </header>

      {order.status === "CANCELLED" && order.cancelReason && (
        <p className="mt-5 border border-danger/30 bg-danger-soft p-4 text-sm text-danger">
          Cancelled{order.cancelledAt && ` on ${formatDate(order.cancelledAt)}`}
          {" — "}
          {order.cancelReason}
        </p>
      )}

      {/* ---- Parcels ---- */}
      <div className="mt-8 space-y-6">
        {order.subOrders.map((subOrder, index) => {
          const returns = returnStates[index];

          return (
            <section
              key={subOrder.id}
              className="border border-ivory-400 bg-ivory-50"
            >
              <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 border-b border-ivory-400 p-5">
                <div>
                  <h2 className="flex items-center gap-2 text-sm text-ink-900">
                    <Store aria-hidden="true" className="h-4 w-4 text-ink-400" />
                    {subOrder.seller.businessName}
                  </h2>
                  <p className="mt-1 text-xs text-ink-400">
                    {subOrder.subOrderNumber}
                    {subOrder.seller.city &&
                      ` · ships from ${subOrder.seller.city}, ${subOrder.seller.state}`}
                  </p>
                  {/* Only while it is still coming. Once the parcel is on its
                      way the real tracking below is the better answer, and an
                      estimate sitting beside a dispatched date just contradicts
                      it. */}
                  {!subOrder.dispatchedAt && dispatch.parcels[index] && (
                    <p className="mt-1 text-xs text-ink-400">
                      {dispatch.parcels[index].loomWeeks
                        ? `Woven to order · dispatch expected by ${formatDate(dispatch.parcels[index].date)}`
                        : `Dispatch expected by ${formatDate(dispatch.parcels[index].date)}`}
                    </p>
                  )}
                </div>
                <StatusBadge
                  label={customerSubOrderLabel(subOrder.status)}
                  tone={subOrderTone(subOrder.status)}
                />
              </header>

              {/* Tracking */}
              <div className="border-b border-ivory-400 p-5">
                <TrackingTimeline
                  status={subOrder.status}
                  timestamps={{
                    placedAt: order.placedAt,
                    confirmedAt: subOrder.confirmedAt,
                    dispatchedAt: subOrder.dispatchedAt,
                    deliveredAt: subOrder.deliveredAt,
                  }}
                />

                {subOrder.shipment && (
                  <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-ivory-300 pt-4 text-xs text-ink-400">
                    <span className="flex items-center gap-1.5 text-ink-900">
                      <Truck aria-hidden="true" className="h-3.5 w-3.5" />
                      {subOrder.shipment.courierName}
                    </span>
                    <span>
                      Tracking{" "}
                      <span className="text-ink-900">
                        {subOrder.shipment.trackingNumber}
                      </span>
                    </span>
                    <span>
                      {SHIPMENT_STATUS_LABEL[
                        subOrder.shipment.status as ShipmentStatus
                      ] ?? subOrder.shipment.status}
                    </span>
                  </div>
                )}

                {subOrder.returnRequest && (
                  <p className="mt-4 border-t border-ivory-300 pt-4 text-xs text-warning">
                    Return {subOrder.returnRequest.status.toLowerCase()} —{" "}
                    {subOrder.returnRequest.reason} (requested{" "}
                    {formatDate(subOrder.returnRequest.requestedAt)})
                  </p>
                )}
              </div>

              {/* Items */}
              <ul className="divide-y divide-ivory-300 px-5">
                {subOrder.items.map((item) => (
                  <li key={item.id} className="flex gap-4 py-4">
                    <div className="relative aspect-[3/4] w-14 shrink-0 overflow-hidden bg-ivory-200">
                      {item.imageUrl && (
                        <Image
                          src={item.imageUrl}
                          alt={item.productName}
                          fill
                          sizes="56px"
                          className="object-cover"
                        />
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 justify-between gap-4">
                      <div className="min-w-0">
                        {/* The product may since have been delisted; the order
                            line survives either way, so only link when there is
                            still a page to land on. */}
                        {item.product.status === "APPROVED" ? (
                          <Link
                            href={`/product/${item.product.slug}`}
                            className="text-sm text-ink-900 hover:text-brand-600"
                          >
                            {item.productName}
                          </Link>
                        ) : (
                          <p className="text-sm text-ink-900">
                            {item.productName}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-ink-400">
                          {item.productSku} · Qty {item.quantity} ·{" "}
                          {formatPaise(item.unitPrice)} each
                          {item.priceTier === "WHOLESALE" && " · trade price"}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm tabular-nums text-ink-900">
                        {formatPaise(item.lineTotal)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Event log + return */}
              <div className="space-y-4 border-t border-ivory-400 p-5">
                {subOrder.events.length > 0 && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-xs font-medium uppercase tracking-[0.14em] text-ink-400 transition-colors hover:text-brand-600">
                      Parcel history ({subOrder.events.length})
                    </summary>
                    <ol className="mt-3 space-y-2.5 border-l border-ivory-400 pl-4">
                      {subOrder.events.map((event) => (
                        <li key={event.id} className="text-xs">
                          <p className="text-ink-900">
                            {SUB_ORDER_STATUS_LABEL[event.toStatus] ??
                              event.toStatus}
                          </p>
                          <p className="mt-0.5 text-ink-400">
                            {formatDateTime(event.createdAt)}
                            {event.note && ` · ${event.note}`}
                          </p>
                        </li>
                      ))}
                    </ol>
                  </details>
                )}

                {returns.eligible && (
                  <ReturnRequestPanel
                    subOrderNumber={subOrder.subOrderNumber}
                    closesOn={returns.closesOn}
                  />
                )}
              </div>
            </section>
          );
        })}
      </div>

      {/* ---- Payment, delivery, billing ---- */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <section className="border border-ivory-400 bg-ivory-50 p-5">
          <h2 className="mb-3 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400">
            Payment
          </h2>
          <dl className="space-y-2 text-sm">
            <Row label="Subtotal" value={formatPaise(order.subtotal)} />
            {order.discountAmount > 0 && (
              <Row
                label={
                  order.couponCode ? `Discount · ${order.couponCode}` : "Discount"
                }
                value={`− ${formatPaise(order.discountAmount)}`}
              />
            )}
            <Row
              label="Shipping"
              value={
                order.shippingAmount === 0
                  ? "Free"
                  : formatPaise(order.shippingAmount)
              }
            />
            <Row
              label="GST (included)"
              value={formatPaise(order.taxAmount)}
              muted
            />
            <div className="flex items-baseline justify-between border-t border-ivory-300 pt-2">
              <dt className="text-ink-900">Total</dt>
              <dd className="font-display text-ink-900">
                {formatPaise(order.totalAmount)}
              </dd>
            </div>
          </dl>

          {payment && (
            <div className="mt-3 border-t border-ivory-300 pt-3 text-xs text-ink-400">
              <p>
                {PAYMENT_METHOD_LABEL[payment.method as PaymentMethod]} ·{" "}
                {payment.status === "SUCCESS"
                  ? `paid ${payment.paidAt ? formatDate(payment.paidAt) : ""}`
                  : payment.status.toLowerCase()}
              </p>
              {payment.gatewayRef && (
                <p className="mt-1">Reference {payment.gatewayRef}</p>
              )}
              {payment.refunds.map((refund) => (
                <p key={refund.id} className="mt-1 text-warning">
                  Refund of {formatPaise(refund.amount)} —{" "}
                  {refund.status.toLowerCase().replace(/_/g, " ")}
                </p>
              ))}
            </div>
          )}
        </section>

        <section className="border border-ivory-400 bg-ivory-50 p-5">
          <h2 className="mb-3 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400">
            Delivering to
          </h2>
          <address className="text-sm not-italic leading-relaxed text-ink-500">
            <span className="block text-ink-900">{order.shipShippingName}</span>
            {[
              order.shipLine1,
              order.shipLine2,
              `${order.shipCity}, ${order.shipState} ${order.shipPinCode}`,
              order.shipCountry,
            ]
              .filter(Boolean)
              .map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            <span className="mt-2 block text-xs text-ink-400">
              {order.shipMobile}
            </span>
          </address>

          <h2 className="mb-2 mt-5 border-t border-ivory-300 pt-4 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400">
            Billing
          </h2>
          {order.billingSameAsShip || !billing ? (
            <p className="text-sm text-ink-400">Same as the delivery address.</p>
          ) : (
            <address className="text-sm not-italic leading-relaxed text-ink-500">
              <span className="block text-ink-900">{billing.fullName}</span>
              <span className="block">
                {[
                  billing.line1,
                  billing.line2,
                  `${billing.city}, ${billing.state} ${billing.pinCode}`,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </span>
            </address>
          )}
        </section>
      </div>

      {/* ---- Order-level history and cancellation ---- */}
      {order.events.length > 0 && (
        <section className="mt-6">
          <details className="border border-ivory-400 bg-ivory-50">
            <summary className="cursor-pointer p-4 text-xs font-medium uppercase tracking-[0.14em] text-ink-400 transition-colors hover:text-brand-600">
              Order history ({order.events.length})
            </summary>
            <ol className="space-y-3 border-t border-ivory-400 p-5">
              {order.events.map((event) => (
                <li key={event.id} className="text-xs">
                  <p className="text-ink-900">
                    {ORDER_STATUS_LABEL[event.toStatus as OrderStatus] ??
                      event.toStatus}
                  </p>
                  <p className="mt-0.5 text-ink-400">
                    {formatDateTime(event.createdAt)}
                    {event.note && ` · ${event.note}`}
                  </p>
                </li>
              ))}
            </ol>
          </details>
        </section>
      )}

      <div className="mt-6 space-y-3">
        {canCancel(order) && <CancelOrderPanel orderNumber={order.orderNumber} />}

        <p className="text-xs text-ink-400">
          Something wrong with this order?{" "}
          <Link
            href={`/account/support/new?order=${order.orderNumber}`}
            className="text-brand-600 underline underline-offset-2"
          >
            Raise a support request
          </Link>
        </p>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-ink-400">{label}</dt>
      <dd className={muted ? "tabular-nums text-ink-400" : "tabular-nums text-ink-900"}>
        {value}
      </dd>
    </div>
  );
}

/**
 * The billing address is stored as a JSON snapshot, so it survives the customer
 * editing or deleting the address it was copied from. Anything unparseable is
 * treated as absent rather than throwing — a malformed blob must not take down
 * a page whose main job is showing someone their order.
 */
function parseBilling(
  json: string | null,
): { fullName: string; line1: string; line2: string | null; city: string; state: string; pinCode: string } | null {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}
