import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  assertTransition,
  type Transition,
} from "@/lib/order-state-machine";
import type { Permission } from "@/lib/auth/permissions";
import { deriveInventoryStatus } from "@/lib/inventory-status";
import { deriveOrderStatus } from "@/lib/fulfilment/order-rollup";
import { recomputeProductSales } from "@/lib/catalogue/sales";
import {
  ORDER_STATUS,
  SOLD_SUB_ORDER_STATUSES,
  SUB_ORDER_STATUS,
} from "@/lib/constants";

/**
 * Performing a sub-order transition — the shared mechanics.
 *
 * `src/lib/order-state-machine.ts` answers *whether* a move is legal. This
 * module *makes* it, and it is deliberately separate from the seller, admin and
 * operations action modules because the same six things have to happen every
 * time, whoever is acting:
 *
 *   1. the move is re-checked against the state machine,
 *   2. the sub-order status changes,
 *   3. the denormalised pipeline timestamp for that status is stamped,
 *   4. an `OrderEvent` records who moved it and from what,
 *   5. the stock ledger is moved — see `applyStockEffect` below,
 *   6. the parent `Order` status is recomputed from all its sub-orders.
 *
 * Phase 5 had all of this inline in the seller action, which was correct while
 * exactly one panel could move an order. Phase 6 added admin override and
 * Phase 7 adds three operations panels; three more copies of step 5 is three
 * more chances for a cancelled order to hold its stock forever.
 *
 * **Ownership is not checked here.** Like the state machine, this module never
 * sees a seller id — the caller loads the sub-order with its own `where` scope
 * and passes the row in. Callers must do both.
 */

/** Everything a transition needs to know about the row it is moving. */
export type TransitionableSubOrder = {
  id: string;
  subOrderNumber: string;
  status: string;
  orderId: string;
  order: { orderNumber: string; customer: { userId: string } };
  items: { productId: string; quantity: number; productName: string }[];
};

export type TransitionActor = {
  userId: string;
  /** Written to `OrderEvent.actorRole` — the role code, e.g. SELLER, WAREHOUSE. */
  role: string;
  permissions: readonly Permission[];
};

/**
 * Re-exported so existing callers keep one import. The rule itself lives in a
 * pure module because `prisma/seed/` and `prisma/seed-check.ts` need it and
 * cannot import anything that reaches for `prisma`.
 */
export { deriveOrderStatus };

/** Timestamp columns the pipeline denormalises, keyed by the status reached. */
const TIMESTAMP_FOR: Record<string, string> = {
  [SUB_ORDER_STATUS.CONFIRMED]: "confirmedAt",
  [SUB_ORDER_STATUS.PICKED]: "pickedAt",
  [SUB_ORDER_STATUS.QC_PASSED]: "qcAt",
  [SUB_ORDER_STATUS.PACKING]: "packedAt",
  [SUB_ORDER_STATUS.DISPATCHED]: "dispatchedAt",
  [SUB_ORDER_STATUS.DELIVERED]: "deliveredAt",
};

/**
 * Which transitions the customer hears about — SRS §112.
 *
 * Not all of them, deliberately. A customer is shown five collapsed tracking
 * stages rather than the fourteen pipeline states (see
 * `src/lib/commerce/order-status.ts`), so notifying on PICKING, QC_PENDING and
 * PACKING would send three messages about one stage that never changed on their
 * screen. These six are the moves where what the customer sees actually moves.
 */
function customerNotification(
  to: string,
  subOrder: TransitionableSubOrder,
): { title: string; body: string } | null {
  const { orderNumber } = subOrder.order;

  switch (to) {
    case SUB_ORDER_STATUS.CONFIRMED:
      return {
        title: `Order ${orderNumber} confirmed`,
        body: "The seller has confirmed your order. It is on its way to our warehouse to be prepared.",
      };
    case SUB_ORDER_STATUS.DISPATCHED:
      return {
        title: `Order ${orderNumber} dispatched`,
        body: "Your parcel is with the courier and on its way.",
      };
    case SUB_ORDER_STATUS.OUT_FOR_DELIVERY:
      return {
        title: `Order ${orderNumber} is out for delivery`,
        body: "Your parcel is out with the courier and should arrive today.",
      };
    case SUB_ORDER_STATUS.DELIVERED:
      return {
        title: `Order ${orderNumber} delivered`,
        body: "Your order has been delivered. We would love to hear what you think of it.",
      };
    case SUB_ORDER_STATUS.CANCELLED:
      return {
        title: `Order ${orderNumber} could not be fulfilled`,
        body: `${subOrder.items
          .map((item) => item.productName)
          .join(", ")} is no longer available from this seller. Any payment for it will be refunded.`,
      };
    case SUB_ORDER_STATUS.RETURNED:
      return {
        title: `Return for ${orderNumber} completed`,
        body: "We have received your return. Any refund due will follow shortly.",
      };
    default:
      return null;
  }
}

