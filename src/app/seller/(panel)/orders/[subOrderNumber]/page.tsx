import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSeller } from "@/lib/seller/context";
import { getSellerOrder } from "@/lib/seller/orders";
import { availableTransitions } from "@/lib/order-state-machine";
import {
  SUB_ORDER_STATUS_LABEL,
  subOrderTone,
} from "@/lib/commerce/order-status";
import {
  PAYMENT_METHOD_LABEL,
  PRICE_TIER,
  SETTLEMENT_STATUS,
  type PaymentMethod,
} from "@/lib/constants";
import { formatDateTime, formatPaise } from "@/lib/utils";
import { StatusBadge } from "@/components/commerce/status-badge";
import { OrderTransition } from "@/components/seller/order-transition";
import { ButtonLink } from "@/components/ui/button";

export async function generateMetadata({
  params,
}: PageProps<"/seller/orders/[subOrderNumber]">): Promise<Metadata> {
  const { subOrderNumber } = await params;
  return { title: `Order ${subOrderNumber}` };
}

/**
 * One sub-order — SRS §61, §62.
 *
 * The action buttons come from `availableTransitions()` filtered by this
 * seller's permissions, so under the platform-warehouse model only "confirm"
 * and "decline" ever appear: picking and packing need permissions a seller does
 * not hold. The list is computed, not hard-coded, so when Phase 7 adds the
 * operations panels the same helper drives them without this page changing.
 */
