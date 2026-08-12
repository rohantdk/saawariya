/**
 * The SubOrder fulfilment pipeline — legal transitions and who may make them.
 *
 * `prisma/schema.prisma` has pointed at this file since Phase 0; Phase 5 is the
 * first phase that actually *moves* a sub-order, so this is where it lands.
 *
 * ## The fulfilment model this encodes
 *
 * The SRS contradicts itself about who fulfils an order — §61 has the seller
 * packing and marking "Ready for Pickup", §93–95 has a platform warehouse
 * picking and packing. This build implements **§93–95, the platform warehouse**:
 *
 *   seller confirms  ->  platform warehouse picks, QCs and packs  ->  logistics
 *
 * So `CONFIRMED` is the *handover* point, which is why it is labelled "Confirmed
 * by seller". A seller never picks, packs or dispatches; once they confirm, the
 * sub-order belongs to operations until it is delivered. A pure-marketplace
 * flow is a subset of this one (let a seller skip the warehouse states), which
 * is why this direction was the safe default to pick.
 *
 * ## Why transitions are gated on permissions, not roles
 *
 * `SUPER_ADMIN` holds every permission by construction, so a permission-keyed
 * table lets an admin unstick any sub-order without listing them on eighteen
 * separate transitions and without a magic "is admin" branch that later has to
 * be kept in sync.
 *
 * ## What this module is not
 *
 * It is pure — no database, no session. It answers "is this move legal, and does
 * this permission set allow it", nothing else. **Ownership is not checked here**:
 * that a seller only confirms *their own* sub-order is a `where` clause at the
 * call site, because this module never sees a seller id. Callers must do both.
 */

import {
  SUB_ORDER_STATUS as S,
  type SubOrderStatus,
} from "@/lib/constants";
import { PERMISSIONS, type Permission } from "@/lib/auth/permissions";

export type TransitionActor =
  | "SELLER"
  | "WAREHOUSE"
  | "QC"
  | "LOGISTICS"
  | "SUPPORT"
  | "CUSTOMER";

export type Transition = {
  to: SubOrderStatus;
  /** The permission a caller must hold. */
  permission: Permission;
  /** Who this move is *for* — drives the wording of buttons and errors. */
  actor: TransitionActor;
  /** Imperative label for the button that performs it. */
  label: string;
  /** Written into the OrderEvent note when no custom note is supplied. */
  event: string;
};

/**
 * Every legal move out of every state.
 *
 * Ordering within an array matters only for presentation: the first entry is
 * the "happy path" move and panels render it as the primary action.
 */
