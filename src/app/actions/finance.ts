"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminAction } from "@/lib/admin/context";
import { AUDIT_ACTIONS, writeAudit } from "@/lib/admin/audit";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  assertMove,
  humanise,
  REFUND_MOVES,
  SETTLEMENT_MOVES,
} from "@/lib/finance/states";
import { payoutBlockedReason } from "@/lib/finance/settlements";
import { refundedSoFar } from "@/lib/finance/refunds";
import {
  refundMoveSchema,
  settlementMoveSchema,
} from "@/lib/validations/finance";
import { fieldErrors, type ActionState } from "@/lib/validations/commerce";
import {
  PAYMENT_STATUS,
  REFUND_STATUS,
  SETTLEMENT_STATUS,
} from "@/lib/constants";
import { formatPaise } from "@/lib/utils";

/**
 * The two decisions the finance desk actually makes — SRS §119-121.
 *
 * Both follow the shape the order pipeline settled on: the state machine in
 * `src/lib/finance/states.ts` says whether the move is legal for this permission
 * set, the action re-checks it on submit, and everything that must happen
 * together happens in one transaction — the status change, the record the other
 * panel reads, the notification, and the audit row.
 *
 * `requireAdminAction` gates on the **permission**, not the role. Finance holds
 * `settlement.release` and `refund.process`; nobody else does except
 * SUPER_ADMIN, which holds every permission by construction. So there is no
 * separate "is this the finance role" branch to keep in sync with the RBAC
 * matrix.
 */

export async function moveSettlement(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireAdminAction(PERMISSIONS.SETTLEMENT_RELEASE);
  if (!auth.ok) return { status: "error", message: auth.error };

  const parsed = settlementMoveSchema.safeParse({
    settlementId: formData.get("settlementId"),
    to: formData.get("to"),
    reference: formData.get("reference") ?? undefined,
    note: formData.get("note") ?? undefined,
  });
  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error) };
  }

  const settlement = await prisma.settlement.findUnique({
    where: { id: parsed.data.settlementId },
    select: {
      id: true,
      status: true,
      netAmount: true,
      grossAmount: true,
      commissionAmount: true,
      commissionPercent: true,
      reference: true,
      seller: {
        select: { id: true, businessName: true, userId: true },
      },
      subOrder: {
        select: {
          subOrderNumber: true,
          status: true,
          order: { select: { orderNumber: true } },
        },
      },
    },
  });
  if (!settlement) return { status: "error", message: "Settlement not found." };

  const check = assertMove(
    SETTLEMENT_MOVES,
    "payout",
    settlement.status,
    parsed.data.to,
    auth.admin.permissions,
  );
  if (!check.ok) return { status: "error", message: check.error };

  const noteText = parsed.data.note?.trim() ?? "";
  if (check.move.requiresNote && noteText.length < 10) {
    return {
      status: "error",
      errors: { note: ["Say why — at least 10 characters."] },
      message: "This decision needs a reason. The seller reads it.",
    };
  }

  const releasing = parsed.data.to === SETTLEMENT_STATUS.RELEASED;

  /**
   * The precondition that is not in the transition table, because it is a fact
   * about another row: money does not leave until the customer has the goods.
   * Checked here rather than only hidden in the UI — the screen states the rule,
   * and this is what enforces it.
   */
  if (releasing) {
    const blocked = payoutBlockedReason(settlement);
    if (blocked) return { status: "error", message: blocked };
  }

  // No banking integration exists, and the panel says so. A blank reference gets
  // a `SIM-` marker rather than a fabricated UTR that would read as real.
  const reference = releasing
    ? parsed.data.reference?.trim() ||
      `SIM-PAYOUT-${settlement.subOrder.subOrderNumber}`
    : settlement.reference;

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.settlement.update({
      where: { id: settlement.id },
      data: {
        status: parsed.data.to,
        reference,
        // A note is kept when one was given and cleared when the row moves on
        // without one, so a stale "held because…" cannot outlive the hold — the
        // same rule the seller verification note follows.
        note: noteText || null,
        releasedAt: releasing ? now : null,
      },
    });

    await tx.notification.create({
      data: {
        userId: settlement.seller.userId,
        title: releasing
          ? `Payout released — ${formatPaise(settlement.netAmount)}`
          : `Payout ${humanise(parsed.data.to)} — ${settlement.subOrder.subOrderNumber}`,
        body: releasing
          ? `${formatPaise(settlement.netAmount)} for ${settlement.subOrder.subOrderNumber} has been released, reference ${reference}.`
          : `${noteText} — ${settlement.subOrder.subOrderNumber}, ${formatPaise(settlement.netAmount)}.`,
        category: "SETTLEMENT",
        linkUrl: "/seller/settlements",
      },
    });

    await writeAudit(
      {
        userId: auth.admin.userId,
        action: releasing
          ? AUDIT_ACTIONS.SETTLEMENT_RELEASED
          : parsed.data.to === SETTLEMENT_STATUS.FAILED
            ? AUDIT_ACTIONS.SETTLEMENT_FAILED
            : AUDIT_ACTIONS.SETTLEMENT_HELD,
        entityType: "Settlement",
        entityId: settlement.id,
        summary: `${formatPaise(settlement.netAmount)} payout to ${settlement.seller.businessName} for ${settlement.subOrder.subOrderNumber} ${humanise(parsed.data.to)}`,
        meta: {
          from: settlement.status,
          to: parsed.data.to,
          gross: settlement.grossAmount,
          commission: settlement.commissionAmount,
          commissionPercent: settlement.commissionPercent,
          net: settlement.netAmount,
          reference,
          note: noteText || null,
        },
      },
      tx,
    );
  });

  revalidatePath("/admin/finance/settlements");
  revalidatePath("/admin/finance");
  // The seller reads the same rows on their own panel.
  revalidatePath("/seller/settlements");
  revalidatePath("/seller");

  return {
    status: "success",
    message: releasing
      ? `Released ${formatPaise(settlement.netAmount)} to ${settlement.seller.businessName}, reference ${reference}.`
      : `Payout marked ${humanise(parsed.data.to)}. ${settlement.seller.businessName} has been told why.`,
  };
}

