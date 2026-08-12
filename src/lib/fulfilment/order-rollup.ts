import { ORDER_STATUS, SUB_ORDER_STATUS } from "@/lib/constants";

/**
 * The parent Order's status, derived from its sub-orders.
 *
 * `Order.status` is a summary, never a separate source of truth — a two-seller
 * order with one parcel dispatched and one still packing is PARTIALLY_SHIPPED,
 * and no single sub-order knows that. Recomputing it from the parts is the only
 * way the summary cannot drift from what it summarises.
 *
 * Pure module with no database or `server-only` import, so `prisma/seed/` and
 * `prisma/seed-check.ts` can use it too. That is the point of splitting it out
 * of `transition.ts` in Phase 7: the seed writes `Order.status` and its
 * sub-orders' statuses from two different places in its plan, and nothing was
 * checking that the pair agreed with the rule the *running* software would
 * apply. Same reasoning as `deriveInventoryStatus` — one rule, one place.
 */
export function deriveOrderStatus(statuses: string[]): string {
  const live = statuses.filter((s) => s !== SUB_ORDER_STATUS.CANCELLED);

  // Every part cancelled — so is the order.
  if (live.length === 0) return ORDER_STATUS.CANCELLED;

  const every = (predicate: (s: string) => boolean) => live.every(predicate);
  const some = (predicate: (s: string) => boolean) => live.some(predicate);

  if (every((s) => s === SUB_ORDER_STATUS.RETURNED)) return ORDER_STATUS.RETURNED;
  if (every((s) => s === SUB_ORDER_STATUS.DELIVERED))
    return ORDER_STATUS.DELIVERED;

  const dispatched = [
    SUB_ORDER_STATUS.DISPATCHED,
    SUB_ORDER_STATUS.IN_TRANSIT,
    SUB_ORDER_STATUS.OUT_FOR_DELIVERY,
    SUB_ORDER_STATUS.DELIVERED,
    SUB_ORDER_STATUS.RETURN_REQUESTED,
    SUB_ORDER_STATUS.RETURNED,
  ] as string[];

  if (every((s) => dispatched.includes(s))) return ORDER_STATUS.SHIPPED;
  if (some((s) => dispatched.includes(s))) return ORDER_STATUS.PARTIALLY_SHIPPED;

  // Nothing has left the building. If any part has been accepted, the order is
  // being worked on; if none has, it is still waiting on a seller.
  if (some((s) => s !== SUB_ORDER_STATUS.PLACED)) return ORDER_STATUS.PROCESSING;
  return ORDER_STATUS.PENDING;
}
