"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSellerContext } from "@/lib/seller/context";
import {
  performSubOrderTransition,
  TRANSITIONABLE_SELECT,
} from "@/lib/fulfilment/transition";
import { subOrderTransitionSchema } from "@/lib/validations/seller";
import { fieldErrors, type ActionState } from "@/lib/validations/commerce";
import { ROLES, SUB_ORDER_STATUS } from "@/lib/constants";

/**
 * The seller's half of the fulfilment pipeline — SRS §61.
 *
 * Under the platform-warehouse model (SRS §93-95) a seller has exactly two
 * moves: confirm a new order, which hands it to the Saawariya warehouse, or
 * decline it. Everything from picking to dispatch belongs to operations, so
 * there is no control here for it and this action would refuse it anyway — the
 * state machine gates every move on a permission a seller does not hold.
 *
 * What actually happens on a transition — the event trail, the stock release on
 * a cancellation, the parent Order recompute — lives in
 * `src/lib/fulfilment/transition.ts`, because the admin console and the four
 * operations panels perform the identical sequence. This file's only job is to
 * establish *which seller is asking* and *which sub-order is theirs*.
 */
export async function transitionSubOrder(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const seller = await getSellerContext();
  if (!seller) {
    return { status: "error", message: "You must be signed in as a seller." };
  }

  const parsed = subOrderTransitionSchema.safeParse({
    subOrderId: formData.get("subOrderId"),
    to: formData.get("to"),
    note: formData.get("note") ?? undefined,
  });
  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error) };
  }
  const input = parsed.data;

  // Ownership is in the `where` — a sub-order id belonging to another seller
  // matches nothing rather than being fetched and then rejected. The shared
  // transition module never sees a seller id, so this is the only place the
  // scoping can happen.
  const subOrder = await prisma.subOrder.findFirst({
    where: { id: input.subOrderId, sellerId: seller.sellerId },
    select: TRANSITIONABLE_SELECT,
  });
  if (!subOrder) return { status: "error", message: "Order not found." };

  const result = await performSubOrderTransition(
    subOrder,
    input.to,
    {
      userId: seller.userId,
      role: ROLES.SELLER,
      permissions: seller.permissions,
    },
    input.note,
  );
  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath("/seller");
  revalidatePath("/seller/orders");
  revalidatePath(`/seller/orders/${subOrder.subOrderNumber}`);
  revalidatePath(`/account/orders/${subOrder.order.orderNumber}`);
  revalidatePath("/admin/orders");

  return {
    status: "success",
    message:
      input.to === SUB_ORDER_STATUS.CANCELLED
        ? "Order declined and the customer notified."
        : "Order confirmed and sent to the warehouse.",
  };
}
