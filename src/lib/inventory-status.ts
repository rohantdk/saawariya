import { INVENTORY_STATUS, type InventoryStatus } from "@/lib/constants";

/**
 * `Inventory.status` derived from the quantity on hand — SRS §60, §98.
 *
 * Pure module with no database or `server-only` import, so the seed can use it
 * too. That matters: the status was previously derived by a hard-coded
 * `<= 5` inside `prisma/seed/products.ts` while the threshold is a per-product
 * column, which meant a seller raising their own threshold to 20 would not see
 * "low stock" until it hit 5. One rule, one place.
 *
 * DISCONTINUED is deliberately *not* derived. It is a decision a person makes
 * about a product's future, not a fact about its current quantity, so a restock
 * must never quietly resurrect a discontinued line.
 */
export function deriveInventoryStatus(
  stockQty: number,
  lowStockThreshold: number,
  currentStatus?: string | null,
): InventoryStatus {
  if (currentStatus === INVENTORY_STATUS.DISCONTINUED) {
    return INVENTORY_STATUS.DISCONTINUED;
  }
  if (stockQty <= 0) return INVENTORY_STATUS.OUT_OF_STOCK;
  if (stockQty <= lowStockThreshold) return INVENTORY_STATUS.LOW_STOCK;
  return INVENTORY_STATUS.IN_STOCK;
}

/**
 * What a customer can actually buy right now.
 *
 * Stock held by paid-but-undispatched orders is not available, which is the
 * whole reason `reservedQty` exists — see the note in src/lib/commerce/cart.ts.
 * A seller looking at their inventory screen needs the same number the
 * storefront is enforcing, or the two will appear to disagree.
 */
export function availableQty(inventory: {
  stockQty: number;
  reservedQty: number;
}): number {
  return Math.max(0, inventory.stockQty - inventory.reservedQty);
}