/**
 * What reaching a status does to the stock the order is holding.
 *
 * Three of the eighteen states move stock, and each moves it differently:
 *
 * - **CANCELLED** releases the reservation. No units move — the goods were
 *   held, never shipped — so the ledger records a zero-quantity release. Without
 *   it the units stay reserved forever, because nothing will ever revisit a
 *   cancelled sub-order, and the catalogue would slowly report itself sold out.
 * - **DISPATCHED** is where the goods physically leave. The reservation ends
 *   *and* `stockQty` falls, because the units are now with a courier rather than
 *   on a shelf. This was the gap Phase 7 found: nothing at runtime consumed a
 *   reservation, so before this every dispatched parcel held its stock forever
 *   while `stockQty` never moved. The seed already assumed otherwise — its
 *   `recomputeReservations` excludes everything from DISPATCHED onward — so the
 *   seeded database and a running one disagreed about the same order.
 * - **RETURNED** puts the units back. The reservation is long gone by then, so
 *   this is a pure inward movement.
 *
 * Everything else leaves stock alone, including the whole QC loop: a failed
 * inspection does not cancel the order, it re-picks, and the reservation is
 * exactly what should still be holding those units.
 */
const STOCK_EFFECT: Record<
  string,
  { reservation: number; onHand: number; reason: string; verb: string }
> = {
  [SUB_ORDER_STATUS.CANCELLED]: {
    reservation: -1,
    onHand: 0,
    reason: "ORDER_CANCELLED",
    verb: "released",
  },
  [SUB_ORDER_STATUS.DISPATCHED]: {
    reservation: -1,
    onHand: -1,
    reason: "ORDER_DISPATCHED",
    verb: "dispatched",
  },
  [SUB_ORDER_STATUS.RETURNED]: {
    reservation: 0,
    onHand: 1,
    reason: "RETURN_RESTOCK",
    verb: "returned to stock",
  },
};

/**
 * True when a move takes a parcel into or out of the set that counts as sold.
 *
 * `DELIVERED → RETURN_REQUESTED` is not a crossing: the customer still has the
 * goods while the support desk decides, so the sale stands until the parcel is
 * actually back.
 */
function crossesSoldBoundary(from: string, to: string): boolean {
  return SOLD_SUB_ORDER_STATUSES.includes(from) !== SOLD_SUB_ORDER_STATUSES.includes(to);
}

async function applyStockEffect(
  tx: Prisma.TransactionClient,
  subOrder: TransitionableSubOrder,
  to: string,
  actor: TransitionActor,
): Promise<void> {
  const effect = STOCK_EFFECT[to];
  if (!effect) return;

  for (const item of subOrder.items) {
    const inventory = await tx.inventory.findUnique({
      where: { productId: item.productId },
      select: {
        id: true,
        stockQty: true,
        reservedQty: true,
        lowStockThreshold: true,
        status: true,
      },
    });
    if (!inventory) continue;

    // Clamp both at zero. A negative reservation corrupts availability for
    // every other customer, and negative stock is a number no screen can
    // present honestly — either is worse than the drift it came from.
    const reservedQty = Math.max(
      0,
      inventory.reservedQty + effect.reservation * item.quantity,
    );
    const stockQty = Math.max(
      0,
      inventory.stockQty + effect.onHand * item.quantity,
    );

    await tx.inventory.update({
      where: { id: inventory.id },
      data: {
        reservedQty,
        stockQty,
        status: deriveInventoryStatus(
          stockQty,
          inventory.lowStockThreshold,
          inventory.status,
        ),
      },
    });

    await tx.stockMovement.create({
      data: {
        inventoryId: inventory.id,
        // The ledger records units that moved in or out. A cancellation moves
        // none — it only ends a hold — so its row is a zero, present so the
        // reservation drop is still traceable.
        changeQty: effect.onHand * item.quantity,
        reason: effect.reason,
        referenceId: subOrder.id,
        note: `${item.quantity} ${effect.verb} — ${subOrder.subOrderNumber} by ${actor.role.toLowerCase().replace(/_/g, " ")}`,
      },
    });
  }
}

