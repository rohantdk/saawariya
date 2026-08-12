"use server";

import { prisma } from "@/lib/prisma";
import { requireOperationsAction } from "@/lib/operations/context";
import { performDeskMove } from "@/lib/operations/pipeline";
import { AUDIT_ACTIONS, writeAudit } from "@/lib/admin/audit";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { SUB_ORDER_STATUS_LABEL } from "@/lib/commerce/order-status";
import { pipelineMoveSchema } from "@/lib/validations/operations";
import { fieldErrors, type ActionState } from "@/lib/validations/commerce";
import { SUB_ORDER_STATUS } from "@/lib/constants";

/**
 * The shared operations move — SRS §94, §100, §108.
 *
 * All three desks advance a parcel the same way, so there is one action rather
 * than three. What separates them is not code: it is
 * `assertTransition(from, to, permissions)` inside
 * `src/lib/fulfilment/transition.ts`, which rejects both an illegal move and a
 * legal move this actor may not make. A QC user posting `to=PICKING` by hand
 * fails there, because picking requires WAREHOUSE_PROCESS.
 *
 * **The outer gate is `ORDER_VIEW_ALL`, and that choice matters.** This endpoint
 * has no seller scope — operations works on every seller's goods — so gating it
 * on `ORDER_UPDATE_STATUS`, which a *seller* also holds, would hand every seller
 * an unscoped cancel button for the whole platform. `ORDER_VIEW_ALL` is exactly
 * the permission meaning "your view of orders is not limited to your own",
 * which is the precondition for an unscoped endpoint. The per-move permission
 * is still checked underneath, so holding it is necessary and not sufficient.
 */
export async function movePipeline(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireOperationsAction(PERMISSIONS.ORDER_VIEW_ALL);
  if (!auth.ok) return { status: "error", message: auth.error };

  const parsed = pipelineMoveSchema.safeParse({
    subOrderId: formData.get("subOrderId"),
    to: formData.get("to"),
    note: formData.get("note") ?? undefined,
  });
  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error) };
  }
  const input = parsed.data;

  const before = await prisma.subOrder.findUnique({
    where: { id: input.subOrderId },
    select: {
      status: true,
      subOrderNumber: true,
      seller: { select: { businessName: true } },
      order: { select: { orderNumber: true } },
    },
  });
  if (!before) return { status: "error", message: "Order not found." };

  const result = await performDeskMove({
    subOrderId: input.subOrderId,
    to: input.to,
    actor: {
      userId: auth.ops.userId,
      role: auth.ops.role,
      permissions: auth.ops.permissions,
    },
    note: input.note,
  });
  if (!result.ok) return { status: "error", message: result.error };

  /**
   * A routine pipeline step is *not* audited. The `OrderEvent` trail is the
   * pipeline's own record — it already names the actor, the move and the note —
   * and an audit row per picking scan would bury the administrative decisions
   * the audit screen exists to surface under thousands of them.
   *
   * A cancellation is different in kind. It ends a customer's order, releases
   * stock and cannot be undone, so it is logged like every other irreversible
   * decision in the build.
   */
  if (input.to === SUB_ORDER_STATUS.CANCELLED) {
    await writeAudit({
      userId: auth.ops.userId,
      action: AUDIT_ACTIONS.ORDER_CANCELLED,
      entityType: "SubOrder",
      entityId: input.subOrderId,
      summary: `${before.subOrderNumber} (${before.seller.businessName}) cancelled from ${before.status} by ${deskName(auth.ops.role)}${input.note ? ` — ${input.note}` : ""}`,
      meta: {
        orderNumber: before.order.orderNumber,
        from: before.status,
        orderStatus: result.orderStatus,
      },
    });
  }

  return {
    status: "success",
    message: `${result.subOrderNumber} is now ${(SUB_ORDER_STATUS_LABEL[input.to] ?? input.to).toLowerCase()}.`,
  };
}

function deskName(role: string): string {
  return role.toLowerCase().replace(/_/g, " ");
}
