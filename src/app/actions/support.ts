"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/dal";
import { getCustomerContext } from "@/lib/commerce/context";
import {
  TICKET_PRIORITY,
  TICKET_STATUS,
  ticketPriorityRank,
} from "@/lib/constants";
import {
  fieldErrors,
  ticketReplySchema,
  ticketSchema,
  type ActionState,
} from "@/lib/validations/commerce";

/**
 * Support tickets raised by a customer — SRS §49, §132.
 *
 * The customer-facing half of the helpdesk; the agent queue arrives in Phase 8.
 * Two rules matter here and both are about not leaking staff context:
 *
 *  - `isInternalNote` messages are never selected for the customer view
 *    (SRS §137). That filter lives in the query, not in the component.
 *  - Priority is a triage decision. A customer can say something is urgent, but
 *    the value written is derived, not accepted verbatim, so nobody can jump
 *    the queue by editing a form field.
 */

export async function createTicket(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = ticketSchema.safeParse({
    category: formData.get("category"),
    subject: formData.get("subject"),
    description: formData.get("description"),
    relatedOrderNumber: formData.get("relatedOrderNumber") ?? undefined,
    priority: formData.get("priority") ?? undefined,
  });

  if (!parsed.success) {
    const errors = fieldErrors(parsed.error);
    return {
      status: "error",
      errors,
      message: "Check the highlighted fields and try again.",
    };
  }

  const { category, subject, description, relatedOrderNumber } = parsed.data;

  // Resolve the order reference to an id, and only if it belongs to them.
  let relatedOrderId: string | null = null;
  if (relatedOrderNumber) {
    const context = await getCustomerContext();
    if (context) {
      const order = await prisma.order.findFirst({
        where: {
          orderNumber: relatedOrderNumber,
          customerId: context.customerId,
        },
        select: { id: true },
      });
      if (!order) {
        return {
          status: "error",
          errors: { relatedOrderNumber: ["We could not find that order."] },
        };
      }
      relatedOrderId = order.id;
    }
  }

  const ticketNumber = await nextTicketNumber();
  const priority = triagePriority(category);

  const ticket = await prisma.supportTicket.create({
    data: {
      ticketNumber,
      raisedById: user.id,
      category,
      priority,
      // The helpdesk queue sorts on the numeric mirror, because ordering the
      // string column is alphabetical and would put MEDIUM above HIGH. Every
      // write that sets `priority` must set this too.
      priorityRank: ticketPriorityRank(priority),
      status: TICKET_STATUS.OPEN,
      subject,
      description,
      relatedOrderId,
      messages: {
        // The opening description is also the first message, so the thread
        // reads as a conversation from the top instead of starting mid-way.
        create: { authorId: user.id, body: description },
      },
    },
    select: { ticketNumber: true },
  });

  await prisma.notification.create({
    data: {
      userId: user.id,
      title: `Support request ${ticket.ticketNumber} received`,
      body: "Our team will get back to you. You can follow the conversation in your account.",
      category: "SUPPORT",
      linkUrl: `/account/support/${ticket.ticketNumber}`,
    },
  });

  revalidatePath("/account/support");
  revalidatePath("/account", "layout");

  redirect(`/account/support/${ticket.ticketNumber}`);
}

export async function replyToTicket(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = ticketReplySchema.safeParse({
    ticketNumber: formData.get("ticketNumber"),
    body: formData.get("body"),
  });

  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error) };
  }

  const ticket = await prisma.supportTicket.findFirst({
    where: { ticketNumber: parsed.data.ticketNumber, raisedById: user.id },
    select: { id: true, status: true, ticketNumber: true },
  });

  if (!ticket) return { status: "error", message: "Request not found." };

  if (ticket.status === TICKET_STATUS.CLOSED) {
    return {
      status: "error",
      message:
        "This request is closed. Raise a new one and we will pick it up from there.",
    };
  }

  await prisma.$transaction([
    prisma.ticketMessage.create({
      data: {
        ticketId: ticket.id,
        authorId: user.id,
        body: parsed.data.body,
        isInternalNote: false,
      },
    }),
    // A customer replying to a request that was waiting on them puts it back in
    // the agent's queue — otherwise their answer sits unnoticed.
    prisma.supportTicket.update({
      where: { id: ticket.id },
      data:
        ticket.status === TICKET_STATUS.WAITING_CUSTOMER ||
        ticket.status === TICKET_STATUS.RESOLVED
          ? { status: TICKET_STATUS.IN_PROGRESS }
          : {},
    }),
  ]);

  revalidatePath(`/account/support/${ticket.ticketNumber}`);
  return { status: "success", message: "Message sent." };
}

export async function closeTicket(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const ticketNumber = String(formData.get("ticketNumber") ?? "");

  const ticket = await prisma.supportTicket.findFirst({
    where: { ticketNumber, raisedById: user.id },
    select: { id: true },
  });
  if (!ticket) return { status: "error", message: "Request not found." };

  await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: { status: TICKET_STATUS.CLOSED, closedAt: new Date() },
  });

  revalidatePath(`/account/support/${ticketNumber}`);
  revalidatePath("/account/support");
  return { status: "success", message: "Request closed. Thank you." };
}

/**
 * Initial priority from the category.
 *
 * Money and undelivered goods get looked at first; a general enquiry does not.
 * Agents can re-prioritise in Phase 8 — this only decides where it lands.
 */
function triagePriority(category: string): string {
  switch (category) {
    case "PAYMENT_ISSUE":
    case "REFUND_REQUEST":
      return TICKET_PRIORITY.HIGH;
    case "DELIVERY_ISSUE":
    case "ORDER_ISSUE":
    case "RETURN_REQUEST":
      return TICKET_PRIORITY.MEDIUM;
    case "GENERAL":
    case "ACCOUNT":
      return TICKET_PRIORITY.LOW;
    default:
      return TICKET_PRIORITY.MEDIUM;
  }
}

/** TKT-2026-00042. Same derivation as order numbers — highest issued, not a count. */
async function nextTicketNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `TKT-${year}-`;

  const latest = await prisma.supportTicket.findFirst({
    where: { ticketNumber: { startsWith: prefix } },
    orderBy: { ticketNumber: "desc" },
    select: { ticketNumber: true },
  });

  const last = latest
    ? Number.parseInt(latest.ticketNumber.slice(prefix.length), 10)
    : 0;

  return `${prefix}${String((Number.isFinite(last) ? last : 0) + 1).padStart(5, "0")}`;
}