export const TRANSITIONS: Record<SubOrderStatus, Transition[]> = {
  // --- Seller's half: accept the order, or decline it -----------------------
  [S.PLACED]: [
    {
      to: S.CONFIRMED,
      permission: PERMISSIONS.ORDER_UPDATE_STATUS,
      actor: "SELLER",
      label: "Confirm order",
      event: "Seller confirmed the order and released stock to the warehouse",
    },
    {
      to: S.CANCELLED,
      permission: PERMISSIONS.ORDER_UPDATE_STATUS,
      actor: "SELLER",
      label: "Decline order",
      event: "Seller declined the order",
    },
  ],

  /**
   * Confirmation is the handover, and it stops there deliberately: the seller
   * moves PLACED -> CONFIRMED, and the *warehouse* pulls CONFIRMED work into its
   * own queue. Auto-advancing to WAREHOUSE_QUEUE on the seller's click would
   * record the warehouse as having accepted something nobody there had seen, and
   * the inbound queue is exactly the list of orders in CONFIRMED waiting to be
   * pulled. The seeded data holds rows in both states for that reason.
   */
  [S.CONFIRMED]: [
    {
      to: S.WAREHOUSE_QUEUE,
      permission: PERMISSIONS.WAREHOUSE_PROCESS,
      actor: "WAREHOUSE",
      label: "Send to warehouse queue",
      event: "Queued for picking",
    },
    {
      to: S.CANCELLED,
      permission: PERMISSIONS.ORDER_UPDATE_STATUS,
      actor: "SELLER",
      label: "Cancel",
      event: "Cancelled before picking",
    },
  ],

  // --- Platform warehouse: pick ---------------------------------------------
  [S.WAREHOUSE_QUEUE]: [
    {
      to: S.PICKING,
      permission: PERMISSIONS.WAREHOUSE_PROCESS,
      actor: "WAREHOUSE",
      label: "Start picking",
      event: "Picking started",
    },
    {
      to: S.CANCELLED,
      permission: PERMISSIONS.ORDER_UPDATE_STATUS,
      actor: "SUPPORT",
      label: "Cancel",
      event: "Cancelled in the warehouse queue",
    },
  ],

  /**
   * Picking is where a shortage is actually discovered, so it needs an exit.
   *
   * Without the cancel below a warehouse that cannot find the stock is stuck:
   * `PICKED` asserts a quantity nobody has, and no admin override could rescue
   * it either, because `assertTransition` refuses any move this table does not
   * list. The neighbouring WAREHOUSE_QUEUE and RETURNED_TO_WAREHOUSE states
   * both already carry one; PICKING was simply missing it.
   */
  [S.PICKING]: [
    {
      to: S.PICKED,
      permission: PERMISSIONS.WAREHOUSE_PROCESS,
      actor: "WAREHOUSE",
      label: "Mark picked",
      event: "All items picked",
    },
    {
      to: S.CANCELLED,
      permission: PERMISSIONS.ORDER_UPDATE_STATUS,
      actor: "WAREHOUSE",
      label: "Cancel — stock short",
      event: "Cancelled: the stock could not be picked",
    },
  ],

  [S.PICKED]: [
    {
      to: S.QC_PENDING,
      permission: PERMISSIONS.WAREHOUSE_PROCESS,
      actor: "WAREHOUSE",
      label: "Send for quality check",
      event: "Handed to quality control",
    },
  ],

  // --- Quality control -------------------------------------------------------
  [S.QC_PENDING]: [
    {
      to: S.QC_PASSED,
      permission: PERMISSIONS.QC_INSPECT,
      actor: "QC",
      label: "Pass inspection",
      event: "Passed quality inspection",
    },
    {
      to: S.QC_FAILED,
      permission: PERMISSIONS.QC_INSPECT,
      actor: "QC",
      label: "Fail inspection",
      event: "Failed quality inspection",
    },
  ],

  [S.QC_PASSED]: [
    {
      to: S.PACKING,
      permission: PERMISSIONS.PACKAGING_PROCESS,
      actor: "WAREHOUSE",
      label: "Start packing",
      event: "Packing started",
    },
  ],

  /**
   * A failed inspection does not cancel the order — the warehouse re-picks
   * replacement stock and it goes round again. That loop is the reason
   * QC_FAILED and RETURNED_TO_WAREHOUSE both collapse to "Being prepared" for
   * the customer (see src/lib/commerce/order-status.ts).
   */
  [S.QC_FAILED]: [
    {
      to: S.RETURNED_TO_WAREHOUSE,
      permission: PERMISSIONS.QC_INSPECT,
      actor: "QC",
      label: "Return to warehouse",
      event: "Returned to the warehouse after a failed inspection",
    },
  ],

  [S.RETURNED_TO_WAREHOUSE]: [
    {
      to: S.PICKING,
      permission: PERMISSIONS.WAREHOUSE_PROCESS,
      actor: "WAREHOUSE",
      label: "Re-pick",
      event: "Re-picking replacement stock",
    },
    {
      to: S.CANCELLED,
      permission: PERMISSIONS.ORDER_UPDATE_STATUS,
      actor: "SUPPORT",
      label: "Cancel — cannot fulfil",
      event: "Cancelled: replacement stock unavailable",
    },
  ],

  // --- Packing and dispatch --------------------------------------------------
  [S.PACKING]: [
    {
      to: S.READY_FOR_DISPATCH,
      permission: PERMISSIONS.PACKAGING_PROCESS,
      actor: "WAREHOUSE",
      label: "Mark ready for dispatch",
      event: "Packed and ready for dispatch",
    },
  ],

  [S.READY_FOR_DISPATCH]: [
    {
      to: S.DISPATCHED,
      permission: PERMISSIONS.LOGISTICS_SHIP,
      actor: "LOGISTICS",
      label: "Dispatch",
      event: "Handed to the courier",
    },
  ],

  [S.DISPATCHED]: [
    {
      to: S.IN_TRANSIT,
      permission: PERMISSIONS.LOGISTICS_SHIP,
      actor: "LOGISTICS",
      label: "Mark in transit",
      event: "In transit",
    },
  ],

  [S.IN_TRANSIT]: [
    {
      to: S.OUT_FOR_DELIVERY,
      permission: PERMISSIONS.LOGISTICS_SHIP,
      actor: "LOGISTICS",
      label: "Mark out for delivery",
      event: "Out for delivery",
    },
  ],

  [S.OUT_FOR_DELIVERY]: [
    {
      to: S.DELIVERED,
      permission: PERMISSIONS.LOGISTICS_SHIP,
      actor: "LOGISTICS",
      label: "Mark delivered",
      event: "Delivered",
    },
  ],

  // --- After delivery --------------------------------------------------------
  [S.DELIVERED]: [
    {
      to: S.RETURN_REQUESTED,
      permission: PERMISSIONS.ORDER_CANCEL_OWN,
      actor: "CUSTOMER",
      label: "Request a return",
      event: "Customer requested a return",
    },
  ],

  [S.RETURN_REQUESTED]: [
    {
      to: S.RETURNED,
      permission: PERMISSIONS.RETURN_PROCESS,
      actor: "SUPPORT",
      label: "Complete return",
      event: "Return received and completed",
    },
    {
      to: S.DELIVERED,
      permission: PERMISSIONS.RETURN_PROCESS,
      actor: "SUPPORT",
      label: "Reject return",
      event: "Return request rejected",
    },
  ],

  // --- Terminal --------------------------------------------------------------
  [S.CANCELLED]: [],
  [S.RETURNED]: [],
};

