import type { PrismaClient } from "../../src/generated/prisma/client";
import { ticketPriorityRank } from "../../src/lib/constants";

/**
 * Seeded support tickets — SRS §132, §135, §137.
 *
 * Two audiences read these. The customer sees their own thread in Phase 4; the
 * agent queue in Phase 8 reads the same rows plus the internal notes.
 *
 * The internal notes are the point of seeding this rather than leaving the
 * helpdesk empty: `TicketMessage.isInternalNote` is the one field in the schema
 * whose visibility rule cannot be verified without a row that is supposed to be
 * hidden. A ticket carrying one proves the customer view filters it out.
 *
 * **Every assignee and every staff-side author is on the support desk.** Two of
 * these were assigned to `finance@saawariya.test`, which reads well — a GST
 * invoice and a settlement query really are finance questions — but Finance
 * holds no `ticket.view_all`, so those tickets showed as "With Finance Team"
 * against a queue that person has no screen for and an assignee filter that does
 * not list them. Phase 8 found it by building the assignment control, which
 * refuses exactly that. The desk relays; the finance detail belongs in an
 * internal note, which is where it now is.
 */

type TicketPlan = {
  customerEmail: string;
  category: string;
  priority: string;
  status: string;
  subject: string;
  description: string;
  daysAgo: number;
  /** Replies after the opening message. `from` is an email or "customer". */
  replies?: { from: string; body: string; internal?: boolean; hoursAfter: number }[];
  resolutionNote?: string;
  assigneeEmail?: string;
};

const PLANS: TicketPlan[] = [
  {
    customerEmail: "customer@saawariya.test",
    category: "DELIVERY_ISSUE",
    priority: "MEDIUM",
    status: "RESOLVED",
    subject: "Parcel marked dispatched but no tracking updates",
    description:
      "My order was marked as dispatched four days ago but the tracking number has not moved since. Could you check with the courier?",
    daysAgo: 40,
    assigneeEmail: "support@saawariya.test",
    replies: [
      {
        from: "support@saawariya.test",
        body: "Thank you for flagging this. I have raised it with the courier and will come back to you within 24 hours.",
        hoursAfter: 3,
      },
      {
        from: "support@saawariya.test",
        body: "Courier confirms a hub delay in Nagpur. Scans have resumed and delivery is now expected within two working days. Apologies for the wait.",
        hoursAfter: 20,
      },
      {
        from: "customer",
        body: "Thank you, it arrived this morning.",
        hoursAfter: 60,
      },
    ],
    resolutionNote:
      "Courier hub delay confirmed and cleared. Parcel delivered; customer confirmed receipt.",
  },
  {
    customerEmail: "wholesale@saawariya.test",
    category: "PAYMENT_ISSUE",
    priority: "HIGH",
    status: "WAITING_CUSTOMER",
    subject: "GST invoice needed against our GSTIN",
    description:
      "We need a GST invoice issued against our registered GSTIN for the last bulk order so we can claim input credit. The current invoice does not show it.",
    daysAgo: 9,
    assigneeEmail: "support@saawariya.test",
    replies: [
      {
        from: "support@saawariya.test",
        body: "Happy to reissue this. Could you confirm the GSTIN on record and the order number you need it against?",
        hoursAfter: 5,
      },
      {
        from: "support@saawariya.test",
        body: "Buyer's GSTIN on file matches the registration. Reissue once they confirm the order number — do not amend the original.",
        internal: true,
        hoursAfter: 5.5,
      },
    ],
  },
  {
    customerEmail: "priya.nair@saawariya.test",
    category: "PRODUCT_ISSUE",
    priority: "MEDIUM",
    status: "OPEN",
    subject: "Colour looks different from the photographs",
    description:
      "The saree I received is noticeably deeper in colour than it appeared online. I understand natural dyes vary, but I wanted to check whether this is expected before deciding on a return.",
    daysAgo: 2,
  },

  /**
   * Phase 8 additions. The three above cover the customer's view, which is all
   * Phase 4 needed; the agent queue needs every tab, every priority and both
   * kinds of requester to be non-empty, or the desk cannot be evaluated. Same
   * lesson as the empty seller queue in Phase 5 and the seven empty operations
   * queues in Phase 7.
   */
  {
    // Critical, aged and **nobody has replied** — the case the support
    // dashboard's "waiting on a first reply" figure exists to surface, and the
    // one a status column alone would hide.
    customerEmail: "kavitha.reddy@saawariya.test",
    category: "PAYMENT_ISSUE",
    priority: "CRITICAL",
    status: "OPEN",
    subject: "Charged twice for the same order",
    description:
      "My bank statement shows two debits of the same amount against one order number. Please refund the duplicate as soon as you can.",
    daysAgo: 3,
  },
  {
    // Raised by a SELLER, not a shopper. Sellers hold `ticket.raise` too, and a
    // settlement query needs a different answer from a delivery complaint —
    // the queue should not make an agent guess which they are reading.
    customerEmail: "seller@saawariya.test",
    category: "SETTLEMENT",
    priority: "HIGH",
    status: "IN_PROGRESS",
    subject: "Payout for last month is still showing as pending",
    description:
      "Three delivered orders from last month are still sitting in my payouts screen as pending. Could you tell me when they will be released?",
    daysAgo: 6,
    assigneeEmail: "support@saawariya.test",
    replies: [
      {
        from: "support@saawariya.test",
        body: "Thanks for chasing. I can see the three settlements — they are in our release queue and I will confirm once they have gone out.",
        hoursAfter: 4,
      },
      {
        from: "support@saawariya.test",
        body: "Bank details on this seller were updated last week, so the first attempt bounced. Confirm the new IFSC before releasing.",
        internal: true,
        hoursAfter: 4.5,
      },
    ],
  },
  {
    // Assigned but untouched — the difference between "somebody owns this" and
    // "somebody has done something about it", which is exactly what the
    // unanswered count separates.
    customerEmail: "ananya.bose@saawariya.test",
    category: "RETURN_REQUEST",
    priority: "MEDIUM",
    status: "ASSIGNED",
    subject: "How do I send a saree back?",
    description:
      "I would like to return one of the sarees from my last order but I cannot find the pickup option in my account. What should I do?",
    daysAgo: 1,
    assigneeEmail: "support@saawariya.test",
  },
  {
    customerEmail: "farah.sheikh@saawariya.test",
    category: "ACCOUNT",
    priority: "LOW",
    status: "CLOSED",
    subject: "Change the email on my account",
    description:
      "I would like to move my account to a new email address. The settings page says the field is read-only.",
    daysAgo: 55,
    assigneeEmail: "support@saawariya.test",
    replies: [
      {
        from: "support@saawariya.test",
        body: "We change these by hand for now, so that a mistyped address cannot lock anyone out of their own account. I have updated it and sent a confirmation to the new address.",
        hoursAfter: 6,
      },
      {
        from: "customer",
        body: "Received, thank you.",
        hoursAfter: 30,
      },
    ],
    resolutionNote:
      "Email changed by hand and confirmed with the customer at the new address.",
  },
];

