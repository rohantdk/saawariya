import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Info, MapPin, Store } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatPaise } from "@/lib/utils";
import { requireCustomer } from "@/lib/commerce/context";
import { getCart } from "@/lib/commerce/cart";
import { getCommerceSettings } from "@/lib/commerce/settings";
import { getOfferableCoupons, validateCoupon } from "@/lib/commerce/coupons";
import { computeTotals, type AppliedCoupon } from "@/lib/commerce/totals";
import { PAYMENT_METHOD, PAYMENT_METHOD_LABEL } from "@/lib/constants";
import { AddressForm } from "@/components/commerce/address-form";
import { CouponForm } from "@/components/commerce/coupon-form";
import { OrderSummary } from "@/components/commerce/order-summary";
import { PlaceOrderForm } from "@/components/commerce/place-order-form";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

const FORM_ID = "checkout";

/**
 * Checkout — SRS §43, §44.
 *
 * The address and payment controls live in the left column but belong to the
 * submit button in the right one; they are joined with the HTML `form`
 * attribute rather than by nesting, so the page can keep a two-column layout
 * and still host the "add an address" form without nesting forms.
 *
 * There is no payment gateway in this build and the page says so rather than
 * imitating one. A convincing fake card form would be the one screen here that
 * lies about what the software does.
 */