export default async function SellerOrderPage({
  params,
}: PageProps<"/seller/orders/[subOrderNumber]">) {
  const seller = await requireSeller();
  const { subOrderNumber } = await params;

  const order = await getSellerOrder(seller.sellerId, subOrderNumber);
  if (!order) notFound();

  const moves = availableTransitions(order.status, seller.permissions).map(
    (transition) => ({ to: transition.to, label: transition.label }),
  );

  const payment = order.order.payments[0];
  const isWholesale = order.items.some(
    (item) => item.priceTier === PRICE_TIER.WHOLESALE,
  );

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/seller/orders"
        className="mb-5 inline-block text-xs font-medium uppercase tracking-[0.14em] text-ink-400 transition-colors hover:text-brand-600"
      >
        ← Orders
      </Link>

      <header className="mb-8">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl">{order.subOrderNumber}</h1>
          <StatusBadge
            label={SUB_ORDER_STATUS_LABEL[order.status] ?? order.status}
            tone={subOrderTone(order.status)}
          />
          {isWholesale && <StatusBadge label="Wholesale" tone="info" />}
        </div>
        <p className="text-sm text-ink-400">
          Part of order {order.order.orderNumber} · placed{" "}
          {formatDateTime(order.order.placedAt)}
        </p>
      </header>

      {/* ---- Actions ---- */}
      {moves.length > 0 && (
        <section className="mb-10 border border-ivory-400 bg-ivory-50 p-5">
          <OrderTransition subOrderId={order.id} transitions={moves} />
        </section>
      )}

      {/* ---- Items ---- */}
      <section className="mb-10">
        <h2 className="mb-4 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400">
          Items
        </h2>
        <ul className="border border-ivory-400 bg-ivory-50">
          {order.items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center gap-4 border-b border-ivory-300 p-4 last:border-b-0"
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
                  href={`/seller/products/${item.productId}`}
                  className="block truncate text-sm text-ink-900 transition-colors hover:text-brand-600"
                >
                  {item.productName}
                </Link>
                <p className="mt-0.5 text-xs text-ink-400">
                  {item.productSku} · {formatPaise(item.unitPrice)} ×{" "}
                  {item.quantity}
                </p>
              </div>
              <p className="text-sm text-ink-900">
                {formatPaise(item.lineTotal)}
              </p>
            </li>
          ))}
        </ul>

        <dl className="mt-4 space-y-2 text-sm">
          <Row label="Your goods total" value={formatPaise(order.subtotal)} />
          {order.discountAmount > 0 && (
            <Row
              label="Share of platform discount"
              value={`− ${formatPaise(order.discountAmount)}`}
              hint="Funded by Saawariya, not deducted from your commission base."
            />
          )}
          {order.shippingAmount > 0 && (
            <Row
              label="Shipping"
              value={formatPaise(order.shippingAmount)}
            />
          )}
          <div className="flex justify-between gap-4 border-t border-ivory-400 pt-2 text-ink-900">
            <dt>Parcel total</dt>
            <dd>{formatPaise(order.totalAmount)}</dd>
          </div>
        </dl>
      </section>

      {/* ---- Customer & payment ---- */}
      <div className="mb-10 grid gap-6 sm:grid-cols-2">
        <section>
          <h2 className="mb-3 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400">
            Deliver to
          </h2>
          <div className="border border-ivory-400 bg-ivory-50 p-4 text-sm">
            <p className="text-ink-900">
              {order.order.customer.user.fullName}
            </p>
            <p className="mt-1 text-ink-500">
              {order.order.shipCity}, {order.order.shipState}{" "}
              {order.order.shipPinCode}
            </p>
            {/* The full street address is deliberately not here — the platform
                warehouse ships the parcel, so the seller has no use for it. */}
            <p className="mt-2 text-xs leading-relaxed text-ink-400">
              The full address goes to our warehouse, which packs and ships this
              parcel.
            </p>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400">
            Payment
          </h2>
          <div className="border border-ivory-400 bg-ivory-50 p-4 text-sm">
            {payment ? (
              <>
                <p className="text-ink-900">
                  {PAYMENT_METHOD_LABEL[payment.method as PaymentMethod] ??
                    payment.method}
                </p>
                <p className="mt-1 text-ink-500">{payment.status}</p>
              </>
            ) : (
              <p className="text-ink-400">No payment recorded.</p>
            )}
          </div>
        </section>
      </div>

      {/* ---- Settlement ---- */}
      {order.settlement && (
        <section className="mb-10">
          <h2 className="mb-3 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400">
            Your payout
          </h2>
          <div className="border border-ivory-400 bg-ivory-50 p-4">
            <dl className="space-y-2 text-sm">
              <Row
                label="Gross"
                value={formatPaise(order.settlement.grossAmount)}
              />
              <Row
                label={`Commission (${order.settlement.commissionPercent}%)`}
                value={`− ${formatPaise(order.settlement.commissionAmount)}`}
              />
              <div className="flex justify-between gap-4 border-t border-ivory-400 pt-2 text-ink-900">
                <dt>Net to you</dt>
                <dd>{formatPaise(order.settlement.netAmount)}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-ink-400">
              {order.settlement.status === SETTLEMENT_STATUS.RELEASED &&
              order.settlement.releasedAt
                ? `Released ${formatDateTime(order.settlement.releasedAt)}.`
                : "Awaiting release in the next payout run."}
            </p>
          </div>
        </section>
      )}

      {/* ---- Shipment ---- */}
      {order.shipment && (
        <section className="mb-10">
          <h2 className="mb-3 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400">
            Shipment
          </h2>
          <div className="border border-ivory-400 bg-ivory-50 p-4 text-sm">
            <p className="text-ink-900">{order.shipment.courierName}</p>
            {order.shipment.trackingNumber && (
              <p className="mt-1 text-ink-500">
                {order.shipment.trackingNumber}
              </p>
            )}
          </div>
        </section>
      )}

      {/* ---- History ---- */}
      <section className="mb-10">
        <h2 className="mb-3 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400">
          History
        </h2>
        <ol className="border border-ivory-400 bg-ivory-50">
          {order.events.map((event) => (
            <li
              key={event.id}
              className="border-b border-ivory-300 px-4 py-3 last:border-b-0"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm text-ink-900">
                  {SUB_ORDER_STATUS_LABEL[event.toStatus] ?? event.toStatus}
                </p>
                <p className="text-xs text-ink-400">
                  {formatDateTime(event.createdAt)}
                </p>
              </div>
              {event.note && (
                <p className="mt-0.5 text-xs text-ink-500">{event.note}</p>
              )}
            </li>
          ))}
        </ol>
      </section>

      <ButtonLink
        href={`/seller/orders/${order.subOrderNumber}/packing-slip`}
        variant="secondary"
      >
        Packing slip &amp; invoice
      </ButtonLink>
    </div>
  );
}

function Row({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex justify-between gap-4 text-ink-500">
      <dt>
        {label}
        {hint && (
          <span className="mt-0.5 block text-xs text-ink-400">{hint}</span>
        )}
      </dt>
      <dd className="shrink-0">{value}</dd>
    </div>
  );
}
