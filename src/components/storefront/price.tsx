import { cn } from "@/lib/utils";
import { formatPaise } from "@/lib/utils";
import type { ResolvedPrice } from "@/lib/catalogue/pricing";

/**
 * Renders a price already decided by resolvePrice(). This component never
 * chooses between retail and wholesale itself — that branch lives in exactly
 * one place (src/lib/catalogue/pricing.ts) so the cart cannot disagree with the
 * card that led to it.
 */
export function Price({
  price,
  size = "md",
  className,
}: {
  price: ResolvedPrice;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const amountSize = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-2xl",
  }[size];

  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-1", className)}>
      <span className={cn("font-display text-ink-900", amountSize)}>
        {formatPaise(price.amount)}
      </span>

      {price.compareAt !== null && (
        <>
          <span className="text-xs text-ink-400 line-through">
            {formatPaise(price.compareAt)}
          </span>
          {price.discountPercent > 0 && (
            <span className="text-xs font-medium text-brand-600">
              {price.discountPercent}% off
            </span>
          )}
        </>
      )}
    </div>
  );
}

/** The MOQ / trade-price qualifier that has to sit next to a wholesale price. */
export function TradePriceNote({ price }: { price: ResolvedPrice }) {
  if (!price.isTradePrice) return null;

  return (
    <p className="mt-1 text-xs text-ink-400">
      Trade price
      {/* Only state a minimum where one exists — "minimum 1" is not a
          constraint, and printing it makes every product look restricted. */}
      {price.minOrderQty > 1 && ` · minimum ${price.minOrderQty} units`}
    </p>
  );
}

/**
 * Shown to retail viewers on products that also carry a wholesale price — the
 * hook into the B2B side of the marketplace (SRS §14). Deliberately states the
 * requirement rather than teasing a number a visitor cannot act on.
 */
export function WholesaleTeaser({
  hasWholesalePrice,
  minOrderQty,
}: {
  hasWholesalePrice: boolean;
  minOrderQty: number;
}) {
  if (!hasWholesalePrice) return null;

  return (
    <p className="text-xs text-ink-400">
      {/* "from 1 unit" is not a minimum, it is the absence of one — saying it
          makes the MOQ read like a restriction where there isn't one. */}
      {minOrderQty > 1
        ? `Trade pricing available from ${minOrderQty} units`
        : "Trade pricing available"}{" "}
      for{" "}
      <a
        href="/register?type=wholesale"
        className="text-brand-600 underline underline-offset-2"
      >
        verified business accounts
      </a>
    </p>
  );
}