export default async function CheckoutPage(props: PageProps<"/checkout">) {
  const [customer, searchParams, settings] = await Promise.all([
    requireCustomer("/checkout"),
    props.searchParams,
    getCommerceSettings(),
  ]);

  const cart = await getCart(customer.customerId, customer.tier);

  // Nothing to check out, or something in the bag is now unbuyable: both are
  // decided on the bag page, which can explain them.
  if (cart.lines.length === 0 || !cart.isCheckoutable) {
    redirect("/cart");
  }

  const requestedCoupon =
    typeof searchParams.coupon === "string" ? searchParams.coupon : null;

  let coupon: AppliedCoupon | null = null;
  let couponError: string | null = null;
  let couponDiscount = 0;

  if (requestedCoupon) {
    const check = await validateCoupon(requestedCoupon, {
      customerId: customer.customerId,
      customerType: customer.customerType,
      subtotal: cart.subtotal,
    });
    if (check.ok) {
      coupon = check.coupon;
      couponDiscount = check.discount;
    } else {
      couponError = check.error;
    }
  }

  const totals = computeTotals(cart.subtotal, coupon, settings);

  const [addresses, offers] = await Promise.all([
    prisma.address.findMany({
      where: { userId: customer.userId },
      orderBy: [{ isDefaultShipping: "desc" }, { createdAt: "asc" }],
    }),
    getOfferableCoupons(customer.customerType),
  ]);

  const defaultShipping =
    addresses.find((a) => a.isDefaultShipping) ?? addresses[0] ?? null;
  const defaultBilling = addresses.find((a) => a.isDefaultBilling) ?? null;

  const codAvailable =
    settings.codEnabled && totals.totalAmount <= settings.codMaxOrderPaise;

  // A fresh key per render. Two submits of the same rendered page carry the
  // same key, and Payment.idempotencyKey is UNIQUE — so the second one cannot
  // become a second order. See src/lib/commerce/place-order.ts.
  const idempotencyKey = crypto.randomUUID();

  return (
    <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
      <p className="eyebrow mb-3">Step 2 of 2</p>
      <h1 className="font-display text-3xl sm:text-4xl">Checkout</h1>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_22rem] lg:gap-12">
        <div className="space-y-10">
          {/* ---- 1. Delivery address ---- */}
          <section>
            <SectionTitle step={1} title="Delivery address" />

            {addresses.length === 0 ? (
              <div className="rounded-md border border-ivory-400 bg-ivory-50 p-6">
                <p className="mb-5 text-sm text-ink-400">
                  Add the address you would like this order delivered to.
                </p>
                <AddressForm submitLabel="Save and continue" />
              </div>
            ) : (
              <>
                <ul className="space-y-3">
                  {addresses.map((address) => (
                    <li key={address.id}>
                      <label className="flex cursor-pointer gap-3.5 rounded-md border border-ivory-400 bg-ivory-50 p-4 transition-colors hover:border-ink-400 has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50">
                        <input
                          type="radio"
                          name="addressId"
                          value={address.id}
                          form={FORM_ID}
                          defaultChecked={address.id === defaultShipping?.id}
                          required
                          className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-brand-600)]"
                        />
                        <span className="min-w-0 text-sm">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-ink-900">
                              {address.fullName}
                            </span>
                            <span className="rounded-md border border-ivory-400 px-1.5 py-0.5 text-[0.625rem] uppercase tracking-[0.1em] text-ink-400">
                              {address.label}
                            </span>
                          </span>
                          <span className="mt-1 block leading-relaxed text-ink-400">
                            {[
                              address.line1,
                              address.line2,
                              address.landmark,
                              address.city,
                              address.state,
                              address.pinCode,
                            ]
                              .filter(Boolean)
                              .join(", ")}
                          </span>
                          <span className="mt-1 block text-xs text-ink-400">
                            {address.mobile}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>

                {/* <details> keeps this closed by default without any client
                    state, and it is outside the checkout form, so the address
                    form inside it is not a nested form. */}
                <details className="group mt-4 rounded-md border border-ivory-400 bg-ivory-50">
                  <summary className="flex cursor-pointer items-center gap-2 p-4 text-xs font-medium uppercase tracking-[0.14em] text-ink-900 transition-colors hover:text-brand-600">
                    <MapPin aria-hidden="true" className="h-4 w-4" />
                    Deliver somewhere else
                  </summary>
                  <div className="border-t border-ivory-400 p-5">
                    <AddressForm showDefaults={false} />
                  </div>
                </details>

                <div className="mt-5">
                  <label
                    htmlFor="billingAddressId"
                    className="mb-2 block text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400"
                  >
                    Billing address
                  </label>
                  <select
                    id="billingAddressId"
                    name="billingAddressId"
                    form={FORM_ID}
                    defaultValue={defaultBilling?.id ?? ""}
                    className="rounded-md w-full border border-ivory-400 bg-ivory-50 px-4 py-3 text-sm text-ink-900 focus:border-brand-600 focus:outline-none"
                  >
                    {/* An empty value means "same as delivery" — one control,
                        no JavaScript, and nothing to hide or reveal. */}
                    <option value="">Same as the delivery address</option>
                    {addresses.map((address) => (
                      <option key={address.id} value={address.id}>
                        {address.label} — {address.line1}, {address.city}{" "}
                        {address.pinCode}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </section>

          {/* ---- 2. Payment ---- */}
          <section>
            <SectionTitle step={2} title="Payment" />

            <div
              role="note"
              className="mb-4 flex items-start gap-2.5 rounded-md border border-info/30 bg-info-soft p-4 text-sm leading-relaxed text-info"
            >
              <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <strong className="font-medium">Demonstration build.</strong>{" "}
                No payment gateway is connected. Choosing an online method
                records a successful payment with a clearly synthetic reference
                so the finance and settlement screens have real data to work
                with. No card details are collected anywhere in this
                application.
              </span>
            </div>

            <ul className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(PAYMENT_METHOD_LABEL) as Array<
                keyof typeof PAYMENT_METHOD_LABEL
              >).map((method) => {
                const isCod = method === PAYMENT_METHOD.COD;
                const unavailable = isCod && !codAvailable;

                return (
                  <li key={method}>
                    <label
                      className={
                        unavailable
                          ? "flex cursor-not-allowed gap-3 rounded-md border border-ivory-400 bg-ivory-100 p-4 opacity-60"
                          : "flex cursor-pointer gap-3 rounded-md border border-ivory-400 bg-ivory-50 p-4 transition-colors hover:border-ink-400 has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50"
                      }
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={method}
                        form={FORM_ID}
                        disabled={unavailable}
                        defaultChecked={method === PAYMENT_METHOD.UPI}
                        required
                        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-brand-600)]"
                      />
                      <span className="text-sm">
                        <span className="block text-ink-900">
                          {PAYMENT_METHOD_LABEL[method]}
                        </span>
                        {isCod && (
                          <span className="mt-0.5 block text-xs text-ink-400">
                            {codAvailable
                              ? "Pay the courier on delivery."
                              : `Not available above ${formatPaise(settings.codMaxOrderPaise)}.`}
                          </span>
                        )}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* ---- 3. Review ---- */}
          <section>
            <SectionTitle step={3} title="Review your order" />

            {cart.groups.map((group) => (
              <div
                key={group.sellerId}
                className="mb-4 rounded-md border border-ivory-400 bg-ivory-50 px-5"
              >
                <p className="flex items-center gap-2 border-b border-ivory-400 py-3.5 text-xs text-ink-400">
                  <Store aria-hidden="true" className="h-3.5 w-3.5" />
                  {group.businessName}
                  {cart.groups.length > 1 && " · ships separately"}
                </p>

                <ul className="divide-y divide-ivory-300">
                  {group.lines.map((line) => (
                    <li key={line.id} className="flex gap-4 py-4">
                      <div className="relative aspect-[3/4] w-14 shrink-0 overflow-hidden bg-ivory-200">
                        {line.imageUrl && (
                          <Image
                            src={line.imageUrl}
                            alt={line.imageAlt}
                            fill
                            sizes="56px"
                            className="object-cover"
                          />
                        )}
                      </div>
                      <div className="flex min-w-0 flex-1 justify-between gap-4">
                        <div className="min-w-0">
                          <Link
                            href={`/product/${line.slug}`}
                            className="text-sm text-ink-900 hover:text-brand-600"
                          >
                            {line.name}
                          </Link>
                          <p className="mt-1 text-xs text-ink-400">
                            {line.variantLabel ? `${line.variantLabel} · ` : ""}
                            Qty {line.quantity}
                          </p>
                        </div>
                        <p className="shrink-0 text-sm tabular-nums text-ink-900">
                          {formatPaise(line.lineTotal)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <Link
              href="/cart"
              className="text-xs font-medium uppercase tracking-[0.14em] text-ink-400 transition-colors hover:text-brand-600"
            >
              ← Edit your bag
            </Link>
          </section>
        </div>

        {/* ---- Summary ---- */}
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="mb-5">
            <CouponForm
              action="/checkout"
              appliedCode={coupon?.code ?? requestedCoupon}
              discount={couponDiscount}
              error={couponError}
              offers={offers}
            />
          </div>

          <OrderSummary
            totals={totals}
            couponCode={coupon?.code ?? null}
            itemCount={cart.itemCount}
          >
            <PlaceOrderForm
              formId={FORM_ID}
              idempotencyKey={idempotencyKey}
              couponCode={coupon?.code ?? null}
              totalAmount={totals.totalAmount}
              disabled={addresses.length === 0}
              disabledReason="Add a delivery address to place your order."
            />
          </OrderSummary>
        </aside>
      </div>
    </div>
  );
}

function SectionTitle({ step, title }: { step: number; title: string }) {
  return (
    <h2 className="mb-4 flex items-center gap-3 font-display text-xl">
      <span
        aria-hidden="true"
        className="flex h-7 w-7 items-center justify-center rounded-full border border-ivory-400 text-xs text-ink-400"
      >
        {step}
      </span>
      {title}
    </h2>
  );
}
