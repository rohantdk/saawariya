import "server-only";
import { prisma } from "@/lib/prisma";
import { RETURN_STATUS } from "@/lib/constants";

/**
 * The returns desk — SRS §111.
 *
 * A return is the one flow in this build that spans every other module: the
 * customer raises it from their order, the support desk decides it, the
 * sub-order pipeline moves through `RETURN_REQUESTED → RETURNED`, the stock
 * ledger restocks the units, and finance ends up with a refund to pay. None of
 * that is re-implemented here — `performSubOrderTransition` already owns the
 * restock, and it has since Phase 7. What this module adds is the queue, and
 * what the action adds is the decision.
 *
 * Two rows describe one return and they are deliberately not merged.
 * `ReturnRequest` holds the customer's reason and the desk's decision;
 * `SubOrder.status` holds where the parcel physically is. Approving a return
 * does not move the goods, so the two must be able to disagree — a return can be
 * approved for days before anything comes back.
 */

export const RETURNS_PAGE_SIZE = 25;

export type ReturnFilters = {
  status?: string;
  q?: string;
  page?: number;
};

function buildWhere({ status = "open", q = "" }: ReturnFilters) {
  return {
    ...(status === "open"
      ? {
          status: {
            in: [
              RETURN_STATUS.REQUESTED,
              RETURN_STATUS.APPROVED,
              RETURN_STATUS.PICKUP_SCHEDULED,
              RETURN_STATUS.RECEIVED,
            ],
          },
        }
      : status !== "all"
        ? { status }
        : {}),
    ...(q
      ? {
          OR: [
            { subOrder: { subOrderNumber: { contains: q } } },
            { subOrder: { order: { orderNumber: { contains: q } } } },
            { reason: { contains: q } },
          ],
        }
      : {}),
  };
}

const RETURN_SELECT = {
  id: true,
  reason: true,
  detail: true,
  status: true,
  resolution: true,
  reviewNote: true,
  requestedAt: true,
  resolvedAt: true,
  subOrder: {
    select: {
      id: true,
      subOrderNumber: true,
      status: true,
      subtotal: true,
      totalAmount: true,
      deliveredAt: true,
      seller: { select: { businessName: true } },
      items: {
        select: {
          productName: true,
          productSku: true,
          quantity: true,
          lineTotal: true,
        },
      },
      order: {
        select: {
          id: true,
          orderNumber: true,
          totalAmount: true,
          customer: {
            select: {
              user: { select: { id: true, fullName: true, email: true } },
            },
          },
          payments: {
            select: { id: true, amount: true, method: true, status: true },
          },
        },
      },
    },
  },
} as const;

export async function listReturns(filters: ReturnFilters = {}) {
  const where = buildWhere(filters);

  const total = await prisma.returnRequest.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / RETURNS_PAGE_SIZE));
  const page = Math.min(Math.max(1, filters.page ?? 1), pageCount);

  const returns = await prisma.returnRequest.findMany({
    where,
    orderBy: { requestedAt: "asc" },
    skip: (page - 1) * RETURNS_PAGE_SIZE,
    take: RETURNS_PAGE_SIZE,
    select: RETURN_SELECT,
  });

  return { returns, total, page, pageCount };
}

export async function returnCounts() {
  const [grouped, open] = await Promise.all([
    prisma.returnRequest.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.returnRequest.count({ where: buildWhere({ status: "open" }) }),
  ]);

  const counts: Record<string, number> = { all: 0, open };
  for (const status of Object.values(RETURN_STATUS)) counts[status] = 0;
  for (const row of grouped) {
    counts[row.status] = row._count._all;
    counts.all += row._count._all;
  }
  return counts;
}

export async function findReturn(subOrderNumber: string) {
  return prisma.returnRequest.findFirst({
    where: { subOrder: { subOrderNumber } },
    select: RETURN_SELECT,
  });
}

/**
 * The decisions themselves live in `return-states.ts`, which is pure, and are
 * re-exported so a page keeps one import. See that file for why the moves
 * depend on two rows rather than one.
 */
export {
  returnDecisions,
  returnDecisionFor,
  type ReturnDecision,
} from "@/lib/support/return-states";