export async function seedSupport(prisma: PrismaClient) {
  // Idempotent: rebuild the seeded tickets each run. Messages cascade.
  await prisma.supportTicket.deleteMany({
    where: { ticketNumber: { startsWith: "TKT-" } },
  });
  // `Notification` hangs off `User`, not `SupportTicket`, so it does not cascade
  // and has to be cleared explicitly — the same accumulation the order seed hit.
  // Scoped to the category this module owns.
  await prisma.notification.deleteMany({ where: { category: "SUPPORT" } });

  const users = await prisma.user.findMany({
    select: { id: true, email: true },
  });
  const byEmail = new Map(users.map((user) => [user.email, user.id]));

  let sequence = 0;

  for (const plan of PLANS) {
    const raisedById = byEmail.get(plan.customerEmail);
    if (!raisedById) continue;

    const createdAt = daysBefore(plan.daysAgo);
    sequence += 1;

    const ticket = await prisma.supportTicket.create({
      data: {
        ticketNumber: `TKT-${createdAt.getFullYear()}-${String(sequence).padStart(5, "0")}`,
        raisedById,
        assigneeId: plan.assigneeEmail
          ? (byEmail.get(plan.assigneeEmail) ?? null)
          : null,
        category: plan.category,
        priority: plan.priority,
        // The agent queue sorts on the numeric mirror, because ordering the
        // string column is alphabetical and would put MEDIUM above HIGH. Shared
        // with the runtime writers rather than hard-coded here, for the same
        // reason `deriveInventoryStatus` is.
        priorityRank: ticketPriorityRank(plan.priority),
        status: plan.status,
        subject: plan.subject,
        description: plan.description,
        resolutionNote: plan.resolutionNote ?? null,
        createdAt,
        resolvedAt:
          plan.status === "RESOLVED" || plan.status === "CLOSED"
            ? new Date(createdAt.getTime() + 72 * 3_600_000)
            : null,
        closedAt:
          plan.status === "CLOSED"
            ? new Date(createdAt.getTime() + 96 * 3_600_000)
            : null,
        messages: {
          // The opening description is also the first message, so the thread
          // reads as a conversation from the top.
          create: { authorId: raisedById, body: plan.description, createdAt },
        },
      },
      select: { id: true },
    });

    for (const reply of plan.replies ?? []) {
      const authorId =
        reply.from === "customer" ? raisedById : byEmail.get(reply.from);
      if (!authorId) continue;

      await prisma.ticketMessage.create({
        data: {
          ticketId: ticket.id,
          authorId,
          body: reply.body,
          isInternalNote: reply.internal ?? false,
          createdAt: new Date(createdAt.getTime() + reply.hoursAfter * 3_600_000),
        },
      });
    }

    await prisma.notification.create({
      data: {
        userId: raisedById,
        title: `Support request received`,
        body: plan.subject,
        category: "SUPPORT",
        linkUrl: "/account/support",
        isRead: plan.daysAgo > 30,
        createdAt,
      },
    });
  }

  const internalNotes = await prisma.ticketMessage.count({
    where: { isInternalNote: true },
  });
  console.log(
    `  Support: ${sequence} tickets (${internalNotes} internal note(s), never shown to customers)`,
  );
}

function daysBefore(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(10, 15, 0, 0);
  return date;
}
