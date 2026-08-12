import "server-only";
import { prisma } from "@/lib/prisma";
import { REFUND_STATUS } from "@/lib/constants";

/**
 * The refund queue — SRS §121.
 *
 * Refunds are *raised* elsewhere and *decided* here. Phase 4 established the
 * important half of that: cancelling an order raises a refund **PENDING**, it is
 * never auto-approved, because a build that silently approves its own refunds
 * has no refund workflow at all — it has an accounting hole with a nice screen
 * over it. This module is what finally closes them.
 *
 * A refund hangs off `Payment`, not `Order`, and that matters on this screen: a
 * cash-on-delivery order whose payment never succeeded has nothing to refund,
 * and the row carries the method so the desk can see which ones need a bank
 * transfer rather than a gateway reversal.
 */

export const REFUNDS_PAGE_SIZE = 25;

export type RefundFilters = {
  status?: string;
  reason?: string;
  q?: string;
  page?: number;
};

function buildWhere({
  status = REFUND_STATUS.PENDING,
  reason = "all",
  q = "",
}: RefundFilters) {
  return {
    ...(status !== "all" ? { status } : {}),
    ...(reason !== "all" ? { reason } : {}),
    ...(q
      ? {
          OR: [
            { payment: { order: { orderNumber: { contains: q } } } },
            { payment: { gatewayRef: { contains: q } } },
            {
              payment: {
                order: {
                  customer: { user: { fullName: { contains: q } } },
                },
              },
            },
          ],
        }
      : {}),
  };
}

export const REFUND_ROW_SELECT = {
  id: true,
  amount: true,
  reason: true,
  status: true,
  reviewNote: true,
  requestedAt: true,
  processedAt: true,
  payment: {
    select: {
      id: true,
      method: true,
      amount: true,
      status: true,
      gatewayRef: true,
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          totalAmount: true,
          cancelReason: true,
          customer: {
            select: {
              user: { select: { id: true, fullName: true, email: true } },
            },
          },
        },
      },
    },
  },
} as const;

export async function listRefunds(filters: RefundFilters = {}) {
  const where = buildWhere(filters);

  const total = await prisma.refund.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / REFUNDS_PAGE_SIZE));
  const page = Math.min(Math.max(1, filters.page ?? 1), pageCount);

  const [refunds, sums] = await Promise.all([
    prisma.refund.findMany({
      where,
      // Oldest first, same reasoning as the payout queue: the customer waiting
      // longest for their money is the one the desk should see first.
      orderBy: { requestedAt: "asc" },
      skip: (page - 1) * REFUNDS_PAGE_SIZE,
      take: REFUNDS_PAGE_SIZE,
      select: REFUND_ROW_SELECT,
    }),
    prisma.refund.aggregate({ where, _sum: { amount: true } }),
  ]);

  return { refunds, total, page, pageCount, amount: sums._sum.amount ?? 0 };
}

export async function refundCounts(filters: RefundFilters = {}) {
  const scope = { reason: filters.reason, q: filters.q };

  const grouped = await prisma.refund.groupBy({
    by: ["status"],
    where: buildWhere({ ...scope, status: "all" }),
    _count: { _all: true },
  });

  const counts: Record<string, number> = { all: 0 };
  for (const status of Object.values(REFUND_STATUS)) counts[status] = 0;
  for (const row of grouped) {
    counts[row.status] = row._count._all;
    counts.all += row._count._all;
  }
  return counts;
}

/** Reasons actually present, so the filter never offers an empty option. */
export async function refundReasonOptions() {
  const grouped = await prisma.refund.groupBy({
    by: ["reason"],
    _count: { _all: true },
    orderBy: { reason: "asc" },
  });
  return grouped.map((row) => ({ code: row.reason, count: row._count._all }));
}

export async function findRefund(id: string) {
  return prisma.refund.findUnique({
    where: { id },
    select: REFUND_ROW_SELECT,
  });
}

/**
 * How much of this payment has already been refunded, excluding one row.
 *
 * A payment may carry several refunds — a two-seller order can lose one
 * sub-order to a cancellation and the other to a return, weeks apart. Approving
 * a refund that would take the total past what the customer actually paid is the
 * one arithmetic mistake this screen can make, so the sum is checked at the
 * point of decision rather than assumed from a single row.
 */
export async function refundedSoFar(
  paymentId: string,
  exceptRefundId?: string,
): Promise<number> {
  const sum = await prisma.refund.aggregate({
    where: {
      paymentId,
      status: { in: [REFUND_STATUS.APPROVED, REFUND_STATUS.PROCESSED] },
      ...(exceptRefundId ? { id: { not: exceptRefundId } } : {}),
    },
    _sum: { amount: true },
  });
  return sum._sum.amount ?? 0;
}
