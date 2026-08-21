import Link from "next/link";
import { Tag, X } from "lucide-react";
import { formatPaise } from "@/lib/utils";
import { Input } from "@/components/ui/field";

/**
 * Applying a coupon is a GET, not a Server Action.
 *
 * The applied code lives in the query string — /cart?coupon=WELCOME10 — and
 * carries through to /checkout as a link. That follows the same reasoning as
 * the Phase 3 filter panel: there is no client state to fall out of step with
 * the server, the state survives a reload, it is shareable, and it works with
 * JavaScript off. It also means nothing has to store a "pending coupon" against
 * the customer, which would then need clearing when they abandon the basket.
 *
 * The code is re-validated on every render and again inside placeOrder, so a
 * hand-edited query string cannot buy anything cheaply.
 */
export function CouponForm({
  action,
  appliedCode,
  discount,
  error,
  offers,
}: {
  /** Path this form submits back to — /cart or /checkout. */
  action: string;
  appliedCode: string | null;
  discount: number;
  error: string | null;
  offers: {
    code: string;
    discountType: string;
    discountValue: number;
    minOrderValue: number;
  }[];
}) {
  if (appliedCode && !error) {
    return (
      <div className="rounded-md border border-success/30 bg-success-soft p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm text-success">
              <Tag aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              <span className="font-medium">{appliedCode}</span> applied
            </p>
            <p className="mt-1 text-xs text-success/80">
              {discount > 0
                ? `You saved ${formatPaise(discount)}.`
                : "Shipping is on us."}
            </p>
          </div>

          <Link
            href={action}
            aria-label={`Remove coupon ${appliedCode}`}
            className="shrink-0 p-1 text-success/70 transition-colors hover:text-success"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <form method="get" action={action} className="flex gap-2">
        <label htmlFor="coupon" className="sr-only">
          Coupon code
        </label>
        <Input
          id="coupon"
          name="coupon"
          defaultValue={appliedCode ?? ""}
          placeholder="Coupon code"
          autoCapitalize="characters"
          autoComplete="off"
          invalid={Boolean(error)}
          className="uppercase"
        />
        <button
          type="submit"
          className="rounded-md shrink-0 border border-ink-900/15 px-5 text-xs font-medium uppercase tracking-[0.14em] text-ink-900 transition-colors hover:border-ink-900/40 hover:bg-ivory-200"
        >
          Apply
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-2 text-xs text-danger">
          {error}
        </p>
      )}

      {offers.length > 0 && (
        <div className="mt-3">
          <p className="mb-2 text-[0.6875rem] uppercase tracking-[0.12em] text-ink-400">
            Available offers
          </p>
          <ul className="space-y-2">
            {offers.slice(0, 3).map((offer) => (
              <li key={offer.code}>
                <Link
                  href={`${action}?coupon=${offer.code}`}
                  className="group/offer flex items-center gap-2 text-xs text-ink-400 transition-colors hover:text-ink-900"
                >
                  <span className="rounded-md border border-brand-600 px-2 py-0.5 font-mono text-[0.6875rem] font-medium text-brand-600 transition-colors group-hover/offer:bg-brand-600 group-hover/offer:text-cream">
                    {offer.code}
                  </span>
                  {describeOffer(offer)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function describeOffer(offer: {
  discountType: string;
  discountValue: number;
  minOrderValue: number;
}): string {
  const benefit =
    offer.discountType === "PERCENTAGE"
      ? `${offer.discountValue}% off`
      : offer.discountType === "FIXED"
        ? `${formatPaise(offer.discountValue)} off`
        : "free shipping";

  return offer.minOrderValue > 0
    ? `${benefit} over ${formatPaise(offer.minOrderValue)}`
    : benefit;
}