export type TransitionResult =
  | { ok: true; transition: Transition; orderStatus: string }
  | { ok: false; error: string };

/**
 * Work that must happen in the same transaction as the move.
 *
 * The QC verdict and the courier handover both produce a record that must not
 * exist without the transition, and must not be missing when it happened: an
 * order sitting in QC_FAILED with no `QcInspection` cannot tell anyone what
 * failed, and a DISPATCHED sub-order with no `Shipment` has no tracking number
 * for the customer. Same reasoning as `writeAudit` taking a client.
 *
 * It runs *after* the status change, so a hook may read the row it just moved.
 * Throwing from it rolls the whole move back.
 */
export type TransitionSideEffect = (
  tx: Prisma.TransactionClient,
) => Promise<void>;

export async function performSubOrderTransition(
  subOrder: TransitionableSubOrder,
  to: string,
  actor: TransitionActor,
  note?: string,
  sideEffect?: TransitionSideEffect,
): Promise<TransitionResult> {
  // The one gate. Rejects both an illegal move and a legal move this actor may
  // not make — a seller cannot reach PICKING however they craft the request,
  // because picking requires WAREHOUSE_PROCESS.
  const check = assertTransition(subOrder.status, to, actor.permissions);
  if (!check.ok) return { ok: false, error: check.error };

  const { transition } = check;
  const now = new Date();
  const timestampField = TIMESTAMP_FOR[to];

  const orderStatus = await prisma.$transaction(async (tx) => {
    await tx.subOrder.update({
      where: { id: subOrder.id },
      data: {
        status: to,
        ...(timestampField ? { [timestampField]: now } : {}),
      },
    });

    await tx.orderEvent.create({
      data: {
        orderId: subOrder.orderId,
        subOrderId: subOrder.id,
        fromStatus: subOrder.status,
        toStatus: to,
        actorUserId: actor.userId,
        actorRole: actor.role,
        note: note || transition.event,
      },
    });

    await applyStockEffect(tx, subOrder, to, actor);

    // ---- Best-seller counters ----------------------------------------------
    // Only when the move crosses the sold/not-sold line, so a routine picking
    // scan does not run an aggregate over every line in the parcel. Delivering
    // adds the units; a return takes them back off.
    if (crossesSoldBoundary(subOrder.status, to)) {
      await recomputeProductSales(
        tx,
        subOrder.items.map((item) => item.productId),
      );
    }

    // ---- Whatever this particular move also produces ------------------------
    // The QC inspection, the shipment. Runs inside the transaction so the
    // record and the move it explains cannot exist without each other.
    if (sideEffect) await sideEffect(tx);

    // ---- Recompute the parent order ----------------------------------------
    const siblings = await tx.subOrder.findMany({
      where: { orderId: subOrder.orderId },
      select: { status: true },
    });

    const derived = deriveOrderStatus(siblings.map((s) => s.status));
    await tx.order.update({
      where: { id: subOrder.orderId },
      data: {
        status: derived,
        ...(derived === ORDER_STATUS.CANCELLED ? { cancelledAt: now } : {}),
      },
    });

    // ---- Tell the customer, if this is a move they can see ------------------
    const message = customerNotification(to, subOrder);
    if (message) {
      await tx.notification.create({
        data: {
          userId: subOrder.order.customer.userId,
          title: message.title,
          body: message.body,
          category: "ORDER",
          linkUrl: `/account/orders/${subOrder.order.orderNumber}`,
        },
      });
    }

    return derived;
  });

  return { ok: true, transition, orderStatus };
}

/** The projection `performSubOrderTransition` needs. Callers add their scope. */
export const TRANSITIONABLE_SELECT = {
  id: true,
  subOrderNumber: true,
  status: true,
  orderId: true,
  order: {
    select: { orderNumber: true, customer: { select: { userId: true } } },
  },
  items: { select: { productId: true, quantity: true, productName: true } },
} as const;
