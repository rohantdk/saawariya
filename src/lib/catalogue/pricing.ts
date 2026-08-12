import { PRICE_TIER, type PriceTier } from "@/lib/constants";

/**
 * The one place a price is decided.
 *
 * A product carries three prices — `priceRetail`, an optional `priceOffer` and
 * an optional `priceWholesale` — and which of them a person sees depends on
 * their account tier (SRS §14, §58). That branch is deliberately not inlined
 * into product cards: Phase 4 puts the same decision behind cart lines, order
 * totals and invoices, and two copies of it would eventually disagree. Cards
 * call `resolvePrice`, and so will the cart.
 *
 * Everything here is integer PAISE. No floats — see src/lib/utils.ts.
 */

/** The price columns any caller must supply. Matches a Prisma `Product` row. */
export type PriceInput = {
  priceRetail: number;
  priceOffer: number | null;
  priceWholesale: number | null;
  minOrderQty: number;
};

export type ResolvedPrice = {
  tier: PriceTier;
  /** What one unit costs at this tier, in paise. */
  amount: number;
  /**
   * The struck-through reference price, or null when there is nothing honest
   * to strike. Never a made-up "MRP".
   */
  compareAt: number | null;
  /** Whole percent saved against `compareAt`; 0 when there is no reduction. */
  discountPercent: number;
  /** Units that must be bought together. Always 1 at retail. */
  minOrderQty: number;
  /** True when this tier is only visible because the viewer is a trade account. */
  isTradePrice: boolean;
};

/**
 * The retail price a buyer actually pays, before tier.
 *
 * Denormalised onto `Product.priceEffective` so listings can sort and
 * range-filter on price inside the database rather than in memory. Any code
 * that writes a product price must run it through here — see the note on the
 * column in prisma/schema.prisma.
 */
export function effectiveRetailPaise(product: {
  priceRetail: number;
  priceOffer?: number | null;
}): number {
  const offer = product.priceOffer ?? null;
  // An "offer" above the retail price is a data error, not a discount.
  return offer !== null && offer > 0 && offer < product.priceRetail
    ? offer
    : product.priceRetail;
}

export function resolvePrice(
  product: PriceInput,
  tier: PriceTier = PRICE_TIER.RETAIL,
): ResolvedPrice {
  const retail = effectiveRetailPaise(product);

  // Wholesale falls back to retail rather than hiding the product: a trade
  // account looking at a product with no wholesale price should still be able
  // to buy it at the listed price.
  if (tier === PRICE_TIER.WHOLESALE && product.priceWholesale) {
    return {
      tier: PRICE_TIER.WHOLESALE,
      amount: product.priceWholesale,
      compareAt: product.priceRetail,
      discountPercent: percentOff(product.priceRetail, product.priceWholesale),
      minOrderQty: Math.max(1, product.minOrderQty),
      isTradePrice: true,
    };
  }

  return {
    tier: PRICE_TIER.RETAIL,
    amount: retail,
    compareAt: retail < product.priceRetail ? product.priceRetail : null,
    discountPercent: percentOff(product.priceRetail, retail),
    minOrderQty: 1,
    isTradePrice: false,
  };
}

/**
 * Which tier a viewer sees. Signed-out visitors and retail customers see
 * retail; only a customer record marked WHOLESALE sees trade pricing.
 * Staff roles have no customer record and so see retail, which is correct —
 * they are looking at the storefront as a shopper would.
 */
export function viewerTier(
  user: { customerType: string | null } | null,
): PriceTier {
  return user?.customerType === PRICE_TIER.WHOLESALE
    ? PRICE_TIER.WHOLESALE
    : PRICE_TIER.RETAIL;
}

function percentOff(original: number, paid: number): number {
  if (original <= 0 || paid >= original) return 0;
  return Math.round(((original - paid) / original) * 100);
}
