import "server-only";
import { prisma } from "@/lib/prisma";
import {
  RETURN_STATUS,
  TICKET_PRIORITY,
  TICKET_STATUS,
} from "@/lib/constants";
import { TICKET_OPEN_STATUSES } from "@/lib/support/ticket-states";

/**
 * The support dashboard — SRS §130, §138.
 *
 * Like every other dashboard in this build, it answers "what is wrong", not
 * "how are we doing". The three figures that matter are all about somebody
 * waiting: a ticket nobody has picked up, a ticket that has been open for more
 * than a day, and a return the customer raised and nobody has decided.
 *
 * "Unanswered" deliberately means *no reply from the desk*, not "status is
 * OPEN". A ticket someone marked in-progress and then never wrote to is exactly
 * the case a status-only count would hide, and it is the one a customer notices.
 */

const DAY = 24 * 60 * 60 * 1000;

export async function supportSummary() {
  const dayAgo = new Date(Date.now() - DAY);

  const [open, unassigned, critical, ageing, returns, resolvedToday, tickets] =
    await Promise.all([
      prisma.supportTicket.count({
        where: { status: { in: TICKET_OPEN_STATUSES } },
      }),
      prisma.supportTicket.count({
        where: { status: { in: TICKET_OPEN_STATUSES }, assigneeId: null },
      }),
      prisma.supportTicket.count({
        where: {
          status: { in: TICKET_OPEN_STATUSES },
          priority: { in: [TICKET_PRIORITY.HIGH, TICKET_PRIORITY.CRITICAL] },
        },
      }),
      prisma.supportTicket.count({
        where: {
          status: { in: TICKET_OPEN_STATUSES },
          createdAt: { lt: dayAgo },
        },
      }),
      prisma.returnRequest.count({
        where: { status: RETURN_STATUS.REQUESTED },
      }),
      prisma.supportTicket.count({
        where: { resolvedAt: { gte: dayAgo } },
      }),

      /**
       * Every open ticket with just enough to work out whether the desk has
       * actually said anything. The opening description is written as the first
       * message by the requester, so a thread whose only non-internal messages
       * are theirs has had no reply — which no status column records.
       */
      prisma.supportTicket.findMany({
        where: { status: { in: TICKET_OPEN_STATUSES } },
        select: {
          id: true,
          raisedById: true,
          messages: {
            where: { isInternalNote: false },
            select: { authorId: true },
          },
        },
      }),
    ]);

  const unanswered = tickets.filter((ticket) =>
    ticket.messages.every((message) => message.authorId === ticket.raisedById),
  ).length;

  return {
    open,
    unassigned,
    critical,
    ageing,
    unanswered,
    returns,
    resolvedToday,
  };
}

export async function supportNavCounts() {
  const [tickets, returns] = await Promise.all([
    prisma.supportTicket.count({
      where: { status: { in: TICKET_OPEN_STATUSES } },
    }),
    prisma.returnRequest.count({
      where: {
        status: {
          in: [
            RETURN_STATUS.REQUESTED,
            RETURN_STATUS.APPROVED,
            RETURN_STATUS.PICKUP_SCHEDULED,
            RETURN_STATUS.RECEIVED,
          ],
        },
      },
    }),
  ]);

  return { tickets, returns };
}

/** The oldest unanswered tickets and the returns nobody has decided. */
export async function supportAttention() {
  const [tickets, returns, byCategory] = await Promise.all([
    prisma.supportTicket.findMany({
      where: { status: { in: TICKET_OPEN_STATUSES } },
      orderBy: [{ priorityRank: "desc" }, { createdAt: "asc" }],
      take: 6,
      select: {
        id: true,
        ticketNumber: true,
        subject: true,
        priority: true,
        status: true,
        category: true,
        createdAt: true,
        raisedBy: { select: { fullName: true, roleCode: true } },
        assignee: { select: { fullName: true } },
      },
    }),

    prisma.returnRequest.findMany({
      where: { status: RETURN_STATUS.REQUESTED },
      orderBy: { requestedAt: "asc" },
      take: 6,
      select: {
        id: true,
        reason: true,
        requestedAt: true,
        subOrder: {
          select: {
            subOrderNumber: true,
            totalAmount: true,
            order: {
              select: {
                orderNumber: true,
                customer: {
                  select: { user: { select: { fullName: true } } },
                },
              },
            },
          },
        },
      },
    }),

    /**
     * What people are actually writing in about. The most useful thing on a
     * support dashboard is not the queue length but its shape — six delivery
     * complaints in a week is a logistics problem, not a support one.
     */
    prisma.supportTicket.groupBy({
      by: ["category"],
      where: { status: { not: TICKET_STATUS.CLOSED } },
      _count: { _all: true },
      orderBy: { _count: { category: "desc" } },
      take: 6,
    }),
  ]);

  return {
    tickets,
    returns,
    byCategory: byCategory.map((row) => ({
      category: row.category,
      count: row._count._all,
    })),
  };
}
