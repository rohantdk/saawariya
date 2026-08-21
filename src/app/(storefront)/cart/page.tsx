import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ShoppingBag, Store } from "lucide-react";
import { formatPaise } from "@/lib/utils";
import { requireCustomer } from "@/lib/commerce/context";
import { getCart } from "@/lib/commerce/cart";
import { getCommerceSettings } from "@/lib/commerce/settings";
import { longestLoomWeeks } from "@/lib/commerce/dispatch";
import { getOfferableCoupons, validateCoupon } from "@/lib/commerce/coupons";
import { computeTotals, type AppliedCoupon } from "@/lib/commerce/totals";
import { CartLine } from "@/components/commerce/cart-line";
import { CouponForm } from "@/components/commerce/coupon-form";
import { OrderSummary } from "@/components/commerce/order-summary";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Your bag",
  // A bag is per-customer and never a search result.
  robots: { index: false, follow: false },
};

/**
 * The bag — SRS §42.
 *
 * Lines are grouped by seller because that grouping becomes the SubOrders when
 * the order is placed. Showing it here means a customer buying from three
 * weavers is not surprised by three separate parcels and three tracking
 * numbers after they have paid.
 */
export default async function CartPage(props: PageProps<"/cart">) {
  const [customer, searchParams, settings] = await Promise.all([
    requireCustomer("/cart"),
    props.searchParams,
    getCommerceSettings(),
  ]);

  const cart = await getCart(customer.customerId, customer.tier);

  const requestedCoupon =
    typeof searchParams.coupon === "string" ? searchParams.coupon : null;

  let coupon: AppliedCoupon | null = null;
  let couponError: string | null = null;
  let couponDiscount = 0;

  if (requestedCoupon && cart.lines.length > 0) {
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
  const offers = await getOfferableCoupons(customer.customerType);

  if (cart.lines.length === 0) return <EmptyBag />;

  // Carry a valid coupon through to checkout; never carry a rejected one.
  const checkoutHref = coupon
    ? `/checkout?coupon=${encodeURIComponent(coupon.code)}`
    : "/checkout";

  return (
    <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
      <p className="eyebrow mb-3">Step 1 of 2</p>
      <h1 className="font-display text-3xl sm:text-4xl">Your bag</h1>
      <p className="mt-2 text-sm text-ink-400">
        {cart.itemCount} item{cart.itemCount === 1 ? "" : "s"}
        {cart.groups.length > 1 &&
          ` from ${cart.groups.length} sellers — they will arrive as ${cart.groups.length} separate parcels`}
      </p>

      {cart.issueCount > 0 && (
        <div
          role="alert"
          className="mt-6 flex items-start gap-2.5 border border-danger/30 bg-danger-soft p-4 text-sm text-danger"
        >
          <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {cart.issueCount === 1
              ? "One item needs attention before you can check out."
              : `${cart.issueCount} items need attention before you can check out.`}
          </p>
        </div>
      )}

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_22rem] lg:gap-12">
        {/* ---- Lines, grouped by seller ---- */}
        <div>
          {cart.groups.map((group) => (
            <section
              key={group.sellerId}
              className="mb-8 border border-ivory-400 bg-ivory-50 px-5 sm:px-6"
            >
              <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-ivory-400 py-4">
                <h2 className="flex items-center gap-2 text-sm text-ink-900">
                  <Store aria-hidden="true" className="h-4 w-4 text-ink-400" />
                  {group.businessName}
                </h2>
                <p className="text-xs text-ink-400">
                  {group.city ? `${group.city}, ${group.state} · ` : ""}
                  {formatPaise(group.subtotal)}
                </p>
              </header>

              <ul className="divide-y divide-ivory-300">
                {group.lines.map((line) => (
                  <CartLine key={line.id} line={line} />
                ))}
              </ul>
            </section>
          ))}

          <Link
            href="/shop"
            className="text-xs font-medium uppercase tracking-[0.14em] text-ink-400 transition-colors hover:text-brand-600"
          >
            ← Continue shopping
          </Link>
        </div>

        {/* ---- Summary ---- */}
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="mb-5">
            <CouponForm
              action="/cart"
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
            {cart.isCheckoutable ? (
              <ButtonLink href={checkoutHref} size="lg" className="w-full">
                Proceed to checkout
              </ButtonLink>
            ) : (
              <>
                <button
                  type="button"
                  disabled
                  className="w-full cursor-not-allowed bg-brand-600/50 px-8 py-4 text-sm font-medium uppercase tracking-[0.16em] text-cream"
                >
                  Proceed to checkout
                </button>
                <p className="mt-2.5 text-center text-xs text-ink-400">
                  Resolve the items flagged above to continue.
                </p>
              </>
            )}

            <p className="mt-4 text-center text-xs leading-relaxed text-ink-400">
              {settings.pricesIncludeGst
                ? `Prices include GST at ${settings.gstPercent}%.`
                : `GST at ${settings.gstPercent}% is added at checkout.`}{" "}
              {/* The flat dispatch window only holds for a bag of stocked
                  goods. With a commission in it, quoting two days here and the
                  real lead time only on the confirmation page would be a
                  promise made and then withdrawn. */}
              {longestLoomWeeks(cart.lines)
                ? `Stocked pieces are dispatched within ${settings.dispatchDays} working days; commissioned pieces follow their own lead time, shown on each line.`
                : `Dispatched within ${settings.dispatchDays} working days.`}
            </p>
          </OrderSummary>
        </aside>
      </div>
    </div>
  );
}

function EmptyBag() {
  return (
    <div className="mx-auto max-w-md px-5 py-24 text-center lg:px-8">
      <span
        aria-hidden="true"
        className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-ivory-200 text-ink-400"
      >
        <ShoppingBag className="h-6 w-6" />
      </span>
      <h1 className="font-display text-3xl">Your bag is empty</h1>
      <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-ink-400">
        Nothing here yet. Our weavers have been busy — start with the new
        arrivals, or browse the collections.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/shop">Browse the shop</ButtonLink>
        <ButtonLink href="/account/wishlist" variant="secondary">
          View wishlist
        </ButtonLink>
      </div>
    </div>
  );
}
