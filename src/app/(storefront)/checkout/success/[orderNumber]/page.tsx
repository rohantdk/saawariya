import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Package, Truck } from "lucide-react";
import { formatDate, formatPaise } from "@/lib/utils";
import { requireCustomer } from "@/lib/commerce/context";
import { getCustomerOrder } from "@/lib/commerce/orders";
import { getCommerceSettings } from "@/lib/commerce/settings";
import { PAYMENT_METHOD_LABEL, type PaymentMethod } from "@/lib/constants";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Order confirmed",
  robots: { index: false, follow: false },
};

/**
 * Order confirmation — SRS §45.
 *
 * Reads the order back out of the database rather than being handed totals
 * through the redirect. What the customer is shown here is therefore exactly
 * what was written, which is the only version worth confirming: a summary
 * assembled from the form they just submitted would agree with itself even if
 * the order had been stored wrongly.
 */
export default async function OrderSuccessPage(
  props: PageProps<"/checkout/success/[orderNumber]">,
) {
  const [{ orderNumber }, customer, settings] = await Promise.all([
    props.params,
    requireCustomer(),
    getCommerceSettings(),
  ]);

  const order = await getCustomerOrder(customer.customerId, orderNumber);
  if (!order) notFound();

  const payment = order.payments[0] ?? null;
  const isCod = payment?.method === "COD";

  const dispatchBy = new Date(order.placedAt);
  dispatchBy.setDate(dispatchBy.getDate() + settings.dispatchDays);

  return (
    <div className="mx-auto max-w-3xl px-5 py-14 lg:px-8">
      <div className="text-center">
        <span
          aria-hidden="true"
          className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-success-soft text-success"
        >
          <Check className="h-7 w-7" />
        </span>

        <h1 className="font-display text-3xl sm:text-4xl">
          Thank you — your order is confirmed
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-ink-400">
          Order{" "}
          <span className="font-medium text-ink-900">{order.orderNumber}</span>{" "}
          was placed on {formatDate(order.placedAt)}. We have sent a
          confirmation to your notifications, and we will tell you as soon as it
          is dispatched.
        </p>
      </div>

      {/* ---- What happens next ---- */}
      <ol className="mt-10 grid gap-3 sm:grid-cols-3">
        <NextStep
          icon={<Check className="h-4 w-4" />}
          title="Confirmed"
          detail={
            isCod
              ? `Payment of ${formatPaise(order.totalAmount)} is due on delivery.`
              : `Payment of ${formatPaise(order.totalAmount)} received.`
          }
          done
        />
        <NextStep
          icon={<Package className="h-4 w-4" />}
          title="Being prepared"
          detail={`Dispatch expected by ${formatDate(dispatchBy)}.`}
        />
        <NextStep
          icon={<Truck className="h-4 w-4" />}
          title="On its way"
          detail="You will get a tracking number for each parcel."
        />
      </ol>

      {/* ---- Parcels ---- */}
      <section className="mt-10">
        <h2 className="mb-3 font-display text-xl">
          {order.subOrders.length === 1
            ? "Your parcel"
            : `Your ${order.subOrders.length} parcels`}
        </h2>
        {order.subOrders.length > 1 && (
          <p className="mb-4 text-sm leading-relaxed text-ink-400">
            Your order is being fulfilled by {order.subOrders.length} sellers,
            so it arrives as {order.subOrders.length} separate parcels — each
            with its own tracking.
          </p>
        )}

        <div className="space-y-4">
          {order.subOrders.map((subOrder) => (
            <div
              key={subOrder.id}
              className="border border-ivory-400 bg-ivory-50 px-5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-ivory-400 py-3.5">
                <p className="text-sm text-ink-900">
                  {subOrder.seller.businessName}
                </p>
                <p className="text-xs text-ink-400">{subOrder.subOrderNumber}</p>
              </div>

              <ul className="divide-y divide-ivory-300">
                {subOrder.items.map((item) => (
                  <li key={item.id} className="flex gap-4 py-4">
                    <div className="relative aspect-[3/4] w-12 shrink-0 overflow-hidden bg-ivory-200">
                      {item.imageUrl && (
                        <Image
                          src={item.imageUrl}
                          alt={item.productName}
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm text-ink-900">
                          {item.productName}
                        </p>
                        <p className="mt-0.5 text-xs text-ink-400">
                          Qty {item.quantity} · {formatPaise(item.unitPrice)}{" "}
                          each
                        </p>
                      </div>
                      <p className="shrink-0 text-sm tabular-nums text-ink-900">
                        {formatPaise(item.lineTotal)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ---- Money and address ---- */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <section className="border border-ivory-400 bg-ivory-50 p-5">
          <h2 className="mb-3 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400">
            Payment
          </h2>
          <dl className="space-y-2 text-sm">
            <Row label="Subtotal" value={formatPaise(order.subtotal)} />
            {order.discountAmount > 0 && (
              <Row
                label={order.couponCode ? `Discount · ${order.couponCode}` : "Discount"}
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
            <p className="mt-3 border-t border-ivory-300 pt-3 text-xs text-ink-400">
              {PAYMENT_METHOD_LABEL[payment.method as PaymentMethod]}
              {payment.gatewayRef && ` · ${payment.gatewayRef}`}
              {isCod && " · due on delivery"}
            </p>
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
        </section>
      </div>

      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <ButtonLink href={`/account/orders/${order.orderNumber}`}>
          Track this order
        </ButtonLink>
        <ButtonLink href="/shop" variant="secondary">
          Continue shopping
        </ButtonLink>
      </div>

      <p className="mt-6 text-center text-xs text-ink-400">
        Need help?{" "}
        <Link
          href="/account/support"
          className="text-brand-600 underline underline-offset-2"
        >
          Raise a support request
        </Link>{" "}
        or email {settings.supportEmail}.
      </p>
    </div>
  );
}

function NextStep({
  icon,
  title,
  detail,
  done,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  done?: boolean;
}) {
  return (
    <li className="border border-ivory-400 bg-ivory-50 p-4">
      <p
        className={
          done
            ? "flex items-center gap-2 text-sm text-success"
            : "flex items-center gap-2 text-sm text-ink-400"
        }
      >
        <span aria-hidden="true">{icon}</span>
        {title}
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-ink-400">{detail}</p>
    </li>
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
