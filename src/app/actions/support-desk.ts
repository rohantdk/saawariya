"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminAction } from "@/lib/admin/context";
import { AUDIT_ACTIONS, writeAudit } from "@/lib/admin/audit";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { assertTicketMove } from "@/lib/support/ticket-states";
import { returnDecisionFor } from "@/lib/support/return-states";
import {
  performSubOrderTransition,
  TRANSITIONABLE_SELECT,
} from "@/lib/fulfilment/transition";
import {
  agentReplySchema,
  returnDecisionSchema,
  ticketAssignSchema,
  ticketMoveSchema,
  ticketPrioritySchema,
} from "@/lib/validations/support";
import { fieldErrors, type ActionState } from "@/lib/validations/commerce";
import {
  PAYMENT_STATUS,
  RETURN_STATUS,
  RETURN_STATUS_LABEL,
  TICKET_STATUS,
  ticketPriorityRank,
} from "@/lib/constants";
import { formatPaise } from "@/lib/utils";

/**
 * Everything the support desk writes — SRS §111, §133-137.
 *
 * Named `support-desk` rather than `support` because `src/app/actions/support.ts`
 * is the **customer's** side of the same models and both are `"use server"`
 * modules. Every export of one is a public HTTP endpoint, so keeping the two
 * audiences in separate files with separate permission gates is not tidiness —
 * it is what stops a customer-facing action drifting into an agent capability.
 */

// ---------------------------------------------------------------------------
// TICKETS
// ---------------------------------------------------------------------------

export async function assignTicket(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireAdminAction(PERMISSIONS.TICKET_ASSIGN);
  if (!auth.ok) return { status: "error", message: auth.error };

  const parsed = ticketAssignSchema.safeParse({
    ticketId: formData.get("ticketId"),
    assigneeId: formData.get("assigneeId") ?? "",
  });
  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error) };
  }

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: parsed.data.ticketId },
    select: { id: true, ticketNumber: true, status: true, assigneeId: true },
  });
  if (!ticket) return { status: "error", message: "Ticket not found." };

  const assigneeId = parsed.data.assigneeId || null;

  const agent = assigneeId
    ? await prisma.user.findUnique({
        where: { id: assigneeId },
        select: { id: true, fullName: true, roleCode: true },
      })
    : null;

  /**
   * A ticket may only be assigned to somebody who can actually see it.
   * `TICKET_VIEW_ALL` belongs to Support and SUPER_ADMIN; assigning to a
   * warehouse operator would put the ticket in a queue that person has no
   * screen for, and it would look answered to everyone else.
   */
  if (assigneeId && !agent) {
    return { status: "error", message: "That person no longer has an account." };
  }
  if (agent && !["SUPPORT", "SUPER_ADMIN"].includes(agent.roleCode)) {
    return {
      status: "error",
      message: `${agent.fullName} is not on the support desk, so the ticket would not appear in any queue they can see.`,
    };
  }

  /**
   * Assigning an untouched ticket moves it OPEN → ASSIGNED. It does not touch
   * anything further along: a ticket already IN_PROGRESS that changes hands is
   * still in progress, and dragging it backwards would restart its clock.
   */
  const status =
    ticket.status === TICKET_STATUS.OPEN && assigneeId
      ? TICKET_STATUS.ASSIGNED
      : !assigneeId && ticket.status === TICKET_STATUS.ASSIGNED
        ? TICKET_STATUS.OPEN
        : ticket.status;

  await prisma.$transaction(async (tx) => {
    await tx.supportTicket.update({
      where: { id: ticket.id },
      data: { assigneeId, status },
    });

    if (agent) {
      await tx.notification.create({
        data: {
          userId: agent.id,
          title: `Ticket ${ticket.ticketNumber} assigned to you`,
          body: "It is in your queue on the support desk.",
          category: "SUPPORT",
          linkUrl: `/admin/support/tickets/${ticket.ticketNumber}`,
        },
      });
    }

    await writeAudit(
      {
        userId: auth.admin.userId,
        action: AUDIT_ACTIONS.TICKET_ASSIGNED,
        entityType: "SupportTicket",
        entityId: ticket.id,
        summary: agent
          ? `Ticket ${ticket.ticketNumber} assigned to ${agent.fullName}`
          : `Ticket ${ticket.ticketNumber} returned to the shared queue`,
        meta: { from: ticket.assigneeId, to: assigneeId },
      },
      tx,
    );
  });

  revalidatePath("/admin/support/tickets");
  revalidatePath(`/admin/support/tickets/${ticket.ticketNumber}`);
  revalidatePath("/admin/support");

  return {
    status: "success",
    message: agent
      ? `Assigned to ${agent.fullName}.`
      : "Put back in the shared queue.",
  };
}

