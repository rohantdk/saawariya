"use server";

import { prisma } from "@/lib/prisma";
import { requireOperationsAction } from "@/lib/operations/context";
import { performDeskMove, revalidatePipeline } from "@/lib/operations/pipeline";
import { trackingNumberFor } from "@/lib/operations/logistics";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  deliveryFailureSchema,
  dispatchSchema,
  trackingUpdateSchema,
} from "@/lib/validations/operations";
import { fieldErrors, type ActionState } from "@/lib/validations/commerce";
import {
  SHIPMENT_STATUS,
  SUB_ORDER_STATUS,
  type ShipmentStatus,
} from "@/lib/constants";

/**
 * The logistics desk — SRS §107-110.
 *
 * Two records move here and keeping them straight is the whole job.
 * `SubOrder.status` says where the *order* is; `Shipment.status` says where the
 * *parcel* is. They track each other on the happy path, and they deliberately
 * part company on a failed attempt: the shipment goes DELIVERY_FAILED with a
 * reason, the sub-order stays OUT_FOR_DELIVERY because the courier will try
 * again. Inventing a sub-order state for it would tell the customer their order
 * had gone backwards and would need a state-machine exit that leads nowhere.
 */

/** Sub-order status → the shipment status it implies. */
const SHIPMENT_STATUS_FOR: Record<string, ShipmentStatus> = {
  [SUB_ORDER_STATUS.DISPATCHED]: SHIPMENT_STATUS.PICKED_UP,
  [SUB_ORDER_STATUS.IN_TRANSIT]: SHIPMENT_STATUS.IN_TRANSIT,
  [SUB_ORDER_STATUS.OUT_FOR_DELIVERY]: SHIPMENT_STATUS.OUT_FOR_DELIVERY,
  [SUB_ORDER_STATUS.DELIVERED]: SHIPMENT_STATUS.DELIVERED,
};

/**
 * Handing a parcel to a courier — SRS §107, §108.
 *
 * The `Shipment` is created inside the transaction that moves the sub-order to
 * DISPATCHED, because a dispatched parcel with no tracking number is a customer
 * asking where their order is and nobody able to answer.
 *
 * This is also the move that consumes stock: `performSubOrderTransition` sees
 * DISPATCHED and takes the units off the shelf as well as off the reservation.
 * Before Phase 7 nothing did, so a dispatched parcel held its reservation
 * forever while `stockQty` never moved.
 */
export async function dispatchSubOrder(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireOperationsAction(PERMISSIONS.LOGISTICS_SHIP);
  if (!auth.ok) return { status: "error", message: auth.error };

  const parsed = dispatchSchema.safeParse({
    subOrderId: formData.get("subOrderId"),
    courierName: formData.get("courierName"),
    note: formData.get("note") ?? undefined,
  });
  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error) };
  }
  const input = parsed.data;

  const result = await performDeskMove({
    subOrderId: input.subOrderId,
    to: SUB_ORDER_STATUS.DISPATCHED,
    actor: {
      userId: auth.ops.userId,
      role: auth.ops.role,
      permissions: auth.ops.permissions,
    },
    note: `Handed to ${input.courierName}${input.note ? ` — ${input.note}` : ""}`,
    sideEffect: async (tx, subOrder) => {
      const trackingNumber = trackingNumberFor(
        input.courierName,
        subOrder.subOrderNumber,
      );
      const now = new Date();

      /**
       * `upsert`, not `create`. `Shipment.subOrderId` is unique, so a parcel
       * that came back to this desk — an admin override rewinding it, a courier
       * refusing the consignment — must reuse its row rather than fail on the
       * constraint after the status has already changed.
       */
      const shipment = await tx.shipment.upsert({
        where: { subOrderId: subOrder.id },
        create: {
          subOrderId: subOrder.id,
          courierName: input.courierName,
          trackingNumber,
          status: SHIPMENT_STATUS.PICKED_UP,
          dispatchedAt: now,
        },
        update: {
          courierName: input.courierName,
          trackingNumber,
          status: SHIPMENT_STATUS.PICKED_UP,
          failureReason: null,
          dispatchedAt: now,
        },
      });

      await tx.shipmentEvent.create({
        data: {
          shipmentId: shipment.id,
          status: SHIPMENT_STATUS.PICKED_UP,
          note: `Collected by ${input.courierName}. Tracking ${trackingNumber}.`,
        },
      });
    },
  });
  if (!result.ok) return { status: "error", message: result.error };

  return {
    status: "success",
    message: `${result.subOrderNumber} is with ${input.courierName}. Tracking ${trackingNumberFor(input.courierName, result.subOrderNumber)}.`,
  };
}

/**
 * Moving a parcel along its journey — SRS §109.
 *
 * One action for in-transit, out-for-delivery and delivered, because the three
 * do exactly the same thing: advance the sub-order, mirror it onto the shipment
 * and append a tracking event. Which of them the caller may perform is the
 * state machine's decision, not this function's.
 */
