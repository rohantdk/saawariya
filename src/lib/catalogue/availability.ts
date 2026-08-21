import { INVENTORY_STATUS } from "@/lib/constants";

/**
 * What a buyer can actually do with a listing right now — SRS §58.
 *
 * Handloom breaks the assumption a stock column encodes, which is that a thing
 * either exists or cannot be had. A weaver with an empty shelf and a free loom
 * can still take the order; what they owe in return is an honest lead time, not
 * a "Sold out" badge that sends the customer elsewhere for something the seller
 * would happily have made.
 *
 * So availability is derived here, once, and every surface — card, product page,
 * cart, checkout — reads the same answer. The states are deliberately few:
 *
 *   IN_STOCK      on the shelf, ships within the normal dispatch window
 *   LOW_STOCK     as above, but nearly gone
 *   MADE_TO_ORDER nothing on the shelf; it will be woven, and loomWeeks says how long
 *   SOLD_OUT      nothing on the shelf and no loom offered
 *   DISCONTINUED  not coming back
 *
 * Note the ordering rule: stock is always offered ahead of the loom. A listing
 * that is both stocked and made-to-order reads as IN_STOCK, because the buyer
 * who can have it this week should not be quoted eight weeks.
 */

export type AvailabilityState =
  | "IN_STOCK"
  | "LOW_STOCK"
  | "MADE_TO_ORDER"
  | "SOLD_OUT"
  | "DISCONTINUED";

export type AvailabilityInput = {
  isMadeToOrder: boolean;
  loomWeeks: number | null;
  inventory: { status: string; stockQty?: number } | null;
};

export type Availability = {
  state: AvailabilityState;
  /** True when an order can be placed at all. */
  isPurchasable: boolean;
  /** True when the wait is weeks at the loom rather than the dispatch window. */
  isOnTheLoom: boolean;
  loomWeeks: number | null;
  /** Short label for a badge. */
  label: string;
  /** One sentence for the product page and the cart. */
  detail: string;
};

export function availabilityOf(product: AvailabilityInput): Availability {
  const status = product.inventory?.status ?? INVENTORY_STATUS.OUT_OF_STOCK;

  // Discontinued outranks everything: the loom is not being set up again.
  if (status === INVENTORY_STATUS.DISCONTINUED) {
    return {
      state: "DISCONTINUED",
      isPurchasable: false,
      isOnTheLoom: false,
      loomWeeks: null,
      label: "Discontinued",
      detail: "This piece has been discontinued and is not being woven again.",
    };
  }

  if (status === INVENTORY_STATUS.IN_STOCK || status === INVENTORY_STATUS.LOW_STOCK) {
    const low = status === INVENTORY_STATUS.LOW_STOCK;
    return {
      state: low ? "LOW_STOCK" : "IN_STOCK",
      isPurchasable: true,
      isOnTheLoom: false,
      loomWeeks: null,
      label: low ? "Low stock" : "In stock",
      detail: low
        ? "Only a few left on the shelf."
        : "In stock and ready to dispatch.",
    };
  }

  // Out of stock. The loom is the only remaining route.
  if (product.isMadeToOrder && product.loomWeeks && product.loomWeeks > 0) {
    return {
      state: "MADE_TO_ORDER",
      isPurchasable: true,
      isOnTheLoom: true,
      loomWeeks: product.loomWeeks,
      label: "On the loom",
      detail: `Woven to order. Expect roughly ${weeksLabel(product.loomWeeks)} on the loom before it is dispatched.`,
    };
  }

  return {
    state: "SOLD_OUT",
    isPurchasable: false,
    isOnTheLoom: false,
    loomWeeks: null,
    label: "Sold out",
    detail: "This piece is sold out.",
  };
}

/**
 * A made-to-order listing that still has stock. The buy panel shows this as a
 * secondary note — the buyer takes the stocked piece, and is told the same
 * weaver will make another rather than being left to assume this is the last.
 */
export function loomNoteFor(
  product: AvailabilityInput,
  availability: Availability,
): string | null {
  if (!product.isMadeToOrder || !product.loomWeeks) return null;
  if (availability.isOnTheLoom || !availability.isPurchasable) return null;
  return `Also woven to order — allow about ${weeksLabel(product.loomWeeks)} for a commissioned piece.`;
}

export function weeksLabel(weeks: number): string {
  return weeks === 1 ? "1 week" : `${weeks} weeks`;
}