export async function moveRefund(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireAdminAction(PERMISSIONS.REFUND_PROCESS);
  if (!auth.ok) return { status: "error", message: auth.error };

  const parsed = refundMoveSchema.safeParse({
    refundId: formData.get("refundId"),
    to: formData.get("to"),
    note: formData.get("note") ?? undefined,
  });
  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error) };
  }

  const refund = await prisma.refund.findUnique({
    where: { id: parsed.data.refundId },
    select: {
      id: true,
      amount: true,
      reason: true,
      status: true,
      paymentId: true,
      payment: {
        select: {
          id: true,
          amount: true,
          method: true,
          status: true,
          order: {
            select: {
              orderNumber: true,
              customer: { select: { userId: true } },
            },
          },
        },
      },
    },
  });
  if (!refund) return { status: "error", message: "Refund not found." };

  const check = assertMove(
    REFUND_MOVES,
    "refund",
    refund.status,
    parsed.data.to,
    auth.admin.permissions,
  );
  if (!check.ok) return { status: "error", message: check.error };

  const noteText = parsed.data.note?.trim() ?? "";
  if (check.move.requiresNote && noteText.length < 10) {
    return {
      status: "error",
      errors: { note: ["Say why — at least 10 characters."] },
      message: "This decision needs a reason. The customer reads it.",
    };
  }

  /**
   * The one arithmetic mistake this screen can make.
   *
   * A payment can carry several refunds — a two-seller order can lose one
   * sub-order to a cancellation and the other to a return, weeks apart — so
   * approving one in isolation could quietly take the total past what the
   * customer paid. Checked against the sum of the *other* approved rows.
   */
  if (
    parsed.data.to === REFUND_STATUS.APPROVED ||
    parsed.data.to === REFUND_STATUS.PROCESSED
  ) {
    const already = await refundedSoFar(refund.paymentId, refund.id);
    if (already + refund.amount > refund.payment.amount) {
      return {
        status: "error",
        message: `That would refund ${formatPaise(already + refund.amount)} against a payment of ${formatPaise(refund.payment.amount)}. ${formatPaise(already)} has already been approved on this order.`,
      };
    }
  }

  const processed = parsed.data.to === REFUND_STATUS.PROCESSED;
  const approved = parsed.data.to === REFUND_STATUS.APPROVED;
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.refund.update({
      where: { id: refund.id },
      data: {
        status: parsed.data.to,
        reviewNote: noteText || null,
        processedAt: processed ? now : null,
      },
    });

    /**
     * The payment only becomes REFUNDED when the *whole* of it has come back.
     * A partial refund leaves it SUCCESS, because it was: the customer paid and
     * the payment succeeded. Marking a payment REFUNDED after refunding one of
     * two sub-orders would tell the transaction log the order was unwound.
     */
    if (processed) {
      const refundedTotal =
        (await refundedSoFar(refund.paymentId, refund.id)) + refund.amount;
      if (refundedTotal >= refund.payment.amount) {
        await tx.payment.update({
          where: { id: refund.payment.id },
          data: { status: PAYMENT_STATUS.REFUNDED },
        });
      }
    }

    await tx.notification.create({
      data: {
        userId: refund.payment.order.customer.userId,
        title: processed
          ? `Refund of ${formatPaise(refund.amount)} sent`
          : approved
            ? `Refund approved for ${refund.payment.order.orderNumber}`
            : `Update on your refund for ${refund.payment.order.orderNumber}`,
        body: processed
          ? `${formatPaise(refund.amount)} has been refunded to your original payment method. Banks usually take 3–5 working days to show it.`
          : approved
            ? `We have approved a refund of ${formatPaise(refund.amount)}. It will be sent to your original payment method shortly.`
            : noteText,
        category: "PAYMENT",
        linkUrl: `/account/orders/${refund.payment.order.orderNumber}`,
      },
    });

    await writeAudit(
      {
        userId: auth.admin.userId,
        action: processed
          ? AUDIT_ACTIONS.REFUND_PROCESSED
          : parsed.data.to === REFUND_STATUS.REJECTED
            ? AUDIT_ACTIONS.REFUND_REJECTED
            : AUDIT_ACTIONS.REFUND_APPROVED,
        entityType: "Refund",
        entityId: refund.id,
        summary: `${formatPaise(refund.amount)} refund on ${refund.payment.order.orderNumber} ${humanise(parsed.data.to)}`,
        meta: {
          from: refund.status,
          to: parsed.data.to,
          reason: refund.reason,
          paymentId: refund.paymentId,
          note: noteText || null,
        },
      },
      tx,
    );
  });

  revalidatePath("/admin/finance/refunds");
  revalidatePath("/admin/finance/payments");
  revalidatePath("/admin/finance");
  revalidatePath(`/account/orders/${refund.payment.order.orderNumber}`);

  return {
    status: "success",
    message: processed
      ? `${formatPaise(refund.amount)} refunded on ${refund.payment.order.orderNumber}. The customer has been told.`
      : `Refund ${humanise(parsed.data.to)}. The customer has been told.`,
  };
}