export async function moveTicket(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireAdminAction(PERMISSIONS.TICKET_RESOLVE);
  if (!auth.ok) return { status: "error", message: auth.error };

  const parsed = ticketMoveSchema.safeParse({
    ticketId: formData.get("ticketId"),
    to: formData.get("to"),
    resolutionNote: formData.get("resolutionNote") ?? undefined,
  });
  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error) };
  }

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: parsed.data.ticketId },
    select: {
      id: true,
      ticketNumber: true,
      status: true,
      subject: true,
      raisedById: true,
    },
  });
  if (!ticket) return { status: "error", message: "Ticket not found." };

  const check = assertTicketMove(
    ticket.status,
    parsed.data.to,
    auth.admin.permissions,
  );
  if (!check.ok) return { status: "error", message: check.error };

  const resolving = parsed.data.to === TICKET_STATUS.RESOLVED;
  const closing = parsed.data.to === TICKET_STATUS.CLOSED;
  const note = parsed.data.resolutionNote?.trim() ?? "";

  /**
   * Resolving requires an explanation, and it is the same rule as every other
   * decision in this build: the note is the deliverable. The customer sees
   * "Resolved" on their ticket, and a resolution with no words is a screen
   * telling somebody their problem is over without saying what happened.
   */
  if (resolving && note.length < 10) {
    return {
      status: "error",
      errors: { resolutionNote: ["Say what was done — at least 10 characters."] },
      message: "A resolution needs an explanation. The customer reads it.",
    };
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.supportTicket.update({
      where: { id: ticket.id },
      data: {
        status: parsed.data.to,
        ...(note ? { resolutionNote: note } : {}),
        ...(resolving ? { resolvedAt: now } : {}),
        ...(closing ? { closedAt: now } : {}),
      },
    });

    // The resolution is written into the thread too, not only into a column —
    // otherwise the conversation ends mid-sentence and the answer lives
    // somewhere the customer's view has no reason to render.
    if (resolving && note) {
      await tx.ticketMessage.create({
        data: {
          ticketId: ticket.id,
          authorId: auth.admin.userId,
          body: note,
          isInternalNote: false,
        },
      });
    }

    await tx.notification.create({
      data: {
        userId: ticket.raisedById,
        title: resolving
          ? `${ticket.ticketNumber} resolved`
          : closing
            ? `${ticket.ticketNumber} closed`
            : `Update on ${ticket.ticketNumber}`,
        body: resolving
          ? note
          : closing
            ? "This conversation is now closed. Raise a new request if you need anything else."
            : `Your request “${ticket.subject}” is now ${parsed.data.to.toLowerCase().replace(/_/g, " ")}.`,
        category: "SUPPORT",
        linkUrl: `/account/support/${ticket.ticketNumber}`,
      },
    });

    if (resolving || closing) {
      await writeAudit(
        {
          userId: auth.admin.userId,
          action: resolving
            ? AUDIT_ACTIONS.TICKET_RESOLVED
            : AUDIT_ACTIONS.TICKET_CLOSED,
          entityType: "SupportTicket",
          entityId: ticket.id,
          summary: `Ticket ${ticket.ticketNumber} ${resolving ? "resolved" : "closed"} — ${ticket.subject}`,
          meta: { from: ticket.status, note: note || null },
        },
        tx,
      );
    }
  });

  revalidatePath("/admin/support/tickets");
  revalidatePath(`/admin/support/tickets/${ticket.ticketNumber}`);
  revalidatePath("/admin/support");
  revalidatePath(`/account/support/${ticket.ticketNumber}`);

  return {
    status: "success",
    message: `${ticket.ticketNumber} is now ${parsed.data.to.toLowerCase().replace(/_/g, " ")}.`,
  };
}

export async function setTicketPriority(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireAdminAction(PERMISSIONS.TICKET_ASSIGN);
  if (!auth.ok) return { status: "error", message: auth.error };

  const parsed = ticketPrioritySchema.safeParse({
    ticketId: formData.get("ticketId"),
    priority: formData.get("priority"),
  });
  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error) };
  }

  const ticket = await prisma.supportTicket.update({
    where: { id: parsed.data.ticketId },
    data: {
      priority: parsed.data.priority,
      // The queue sorts on the numeric mirror; leaving it stale would silently
      // keep an escalated ticket at the bottom of the list.
      priorityRank: ticketPriorityRank(parsed.data.priority),
    },
    select: { ticketNumber: true, priority: true },
  });

  revalidatePath("/admin/support/tickets");
  revalidatePath(`/admin/support/tickets/${ticket.ticketNumber}`);
  revalidatePath("/admin/support");

  return {
    status: "success",
    message: `${ticket.ticketNumber} set to ${ticket.priority.toLowerCase()} priority.`,
  };
}

