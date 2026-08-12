import { RETURN_STATUS, SUB_ORDER_STATUS } from "@/lib/constants";

/**
 * What the support desk may do to a return, given where the parcel actually is.
 *
 * Pure, with no database import, for the reason this build has learned twice the
 * hard way: a Client Component importing a value from a `server-only` module
 * pulls `better-sqlite3` into the browser bundle, and only `next build` catches
 * it. `src/lib/support/returns.ts` re-exports this so a page keeps one import.
 *
 * **Not a plain transition table**, because the legal moves depend on *two*
 * rows: the return's own status and the sub-order's. Completing a return is what
 * restocks the goods — `performSubOrderTransition` has owned that since
 * Phase 7 — so it is only offered once the parcel is genuinely back. Offering it
 * while the goods are still in a customer's cupboard would add units to a shelf
 * that does not have them, which is precisely the class of drift the stock
 * ledger exists to prevent.
 *
 * Two rows describe one return and they are deliberately not merged.
 * `ReturnRequest` holds the customer's reason and the desk's decision;
 * `SubOrder.status` holds where the parcel physically is. Approving a return
 * does not move goods, so the two must be able to disagree.
 */

export type ReturnDecision = {
  to: string;
  label: string;
  requiresNote: boolean;
  primary?: boolean;
  /** Set when this decision also moves the sub-order through the pipeline. */
  subOrderTo?: string;
};

export function returnDecisions(request: {
  status: string;
  subOrder: { status: string };
}): ReturnDecision[] {
  const parcelInFlight =
    request.subOrder.status === SUB_ORDER_STATUS.RETURN_REQUESTED;

  switch (request.status) {
    case RETURN_STATUS.REQUESTED:
      return [
        {
          to: RETURN_STATUS.APPROVED,
          label: "Approve the return",
          requiresNote: false,
          primary: true,
        },
        {
          to: RETURN_STATUS.REJECTED,
          label: "Reject",
          requiresNote: true,
          // Rejecting puts the parcel back where it was: the customer keeps the
          // goods and the order is delivered again.
          subOrderTo: parcelInFlight ? SUB_ORDER_STATUS.DELIVERED : undefined,
        },
      ];

    case RETURN_STATUS.APPROVED:
      return [
        {
          to: RETURN_STATUS.PICKUP_SCHEDULED,
          label: "Pickup arranged",
          requiresNote: false,
          primary: true,
        },
        {
          to: RETURN_STATUS.REJECTED,
          label: "Reject after all",
          requiresNote: true,
          subOrderTo: parcelInFlight ? SUB_ORDER_STATUS.DELIVERED : undefined,
        },
      ];

    case RETURN_STATUS.PICKUP_SCHEDULED:
      return [
        {
          to: RETURN_STATUS.RECEIVED,
          label: "Received at the warehouse",
          requiresNote: false,
          primary: true,
        },
      ];

    case RETURN_STATUS.RECEIVED:
      return [
        {
          to: RETURN_STATUS.REFUNDED,
          label: "Complete and refund",
          requiresNote: false,
          primary: true,
          // The move that restocks the units and raises the refund.
          subOrderTo: parcelInFlight ? SUB_ORDER_STATUS.RETURNED : undefined,
        },
      ];

    default:
      return [];
  }
}

export function returnDecisionFor(
  request: { status: string; subOrder: { status: string } },
  to: string,
): ReturnDecision | null {
  return returnDecisions(request).find((move) => move.to === to) ?? null;
}