/**
 * States with no legal move left at all. Derived from the table rather than
 * listed separately, so the two cannot drift apart.
 *
 * **Not the same thing as `SUB_ORDER_TERMINAL` in
 * `src/lib/commerce/order-status.ts`**, and the difference matters: that list
 * means "nothing further will happen unless a person acts" and therefore
 * includes `DELIVERED`. This one means "the state machine has no exit", and
 * `DELIVERED` is *not* in it because a customer can still request a return.
 * Use this one to decide whether to draw controls; use that one to decide
 * whether an order is still moving on its own.
 */
export const CLOSED_STATUSES: SubOrderStatus[] = (
  Object.keys(TRANSITIONS) as SubOrderStatus[]
).filter((status) => TRANSITIONS[status].length === 0);

export function isClosed(status: string): boolean {
  return TRANSITIONS[status as SubOrderStatus]?.length === 0;
}

/**
 * Stock is physically gone once the courier has it. Before that a cancellation
 * releases the reservation; after it, the only route back is a return. Used by
 * the seller and operations panels to decide whether to offer a cancel button.
 */
const POST_DISPATCH: SubOrderStatus[] = [
  S.DISPATCHED,
  S.IN_TRANSIT,
  S.OUT_FOR_DELIVERY,
  S.DELIVERED,
  S.RETURN_REQUESTED,
  S.RETURNED,
];

export function isCancellable(status: string): boolean {
  return (
    !isClosed(status) && !POST_DISPATCH.includes(status as SubOrderStatus)
  );
}

/** Every legal move out of `status`, regardless of who is asking. */
export function transitionsFrom(status: string): Transition[] {
  return TRANSITIONS[status as SubOrderStatus] ?? [];
}

/**
 * The moves a caller holding `permissions` may actually perform.
 *
 * Panels render buttons from this, so an unauthorised action is never drawn in
 * the first place — but `assertTransition` still re-checks on submit, because a
 * button that is not drawn is not a control.
 */
export function availableTransitions(
  status: string,
  permissions: readonly Permission[],
): Transition[] {
  return transitionsFrom(status).filter((t) =>
    permissions.includes(t.permission),
  );
}

/** Look up one specific move. Returns null when it is not legal from `status`. */
export function findTransition(
  status: string,
  to: string,
): Transition | null {
  return transitionsFrom(status).find((t) => t.to === to) ?? null;
}

export type TransitionCheck =
  | { ok: true; transition: Transition }
  | { ok: false; error: string };

/**
 * The one gate every mutation must pass through.
 *
 * Returns a result rather than throwing: these are called from Server Actions,
 * which have to report a problem back to the form rather than blow up. The two
 * failure modes are deliberately worded differently — "cannot move from X to Y"
 * is a stale page, "you do not have permission" is an authorisation problem, and
 * conflating them makes both harder to diagnose.
 */
export function assertTransition(
  from: string,
  to: string,
  permissions: readonly Permission[],
): TransitionCheck {
  const transition = findTransition(from, to);

  if (!transition) {
    return {
      ok: false,
      error: isClosed(from)
        ? `This order is ${from.toLowerCase().replace(/_/g, " ")} and can no longer be changed.`
        : `An order cannot move from ${from.replace(/_/g, " ").toLowerCase()} to ${to.replace(/_/g, " ").toLowerCase()}.`,
    };
  }

  if (!permissions.includes(transition.permission)) {
    return { ok: false, error: "You do not have permission to do that." };
  }

  return { ok: true, transition };
}