export async function updateTracking(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireOperationsAction(PERMISSIONS.LOGISTICS_SHIP);
  if (!auth.ok) return { status: "error", message: auth.error };

  const parsed = trackingUpdateSchema.safeParse({
    subOrderId: formData.get("subOrderId"),
    to: formData.get("to"),
    location: formData.get("location") ?? undefined,
    note: formData.get("note") ?? undefined,
  });
  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error) };
  }
  const input = parsed.data;

  const shipmentStatus = SHIPMENT_STATUS_FOR[input.to];
  const delivered = input.to === SUB_ORDER_STATUS.DELIVERED;

  const result = await performDeskMove({
    subOrderId: input.subOrderId,
    to: input.to,
    actor: {
      userId: auth.ops.userId,
      role: auth.ops.role,
      permissions: auth.ops.permissions,
    },
    note: input.note || (input.location ? `At ${input.location}` : undefined),
    sideEffect: async (tx, subOrder) => {
      // Nothing to mirror for a move that is not part of the courier journey —
      // an admin override, say. The sub-order still moves; the shipment simply
      // has nothing to say about it.
      if (!shipmentStatus) return;

      const shipment = await tx.shipment.findUnique({
        where: { subOrderId: subOrder.id },
        select: { id: true },
      });
      if (!shipment) return;

      await tx.shipment.update({
        where: { id: shipment.id },
        data: {
          status: shipmentStatus,
          // A parcel that is moving again is no longer a failed attempt.
          failureReason: null,
          ...(delivered ? { deliveredAt: new Date() } : {}),
        },
      });

      await tx.shipmentEvent.create({
        data: {
          shipmentId: shipment.id,
          status: shipmentStatus,
          location: input.location || null,
          note: input.note || null,
        },
      });
    },
  });
  if (!result.ok) return { status: "error", message: result.error };

  return {
    status: "success",
    message: delivered
      ? `${result.subOrderNumber} is delivered. The customer has been told.`
      : `${result.subOrderNumber} updated.`,
  };
}

/**
 * A failed delivery attempt — SRS §110.
 *
 * The one place the parcel and the order deliberately disagree. Nothing moves
 * on the sub-order: the courier will re-attempt, the customer's tracking page
 * still reads "out for delivery", and that is the truth. What changes is the
 * shipment — a status, a reason and a tracking event — so the desk has a list of
 * attempts to chase and the delivery report has a denominator.
 *
 * Because no transition happens, this cannot go through `performDeskMove`: it
 * writes to `Shipment` alone. That is also why it re-checks the sub-order's
 * status itself — there is no state machine underneath to refuse a failure
 * recorded against a parcel that was never out for delivery.
 */
export async function recordFailedDelivery(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireOperationsAction(PERMISSIONS.LOGISTICS_SHIP);
  if (!auth.ok) return { status: "error", message: auth.error };

  const parsed = deliveryFailureSchema.safeParse({
    subOrderId: formData.get("subOrderId"),
    reason: formData.get("reason"),
    location: formData.get("location") ?? undefined,
    note: formData.get("note") ?? undefined,
  });
  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error) };
  }
  const input = parsed.data;

  const subOrder = await prisma.subOrder.findUnique({
    where: { id: input.subOrderId },
    select: {
      id: true,
      subOrderNumber: true,
      status: true,
      orderId: true,
      order: { select: { orderNumber: true } },
      shipment: { select: { id: true } },
    },
  });
  if (!subOrder) return { status: "error", message: "Order not found." };

  if (
    subOrder.status !== SUB_ORDER_STATUS.OUT_FOR_DELIVERY &&
    subOrder.status !== SUB_ORDER_STATUS.IN_TRANSIT
  ) {
    return {
      status: "error",
      message:
        "A failed attempt can only be recorded against a parcel that is out for delivery.",
    };
  }
  if (!subOrder.shipment) {
    return {
      status: "error",
      message: "This parcel has no shipment to record an attempt against.",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.shipment.update({
      where: { id: subOrder.shipment!.id },
      data: {
        status: SHIPMENT_STATUS.DELIVERY_FAILED,
        failureReason: input.reason,
      },
    });

    await tx.shipmentEvent.create({
      data: {
        shipmentId: subOrder.shipment!.id,
        status: SHIPMENT_STATUS.DELIVERY_FAILED,
        location: input.location || null,
        note: input.note || input.reason,
      },
    });

    // The order has not moved, but the attempt belongs on its timeline — it is
    // the answer to "it says out for delivery and it is not here".
    await tx.orderEvent.create({
      data: {
        orderId: subOrder.orderId,
        subOrderId: subOrder.id,
        fromStatus: subOrder.status,
        toStatus: subOrder.status,
        actorUserId: auth.ops.userId,
        actorRole: auth.ops.role,
        note: `Delivery attempt failed — ${input.reason}${input.note ? `. ${input.note}` : ""}`,
      },
    });
  });

  revalidatePipeline(subOrder.subOrderNumber, subOrder.order.orderNumber);

  return {
    status: "success",
    message: `Attempt recorded against ${subOrder.subOrderNumber}. The courier will re-attempt; the order stays out for delivery.`,
  };
}
