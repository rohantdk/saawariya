import "server-only";
import { prisma } from "@/lib/prisma";
import { buildSeries, rangeStart } from "@/lib/reporting/series";
import {
  PAYMENT_STATUS,
  REFUND_STATUS,
  SETTLEMENT_STATUS,
  SUB_ORDER_STATUS,
} from "@/lib/constants";

/**
 * Revenue, commission and payout reporting — SRS §122.
 *
 * The platform-wide counterpart to `src/lib/seller/reports.ts`, and it holds
 * itself to the same two rules that module states, because a seller comparing
 * their report against a figure quoted by finance must not find two different
 * answers:
 *
 * 1. **Revenue is counted on DELIVERED sub-orders only.** A parcel in the
 *    warehouse can still be cancelled, and counting it makes revenue *fall* when
 *    an order fails — which reads as a bug rather than as a cancellation.
 * 2. **It is `subtotal`** — gross line value before the platform-funded coupon —
 *    because that is the commission base, so the report and the payout screen
 *    cannot disagree.
 *
 * What this report adds over the seller's is the platform's own position: what
 * the commission on that revenue was, how much of it has actually been paid out,
 * and what left again as refunds. `net to platform` is deliberately
 * commission − refunds and not "revenue − payouts", because a refund is money
 * the platform returns to a customer while the seller's payout is money it
 * passes on; netting them against each other would hide both.
 */

export async function getFinanceReport(days: number) {
  const since = rangeStart(days);

  const [delivered, settlements, refunds, byMethod, bySeller] =
    await Promise.all([
      prisma.subOrder.findMany({
        where: {
          status: SUB_ORDER_STATUS.DELIVERED,
          deliveredAt: { gte: since },
        },
        orderBy: { deliveredAt: "asc" },
        select: { subtotal: true, deliveredAt: true },
      }),

      prisma.settlement.findMany({
        where: { createdAt: { gte: since } },
        select: {
          grossAmount: true,
          commissionAmount: true,
          netAmount: true,
          status: true,
          releasedAt: true,
        },
      }),

      prisma.refund.findMany({
        where: {
          requestedAt: { gte: since },
          status: { in: [REFUND_STATUS.APPROVED, REFUND_STATUS.PROCESSED] },
        },
        select: { amount: true, reason: true, processedAt: true },
      }),

      prisma.payment.groupBy({
        by: ["method"],
        where: {
          status: PAYMENT_STATUS.SUCCESS,
          createdAt: { gte: since },
        },
        _sum: { amount: true },
        _count: { _all: true },
      }),

      /**
       * Commission by seller, over settlements rather than sub-orders.
       *
       * The settlement is where the commission *percentage* was fixed — it is
       * stored on the row, because a seller's rate can be changed by an admin
       * and recomputing historical commission from today's rate would restate
       * payouts that have already been made.
       */
      prisma.settlement.groupBy({
        by: ["sellerId"],
        where: { createdAt: { gte: since } },
        _sum: { grossAmount: true, commissionAmount: true, netAmount: true },
        _count: { _all: true },
        orderBy: { _sum: { commissionAmount: "desc" } },
        take: 10,
      }),
    ]);

  const sellers = await prisma.seller.findMany({
    where: { id: { in: bySeller.map((row) => row.sellerId) } },
    select: { id: true, businessName: true, commissionPercent: true },
  });
  const sellerName = new Map(sellers.map((s) => [s.id, s]));

  const revenue = delivered.reduce((sum, sub) => sum + sub.subtotal, 0);
  const commission = settlements.reduce(
    (sum, row) => sum + row.commissionAmount,
    0,
  );
  const released = settlements
    .filter((row) => row.status === SETTLEMENT_STATUS.RELEASED)
    .reduce((sum, row) => sum + row.netAmount, 0);
  const owed = settlements
    .filter((row) => row.status !== SETTLEMENT_STATUS.RELEASED)
    .reduce((sum, row) => sum + row.netAmount, 0);
  const refunded = refunds.reduce((sum, row) => sum + row.amount, 0);

  const refundsByReason = new Map<string, { amount: number; count: number }>();
  for (const refund of refunds) {
    const bucket = refundsByReason.get(refund.reason) ?? {
      amount: 0,
      count: 0,
    };
    bucket.amount += refund.amount;
    bucket.count += 1;
    refundsByReason.set(refund.reason, bucket);
  }

  return {
    since,
    days,
    revenue,
    orderCount: delivered.length,
    averageOrderValue:
      delivered.length > 0 ? Math.round(revenue / delivered.length) : 0,
    commission,
    released,
    owed,
    refunded,
    netToPlatform: commission - refunded,
    series: buildSeries(
      delivered.map((sub) => ({ at: sub.deliveredAt, value: sub.subtotal })),
      since,
      days,
    ),
    payoutSeries: buildSeries(
      settlements
        .filter((row) => row.status === SETTLEMENT_STATUS.RELEASED)
        .map((row) => ({ at: row.releasedAt, value: row.netAmount })),
      since,
      days,
    ),
    byMethod: byMethod
      .map((row) => ({
        method: row.method,
        amount: row._sum.amount ?? 0,
        count: row._count._all,
      }))
      .sort((a, b) => b.amount - a.amount),
    bySeller: bySeller.map((row) => ({
      sellerId: row.sellerId,
      businessName: sellerName.get(row.sellerId)?.businessName ?? "Unknown",
      commissionPercent: sellerName.get(row.sellerId)?.commissionPercent ?? 0,
      gross: row._sum.grossAmount ?? 0,
      commission: row._sum.commissionAmount ?? 0,
      net: row._sum.netAmount ?? 0,
      count: row._count._all,
    })),
    refundsByReason: [...refundsByReason.entries()]
      .map(([reason, bucket]) => ({ reason, ...bucket }))
      .sort((a, b) => b.amount - a.amount),
  };
}
