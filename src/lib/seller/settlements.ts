import "server-only";
import { prisma } from "@/lib/prisma";
import { SETTLEMENT_STATUS } from "@/lib/constants";

/**
 * Seller payouts — SRS §119, §120.
 *
 * Read-only for the seller, deliberately. Releasing a payout is a Finance
 * action (`settlement.release`, Phase 8); a seller who could mark their own
 * settlement RELEASED could mark themselves paid. There is no write action in
 * this module at all, which is the clearest way to say that.
 *
 * Commission is charged on `grossAmount`, which is the sub-order's **subtotal**
 * — the seller's line value before any platform coupon. A Saawariya-funded
 * promotion therefore does not come out of the seller's payout, which is the
 * reason `SubOrder.discountAmount` exists as its own column.
 */

export const SETTLEMENTS_PAGE_SIZE = 20;

export type SettlementFilter = "all" | "pending" | "released";

export async function listSellerSettlements(
  sellerId: string,
  options: { filter?: SettlementFilter; page?: number } = {},
) {
  const filter = options.filter ?? "all";

  const where = {
    sellerId,
    ...(filter === "pending"
      ? {
          status: {
            in: [SETTLEMENT_STATUS.PENDING, SETTLEMENT_STATUS.UNDER_REVIEW],
          },
        }
      : {}),
    ...(filter === "released"
      ? { status: SETTLEMENT_STATUS.RELEASED }
      : {}),
  };

  const total = await prisma.settlement.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / SETTLEMENTS_PAGE_SIZE));
  const page = Math.min(Math.max(1, options.page ?? 1), pageCount);

  const settlements = await prisma.settlement.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * SETTLEMENTS_PAGE_SIZE,
    take: SETTLEMENTS_PAGE_SIZE,
    select: {
      id: true,
      grossAmount: true,
      commissionPercent: true,
      commissionAmount: true,
      netAmount: true,
      status: true,
      reference: true,
      /**
       * Why finance stopped this payout.
       *
       * The finance panel's note box says, on the page, that what is typed
       * there "appears on the seller's own payouts screen, word for word" — and
       * until Phase 8 this query did not select the column, so a held payout
       * showed the seller a status and no reason. Exactly the dead end the
       * rejection notes exist to prevent, in the one panel where the money is at
       * stake.
       */
      note: true,
      createdAt: true,
      releasedAt: true,
      subOrder: {
        select: {
          subOrderNumber: true,
          deliveredAt: true,
          order: { select: { orderNumber: true } },
        },
      },
    },
  });

  return { settlements, total, page, pageCount, filter };
}

export async function sellerSettlementSummary(sellerId: string) {
  const [pending, released, counts] = await Promise.all([
    prisma.settlement.aggregate({
      where: {
        sellerId,
        status: {
          in: [SETTLEMENT_STATUS.PENDING, SETTLEMENT_STATUS.UNDER_REVIEW],
        },
      },
      _sum: { netAmount: true, grossAmount: true, commissionAmount: true },
      _count: { _all: true },
    }),
    prisma.settlement.aggregate({
      where: { sellerId, status: SETTLEMENT_STATUS.RELEASED },
      _sum: { netAmount: true, grossAmount: true, commissionAmount: true },
      _count: { _all: true },
    }),
    prisma.settlement.count({ where: { sellerId } }),
  ]);

  return {
    pending: {
      net: pending._sum.netAmount ?? 0,
      gross: pending._sum.grossAmount ?? 0,
      commission: pending._sum.commissionAmount ?? 0,
      count: pending._count._all,
    },
    released: {
      net: released._sum.netAmount ?? 0,
      gross: released._sum.grossAmount ?? 0,
      commission: released._sum.commissionAmount ?? 0,
      count: released._count._all,
    },
    total: counts,
  };
}
