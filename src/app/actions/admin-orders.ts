"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminAction } from "@/lib/admin/context";
import { AUDIT_ACTIONS, writeAudit } from "@/lib/admin/audit";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  performSubOrderTransition,
  TRANSITIONABLE_SELECT,
} from "@/lib/fulfilment/transition";
import { subOrderTransitionSchema } from "@/lib/validations/admin";
import { fieldErrors, type ActionState } from "@/lib/validations/commerce";
import { ROLES } from "@/lib/constants";

/**
 * Admin override of the fulfilment pipeline — SRS §78.
 *
 * This is the reason the state machine gates on **permissions rather than
 * roles**. `SUPER_ADMIN` holds every permission by construction, so it can make
 * any legal move without a single `isAdmin` branch anywhere in the pipeline —
 * and, importantly, it still cannot make an *illegal* one. An admin can pull a
 * stuck order forward; they cannot teleport it from PLACED to DELIVERED,
 * because that transition does not exist for anybody.
 *
 * There is deliberately no seller scope here — that is the whole point of the
 * override — so the audit row is not optional. Every move made from this
 * console names the admin who made it, on top of the `OrderEvent` the shared
 * transition writes.
 */
export async function adminTransitionSubOrder(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireAdminAction(PERMISSIONS.ORDER_UPDATE_STATUS);
  if (!auth.ok) return { status: "error", message: auth.error };

  const parsed = subOrderTransitionSchema.safeParse({
    subOrderId: formData.get("subOrderId"),
    to: formData.get("to"),
    note: formData.get("note") ?? undefined,
  });
  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error) };
  }
  const input = parsed.data;

  const subOrder = await prisma.subOrder.findUnique({
    where: { id: input.subOrderId },
    select: {
      ...TRANSITIONABLE_SELECT,
      seller: { select: { businessName: true } },
    },
  });
  if (!subOrder) return { status: "error", message: "Order not found." };

  const fromStatus = subOrder.status;

  const result = await performSubOrderTransition(
    subOrder,
    input.to,
    {
      userId: auth.admin.userId,
      // The event trail records the *role* that acted, not the role the move
      // belongs to: "SUPER_ADMIN moved this to PICKING" is the fact worth
      // keeping, and writing "WAREHOUSE" would hide an override completely.
      role: ROLES.SUPER_ADMIN,
      permissions: auth.admin.permissions,
    },
    input.note,
  );
  if (!result.ok) return { status: "error", message: result.error };

  await writeAudit({
    userId: auth.admin.userId,
    action: AUDIT_ACTIONS.ORDER_STATUS_CHANGED,
    entityType: "SubOrder",
    entityId: subOrder.id,
    summary: `${subOrder.subOrderNumber} (${subOrder.seller.businessName}) moved from ${fromStatus} to ${input.to} by an administrator${
      input.note ? ` — ${input.note}` : ""
    }`,
    meta: {
      orderNumber: subOrder.order.orderNumber,
      from: fromStatus,
      to: input.to,
      orderStatus: result.orderStatus,
    },
  });

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${subOrder.order.orderNumber}`);
  revalidatePath("/seller/orders");
  revalidatePath(`/seller/orders/${subOrder.subOrderNumber}`);
  revalidatePath(`/account/orders/${subOrder.order.orderNumber}`);

  return {
    status: "success",
    message: `${subOrder.subOrderNumber} is now ${input.to.replace(/_/g, " ").toLowerCase()}. The order reads ${result.orderStatus.replace(/_/g, " ").toLowerCase()}.`,
  };
}
