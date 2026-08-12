import "server-only";
import { prisma } from "@/lib/prisma";
import {
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  REFUND_STATUS,
  SETTLEMENT_STATUS,
  SUB_ORDER_STATUS,
} from "@/lib/constants";

/**
 * The finance dashboard — SRS §116-118.
 *
 * Same split as the three operations desks: the *queues* say how much work
 * there is, this says what is **wrong**. So the figures below are not a
 * scorecard. Every one of them is either money the platform is holding that
 * belongs to somebody else, or a transaction that did not complete.
 *
 * Money is integer paise throughout, summed by the database. Nothing here
 * divides before it has finished adding up, because a rounding error introduced
 * on a dashboard is indistinguishable from a rounding error in the ledger.
 */

export async function financeSummary() {
  const [
    collected,
    codOutstanding,
    failedPayments,
    payoutsDue,
    payoutsHeld,
    payoutsReleased,
    refundsOpen,
    refundsApproved,
    refundsProcessed,
    awaitingDelivery,
  ] = await Promise.all([
    // Money that actually arrived. `SUCCESS` only — a PENDING cash-on-delivery
    // order is not revenue, it is a promise.
    prisma.payment.aggregate({
      where: { status: PAYMENT_STATUS.SUCCESS },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.payment.aggregate({
      where: { status: PAYMENT_STATUS.PENDING, method: PAYMENT_METHOD.COD },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.payment.count({ where: { status: PAYMENT_STATUS.FAILED } }),

    prisma.settlement.aggregate({
      where: { status: SETTLEMENT_STATUS.PENDING },
      _sum: { netAmount: true, commissionAmount: true },
      _count: { _all: true },
    }),
    prisma.settlement.aggregate({
      where: {
        status: {
          in: [SETTLEMENT_STATUS.UNDER_REVIEW, SETTLEMENT_STATUS.FAILED],
        },
      },
      _sum: { netAmount: true },
      _count: { _all: true },
    }),
    prisma.settlement.aggregate({
      where: { status: SETTLEMENT_STATUS.RELEASED },
      _sum: { netAmount: true, commissionAmount: true },
      _count: { _all: true },
    }),

    prisma.refund.aggregate({
      where: {
        status: { in: [REFUND_STATUS.PENDING, REFUND_STATUS.UNDER_REVIEW] },
      },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.refund.aggregate({
      where: { status: REFUND_STATUS.APPROVED },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.refund.aggregate({
      where: { status: REFUND_STATUS.PROCESSED },
      _sum: { amount: true },
      _count: { _all: true },
    }),

    /**
     * Delivered parcels with no settlement row at all.
     *
     * This is the check that catches the failure nothing else would: a payout
     * that was never *raised* cannot appear in any queue, so it would sit
     * invisible forever while the seller waited. Phase 5 found exactly this in
     * the seed — seven delivered sub-orders and zero settlements.
     */
    prisma.subOrder.count({
      where: {
        status: SUB_ORDER_STATUS.DELIVERED,
        settlement: { is: null },
      },
    }),
  ]);

  return {
    collected: {
      amount: collected._sum.amount ?? 0,
      count: collected._count._all,
    },
    cod: {
      amount: codOutstanding._sum.amount ?? 0,
      count: codOutstanding._count._all,
    },
    failedPayments,
    payouts: {
      due: payoutsDue._sum.netAmount ?? 0,
      dueCount: payoutsDue._count._all,
      held: payoutsHeld._sum.netAmount ?? 0,
      heldCount: payoutsHeld._count._all,
      released: payoutsReleased._sum.netAmount ?? 0,
      releasedCount: payoutsReleased._count._all,
    },
    commission: {
      earned: payoutsReleased._sum.commissionAmount ?? 0,
      accruing: payoutsDue._sum.commissionAmount ?? 0,
    },
    refunds: {
      open: refundsOpen._sum.amount ?? 0,
      openCount: refundsOpen._count._all,
      approved: refundsApproved._sum.amount ?? 0,
      approvedCount: refundsApproved._count._all,
      processed: refundsProcessed._sum.amount ?? 0,
      processedCount: refundsProcessed._count._all,
    },
    unsettledDeliveries: awaitingDelivery,
  };
}

/** Counts for the sidebar badges. Kept separate — the layout runs on every page. */
export async function financeNavCounts() {
  const [settlements, refunds] = await Promise.all([
    prisma.settlement.count({
      where: {
        status: {
          in: [SETTLEMENT_STATUS.PENDING, SETTLEMENT_STATUS.UNDER_REVIEW],
        },
      },
    }),
    prisma.refund.count({
      where: {
        status: {
          in: [
            REFUND_STATUS.PENDING,
            REFUND_STATUS.UNDER_REVIEW,
            REFUND_STATUS.APPROVED,
          ],
        },
      },
    }),
  ]);

  return { settlements, refunds };
}

/**
 * The oldest unreleased payouts and unpaid refunds.
 *
 * Age is the whole point of the list: a payout raised this morning is normal, a
 * payout raised three weeks ago is a seller who has stopped trusting the
 * platform. Ordered ascending by creation for that reason.
 */
export async function financeAttention() {
  const [settlements, refunds] = await Promise.all([
    prisma.settlement.findMany({
      where: {
        status: {
          in: [SETTLEMENT_STATUS.PENDING, SETTLEMENT_STATUS.UNDER_REVIEW],
        },
      },
      orderBy: { createdAt: "asc" },
      take: 6,
      select: {
        id: true,
        netAmount: true,
        status: true,
        createdAt: true,
        seller: { select: { businessName: true } },
        subOrder: {
          select: {
            subOrderNumber: true,
            status: true,
            deliveredAt: true,
          },
        },
      },
    }),
    prisma.refund.findMany({
      where: {
        status: {
          in: [
            REFUND_STATUS.PENDING,
            REFUND_STATUS.UNDER_REVIEW,
            REFUND_STATUS.APPROVED,
          ],
        },
      },
      orderBy: { requestedAt: "asc" },
      take: 6,
      select: {
        id: true,
        amount: true,
        reason: true,
        status: true,
        requestedAt: true,
        payment: {
          select: {
            method: true,
            order: {
              select: {
                orderNumber: true,
                customer: { select: { user: { select: { fullName: true } } } },
              },
            },
          },
        },
      },
    }),
  ]);

  return { settlements, refunds };
}
