/**
 * Order money maths. Pure — no database, no session — so it can be reasoned
 * about and reused by the cart summary, the checkout summary and the order
 * that actually gets written. Those three disagreeing is the classic e-commerce
 * bug, and the only defence is that there is exactly one implementation.
 *
 * Everything is integer PAISE. See the note in src/lib/utils.ts.
 */

import type { CommerceSettings } from "@/lib/commerce/settings";

export type AppliedCoupon = {
  code: string;
  discountType: "PERCENTAGE" | "FIXED" | "FREE_SHIPPING";
  discountValue: number;
  maxDiscount: number | null;
};

export type OrderTotals = {
  subtotal: number;
  discountAmount: number;
  shippingAmount: number;
  /**
   * GST. When `pricesIncludeGst` is true this is the tax *contained in* the
   * amount charged, not an addition to it — the product page tells shoppers
   * "inclusive of all taxes", so adding GST on top at checkout would charge
   * them 5% more than the price they were quoted.
   */
  taxAmount: number;
  taxIsIncluded: boolean;
  totalAmount: number;
  /** How much more to spend to cross the free-shipping line; 0 once crossed. */
  freeShippingShortfall: number;
};

export function computeDiscount(
  subtotal: number,
  coupon: AppliedCoupon | null,
): number {
  if (!coupon) return 0;

  switch (coupon.discountType) {
    case "PERCENTAGE": {
      const raw = Math.round((subtotal * coupon.discountValue) / 100);
      return Math.min(
        coupon.maxDiscount ?? Number.MAX_SAFE_INTEGER,
        raw,
        subtotal,
      );
    }
    case "FIXED":
      return Math.min(coupon.discountValue, subtotal);
    // A free-shipping coupon reduces shipping, never the goods.
    case "FREE_SHIPPING":
      return 0;
  }
}

export function computeTotals(
  subtotal: number,
  coupon: AppliedCoupon | null,
  settings: CommerceSettings,
): OrderTotals {
  const discountAmount = computeDiscount(subtotal, coupon);
  const goods = subtotal - discountAmount;

  // The threshold is tested against what the customer actually pays for goods,
  // not the pre-discount subtotal: a coupon that drops the basket below the
  // free-shipping line should cost them the shipping.
  const qualifiesFree = goods >= settings.freeShippingThresholdPaise;
  const shippingAmount =
    coupon?.discountType === "FREE_SHIPPING" || qualifiesFree
      ? 0
      : settings.flatShippingPaise;

  const taxAmount = settings.pricesIncludeGst
    ? extractGst(goods, settings.gstPercent)
    : Math.round((goods * settings.gstPercent) / 100);

  const totalAmount = settings.pricesIncludeGst
    ? goods + shippingAmount
    : goods + shippingAmount + taxAmount;

  return {
    subtotal,
    discountAmount,
    shippingAmount,
    taxAmount,
    taxIsIncluded: settings.pricesIncludeGst,
    totalAmount,
    freeShippingShortfall: qualifiesFree
      ? 0
      : Math.max(0, settings.freeShippingThresholdPaise - goods),
  };
}

/** The GST component already inside a tax-inclusive amount. */
export function extractGst(inclusiveAmount: number, gstPercent: number): number {
  if (gstPercent <= 0) return 0;
  return Math.round((inclusiveAmount * gstPercent) / (100 + gstPercent));
}

/**
 * Split an order-level amount across sub-orders in proportion to their weights.
 *
 * Shipping is charged once for the whole order but a SubOrder carries its own
 * `shippingAmount`, because seller settlement (SRS §119) works off the
 * SubOrder. Naive rounding leaves the parts summing to one or two paise off the
 * order total, which is exactly the drift the integer-paise rule exists to
 * prevent — so this uses largest-remainder and the parts always sum to `total`.
 */
export function apportion(total: number, weights: number[]): number[] {
  if (weights.length === 0) return [];
  if (total === 0) return weights.map(() => 0);

  const weightSum = weights.reduce((sum, w) => sum + w, 0);

  // Nothing to weight by (a zero-value order): spread it evenly instead.
  if (weightSum <= 0) {
    const base = Math.floor(total / weights.length);
    const parts = weights.map(() => base);
    let remainder = total - base * weights.length;
    for (let i = 0; remainder > 0; i++, remainder--) parts[i] += 1;
    return parts;
  }

  const exact = weights.map((w) => (total * w) / weightSum);
  const parts = exact.map(Math.floor);
  let remainder = total - parts.reduce((sum, p) => sum + p, 0);

  // Hand the leftover paise to whoever was rounded down hardest.
  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction);

  for (let i = 0; remainder > 0; i = (i + 1) % order.length, remainder--) {
    parts[order[i].index] += 1;
  }

  return parts;
}
