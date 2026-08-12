import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  performSubOrderTransition,
  TRANSITIONABLE_SELECT,
  type TransitionActor,
  type TransitionSideEffect,
} from "@/lib/fulfilment/transition";

/**
 * The move-plus-record shape all three operations desks share.
 *
 * This lives in `src/lib/operations/` rather than beside the Server Actions
 * deliberately: **every export of a `"use server"` module is a public HTTP
 * endpoint**, so a shared helper exported from one would be directly callable
 * with no authentication in front of it. Helpers belong on this side of the
 * line; only the checked entry points belong on that one.
 */

/**
 * Every screen a pipeline move changes.
 *
 * A single parcel appears in five places — three operations desks, the seller's
 * order list and the customer's tracking page — and the whole point of deriving
 * `Order.status` from its sub-orders is that they never disagree. Revalidating
 * four of the five is how a stale page becomes a support ticket.
 */
export function revalidatePipeline(
  subOrderNumber: string,
  orderNumber: string,
): void {
  for (const desk of ["warehouse", "qc", "logistics"]) {
    revalidatePath(`/operations/${desk}`);
    revalidatePath(`/operations/${desk}/queue`);
    revalidatePath(`/operations/${desk}/queue/${subOrderNumber}`);
  }

  revalidatePath("/seller/orders");
  revalidatePath(`/seller/orders/${subOrderNumber}`);
  // Stock moves on a dispatch, a cancellation and a shortage report, so the
  // seller's stock screen is downstream of a pipeline move too.
  revalidatePath("/seller/inventory");
  revalidatePath("/operations/warehouse/inventory");
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderNumber}`);
  revalidatePath(`/account/orders/${orderNumber}`);
}

export type DeskMoveResult =
  | {
      ok: true;
      subOrderNumber: string;
      orderNumber: string;
      orderStatus: string;
    }
  | { ok: false; error: string };

/**
 * Load the parcel, move it, attach the record that explains the move.
 *
 * The side effect runs *inside* the transaction the move runs in, so a failed
 * write rolls the status change back with it. That ordering is the whole reason
 * this is one function rather than three copies: a DISPATCHED parcel with no
 * `Shipment` has no tracking number to give the customer, and a `QC_FAILED` one
 * with no `QcInspection` cannot say what was wrong with it.
 *
 * **No ownership scope here either.** Operations works on every seller's goods,
 * so the `where` is the sub-order id alone — see the note at the top of
 * `src/lib/operations/queues.ts` for what does the scoping instead.
 */
export async function performDeskMove(options: {
  subOrderId: string;
  to: string;
  actor: TransitionActor;
  note?: string;
  sideEffect?: (
    tx: Parameters<TransitionSideEffect>[0],
    subOrder: { id: string; subOrderNumber: string; status: string },
  ) => Promise<void>;
}): Promise<DeskMoveResult> {
  const subOrder = await prisma.subOrder.findUnique({
    where: { id: options.subOrderId },
    select: TRANSITIONABLE_SELECT,
  });
  if (!subOrder) return { ok: false, error: "Order not found." };

  const result = await performSubOrderTransition(
    subOrder,
    options.to,
    options.actor,
    options.note,
    options.sideEffect
      ? (tx) => options.sideEffect!(tx, subOrder)
      : undefined,
  );
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePipeline(subOrder.subOrderNumber, subOrder.order.orderNumber);

  return {
    ok: true,
    subOrderNumber: subOrder.subOrderNumber,
    orderNumber: subOrder.order.orderNumber,
    orderStatus: result.orderStatus,
  };
}