export async function replyToTicket(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireAdminAction(PERMISSIONS.TICKET_VIEW_ALL);
  if (!auth.ok) return { status: "error", message: auth.error };

  const parsed = agentReplySchema.safeParse({
    ticketId: formData.get("ticketId"),
    body: formData.get("body"),
    isInternalNote: formData.get("isInternalNote") === "on",
  });
  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error) };
  }

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: parsed.data.ticketId },
    select: {
      id: true,
      ticketNumber: true,
      status: true,
      subject: true,
      raisedById: true,
    },
  });
  if (!ticket) return { status: "error", message: "Ticket not found." };

  if (ticket.status === TICKET_STATUS.CLOSED) {
    return {
      status: "error",
      message:
        "This ticket is closed and the customer can no longer write to it, so a reply would be a message they cannot answer.",
    };
  }

  const internal = parsed.data.isInternalNote ?? false;

  await prisma.$transaction(async (tx) => {
    await tx.ticketMessage.create({
      data: {
        ticketId: ticket.id,
        authorId: auth.admin.userId,
        body: parsed.data.body,
        isInternalNote: internal,
      },
    });

    /**
     * An internal note changes nothing the customer can see, so it must not
     * move the ticket's status or send a notification. That is the whole
     * meaning of the flag — Phase 4 verified from the customer's side that the
     * note on TKT-2026-00002 is absent from their thread.
     */
    if (!internal) {
      if (
        ticket.status === TICKET_STATUS.OPEN ||
        ticket.status === TICKET_STATUS.ASSIGNED
      ) {
        await tx.supportTicket.update({
          where: { id: ticket.id },
          data: { status: TICKET_STATUS.IN_PROGRESS },
        });
      }

      await tx.notification.create({
        data: {
          userId: ticket.raisedById,
          title: `Reply on ${ticket.ticketNumber}`,
          body: `Our team has replied about “${ticket.subject}”.`,
          category: "SUPPORT",
          linkUrl: `/account/support/${ticket.ticketNumber}`,
        },
      });
    }
  });

  revalidatePath(`/admin/support/tickets/${ticket.ticketNumber}`);
  revalidatePath("/admin/support/tickets");
  revalidatePath(`/account/support/${ticket.ticketNumber}`);

  return {
    status: "success",
    message: internal
      ? "Note added. The customer cannot see it."
      : "Reply sent. The customer has been notified.",
  };
}

// ---------------------------------------------------------------------------
// RETURNS — SRS §111
// ---------------------------------------------------------------------------

