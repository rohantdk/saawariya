import "server-only";
import { prisma } from "@/lib/prisma";
import { ROLES, TICKET_PRIORITY, TICKET_STATUS } from "@/lib/constants";
import { TICKET_OPEN_STATUSES } from "@/lib/support/ticket-states";

/**
 * The helpdesk queue — SRS §132-137.
 *
 * The agent's side of the tickets Phase 4 let customers raise. One thing here is
 * a hard rule rather than a presentation choice: **internal notes are loaded
 * here and are never loaded by the customer's view**. Phase 4 verified that from
 * the other end — the internal note on `TKT-2026-00002` is absent from the
 * customer thread — and the query below is the reason it can be.
 *
 * Tickets are raised by customers *and* sellers (a seller holds `ticket.raise`
 * too), so the queue shows who raised each one and in what capacity. A
 * settlement query from a seller and a delivery complaint from a shopper want
 * different answers, and the row should not make an agent guess.
 */

export const TICKETS_PAGE_SIZE = 25;

export type TicketFilters = {
  status?: string;
  priority?: string;
  assignee?: string;
  q?: string;
  page?: number;
};

function buildWhere({
  status = "open",
  priority = "all",
  assignee = "all",
  q = "",
}: TicketFilters) {
  return {
    ...(status === "open"
      ? { status: { in: TICKET_OPEN_STATUSES } }
      : status !== "all"
        ? { status }
        : {}),
    ...(priority !== "all" ? { priority } : {}),
    ...(assignee === "unassigned"
      ? { assigneeId: null }
      : assignee !== "all"
        ? { assigneeId: assignee }
        : {}),
    ...(q
      ? {
          OR: [
            { ticketNumber: { contains: q } },
            { subject: { contains: q } },
            { description: { contains: q } },
            { raisedBy: { fullName: { contains: q } } },
            { raisedBy: { email: { contains: q } } },
          ],
        }
      : {}),
  };
}

export async function listTickets(filters: TicketFilters = {}) {
  const where = buildWhere(filters);

  const total = await prisma.supportTicket.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / TICKETS_PAGE_SIZE));
  const page = Math.min(Math.max(1, filters.page ?? 1), pageCount);

  const tickets = await prisma.supportTicket.findMany({
    where,
    /**
     * Critical first, then oldest — not newest first. A queue sorted by arrival
     * descending is how the ticket nobody wanted to answer stays at the bottom
     * forever. Same reasoning as the payout and refund queues.
     *
     * Sorted on `priorityRank`, not `priority`: the string column orders
     * alphabetically (CRITICAL, HIGH, LOW, MEDIUM), which would put MEDIUM
     * above HIGH.
     */
    orderBy: [{ priorityRank: "desc" }, { createdAt: "asc" }],
    skip: (page - 1) * TICKETS_PAGE_SIZE,
    take: TICKETS_PAGE_SIZE,
    select: {
      id: true,
      ticketNumber: true,
      category: true,
      priority: true,
      status: true,
      subject: true,
      relatedOrderId: true,
      createdAt: true,
      resolvedAt: true,
      raisedBy: {
        select: { id: true, fullName: true, email: true, roleCode: true },
      },
      assignee: { select: { id: true, fullName: true } },
      _count: { select: { messages: true } },
      // The most recent message, to show whether the desk or the customer spoke
      // last — the single most useful thing on a queue row.
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          createdAt: true,
          isInternalNote: true,
          author: { select: { id: true, roleCode: true } },
        },
      },
    },
  });

  return { tickets, total, page, pageCount };
}

export async function ticketCounts(filters: TicketFilters = {}) {
  const scope = { priority: filters.priority, assignee: filters.assignee, q: filters.q };

  const [grouped, open, unassigned] = await Promise.all([
    prisma.supportTicket.groupBy({
      by: ["status"],
      where: buildWhere({ ...scope, status: "all" }),
      _count: { _all: true },
    }),
    prisma.supportTicket.count({
      where: buildWhere({ ...scope, status: "open" }),
    }),
    prisma.supportTicket.count({
      where: buildWhere({ ...scope, status: "all", assignee: "unassigned" }),
    }),
  ]);

  const counts: Record<string, number> = { all: 0, open, unassigned };
  for (const status of Object.values(TICKET_STATUS)) counts[status] = 0;
  for (const row of grouped) {
    counts[row.status] = row._count._all;
    counts.all += row._count._all;
  }
  return counts;
}

/**
 * Who a ticket can be assigned to.
 *
 * Support agents and admins only. A ticket assigned to a warehouse operator
 * would sit in a queue that person has no screen for — `TICKET_VIEW_ALL` is not
 * a permission the operations roles hold.
 */
export async function assignableAgents() {
  return prisma.user.findMany({
    where: {
      roleCode: { in: [ROLES.SUPPORT, ROLES.SUPER_ADMIN] },
      status: "ACTIVE",
    },
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true, roleCode: true },
  });
}

export async function findTicket(ticketNumber: string) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { ticketNumber },
    select: {
      id: true,
      ticketNumber: true,
      category: true,
      priority: true,
      status: true,
      subject: true,
      description: true,
      relatedOrderId: true,
      resolutionNote: true,
      createdAt: true,
      resolvedAt: true,
      closedAt: true,
      raisedBy: {
        select: {
          id: true,
          fullName: true,
          email: true,
          mobile: true,
          roleCode: true,
          createdAt: true,
        },
      },
      assignee: { select: { id: true, fullName: true } },
      // Internal notes included — this is the agent view. The customer's query
      // in src/lib/commerce/support.ts filters them out, which is what makes
      // them internal.
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          body: true,
          isInternalNote: true,
          createdAt: true,
          author: { select: { id: true, fullName: true, roleCode: true } },
        },
      },
    },
  });

  if (!ticket) return null;

  /**
   * `relatedOrderId` holds an order **id**, not a number, so the link needs a
   * lookup. Resolved here rather than in the page so a ticket whose order was
   * deleted renders the ticket rather than throwing.
   */
  const order = ticket.relatedOrderId
    ? await prisma.order.findUnique({
        where: { id: ticket.relatedOrderId },
        select: {
          orderNumber: true,
          status: true,
          totalAmount: true,
          placedAt: true,
        },
      })
    : null;

  return { ...ticket, order };
}

/** Other tickets from the same person — context an agent almost always wants. */
export async function ticketHistory(userId: string, exceptId: string) {
  return prisma.supportTicket.findMany({
    where: { raisedById: userId, id: { not: exceptId } },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      ticketNumber: true,
      subject: true,
      status: true,
      createdAt: true,
    },
  });
}

export const TICKET_PRIORITIES = Object.values(TICKET_PRIORITY);