export async function decideReturn(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireAdminAction(PERMISSIONS.RETURN_PROCESS);
  if (!auth.ok) return { status: "error", message: auth.error };

  const parsed = returnDecisionSchema.safeParse({
    returnId: formData.get("returnId"),
    to: formData.get("to"),
    note: formData.get("note") ?? undefined,
  });
  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error) };
  }

  const request = await prisma.returnRequest.findUnique({
    where: { id: parsed.data.returnId },
    select: {
      id: true,
      status: true,
      reason: true,
      subOrder: {
        select: {
          ...TRANSITIONABLE_SELECT,
          totalAmount: true,
          seller: { select: { businessName: true } },
          order: {
            select: {
              orderNumber: true,
              customer: { select: { userId: true } },
              payments: {
                select: { id: true, amount: true, status: true },
              },
            },
          },
        },
      },
    },
  });
  if (!request) return { status: "error", message: "Return not found." };

  const decision = returnDecisionFor(request, parsed.data.to);
  if (!decision) {
    return {
      status: "error",
      message: `A return cannot move from ${RETURN_STATUS_LABEL[request.status]?.toLowerCase() ?? request.status} to ${
        RETURN_STATUS_LABEL[parsed.data.to]?.toLowerCase() ?? parsed.data.to
      }.`,
    };
  }

  const note = parsed.data.note?.trim() ?? "";
  if (decision.requiresNote && note.length < 10) {
    return {
      status: "error",
      errors: { note: ["Say why — at least 10 characters."] },
      message: "This decision needs a reason. The customer reads it.",
    };
  }

  const completing = parsed.data.to === RETURN_STATUS.REFUNDED;
  const rejecting = parsed.data.to === RETURN_STATUS.REJECTED;
  const now = new Date();

  // The payment a refund would come back out of. A cash-on-delivery order that
  // was never collected has none, and inventing a refund against a payment that
  // did not happen is how finance ends up chasing money nobody took.
  const payment = request.subOrder.order.payments.find(
    (candidate) => candidate.status === PAYMENT_STATUS.SUCCESS,
  );

  let refundRaised = false;

  /**
   * Everything this decision changes, as one function so it can run either
   * inside `performSubOrderTransition`'s transaction (when the parcel moves) or
   * in its own (when it does not). Approving a return does not move goods; only
   * completing and rejecting do.
   */
  const applyDecision = async (tx: Prisma.TransactionClient) => {
    await tx.returnRequest.update({
      where: { id: request.id },
      data: {
        status: parsed.data.to,
        reviewNote: note || null,
        resolution: completing ? "REFUND" : null,
        resolvedAt: completing || rejecting ? now : null,
      },
    });

    /**
     * Completing a return raises a refund **PENDING**, exactly as cancelling an
     * order does — it is never auto-approved. Support decides that the goods
     * came back; finance decides that the money goes out. Merging those two
     * decisions into one click is how a build ends up with no refund workflow
     * at all.
     */
    if (completing && payment) {
      await tx.refund.create({
        data: {
          paymentId: payment.id,
          amount: request.subOrder.totalAmount,
          reason: "RETURN",
          status: "PENDING",
        },
      });
      refundRaised = true;
    }

    await tx.notification.create({
      data: {
        userId: request.subOrder.order.customer.userId,
        title: completing
          ? `Return accepted for ${request.subOrder.order.orderNumber}`
          : rejecting
            ? `Return declined for ${request.subOrder.order.orderNumber}`
            : `Return update for ${request.subOrder.order.orderNumber}`,
        body: completing
          ? refundRaised
            ? `We have your return. A refund of ${formatPaise(request.subOrder.totalAmount)} is with our finance team and will follow shortly.`
            : "We have your return. There is nothing to refund on this order, as no payment was collected."
          : rejecting
            ? note
            : `Your return is now ${RETURN_STATUS_LABEL[parsed.data.to]?.toLowerCase() ?? parsed.data.to}.${note ? ` ${note}` : ""}`,
        category: "ORDER",
        linkUrl: `/account/orders/${request.subOrder.order.orderNumber}`,
      },
    });

    await writeAudit(
      {
        userId: auth.admin.userId,
        action: completing
          ? AUDIT_ACTIONS.RETURN_COMPLETED
          : rejecting
            ? AUDIT_ACTIONS.RETURN_REJECTED
            : AUDIT_ACTIONS.RETURN_APPROVED,
        entityType: "ReturnRequest",
        entityId: request.id,
        summary: `Return on ${request.subOrder.subOrderNumber} (${request.reason}) → ${RETURN_STATUS_LABEL[parsed.data.to] ?? parsed.data.to}`,
        meta: {
          from: request.status,
          to: parsed.data.to,
          subOrder: request.subOrder.subOrderNumber,
          refundRaised,
          note: note || null,
        },
      },
      tx,
    );
  };

  if (decision.subOrderTo) {
    /**
     * The parcel moves, so the pipeline owns the transaction and this decision
     * rides along as its side effect. That is what guarantees the restock, the
     * `OrderEvent`, the parent-order recompute and the refund either all happen
     * or none of them do — `performSubOrderTransition` has applied
     * `RETURNED → restock` since Phase 7 and nothing here re-implements it.
     */
    const result = await performSubOrderTransition(
      request.subOrder,
      decision.subOrderTo,
      {
        userId: auth.admin.userId,
        role: auth.admin.user.role,
        permissions: auth.admin.permissions,
      },
      note ||
        (completing
          ? "Return received and completed by the support desk"
          : "Return request rejected by the support desk"),
      applyDecision,
    );

    if (!result.ok) return { status: "error", message: result.error };
  } else {
    await prisma.$transaction(applyDecision);
  }

  revalidatePath("/admin/support/returns");
  revalidatePath(`/admin/support/returns/${request.subOrder.subOrderNumber}`);
  revalidatePath("/admin/support");
  revalidatePath(`/account/orders/${request.subOrder.order.orderNumber}`);
  revalidatePath("/seller/orders");
  if (refundRaised) revalidatePath("/admin/finance/refunds");

  return {
    status: "success",
    message: completing
      ? refundRaised
        ? `Return completed. Stock is back on the shelf and a ${formatPaise(request.subOrder.totalAmount)} refund is waiting for finance to release.`
        : "Return completed and the stock is back on the shelf. No payment was collected on this order, so there is nothing to refund."
      : `Return marked ${RETURN_STATUS_LABEL[parsed.data.to]?.toLowerCase() ?? parsed.data.to}. The customer has been told.`,
  };
}
