import "server-only";
import { prisma } from "@/lib/prisma";
import { SUB_ORDER_STATUS } from "@/lib/constants";
import { buildSeries, rangeStart } from "@/lib/reporting/series";

/**
 * Seller sales and revenue reporting — SRS §63.
 *
 * Two decisions worth stating, because both change what the numbers mean:
 *
 * **Revenue is counted on DELIVERED sub-orders only.** A parcel still in the
 * warehouse can be cancelled, and counting it would make the seller's revenue
 * *fall* when an order fails — which reads as a bug rather than as a
 * cancellation. Orders in flight are reported separately, as a pipeline figure.
 *
 * **Revenue is `subtotal`, the seller's gross line value before any
 * platform-funded coupon.** It matches the commission base and therefore the
 * settlement, so the reports and the payout screen cannot disagree.
 */

/**
 * The range picker and the bucketing both moved to `src/lib/reporting/series.ts`
 * in Phase 8, when the finance revenue report needed the identical axis. They
 * are re-exported here so the seller pages keep one import, and so the two
 * reports cannot drift into disagreeing about what a period is.
 */
export {
  REPORT_RANGES,
  resolveRange,
  type ReportRangeKey,
} from "@/lib/reporting/series";

export async function getSellerReport(sellerId: string, days: number) {
  const since = rangeStart(days);

  const [delivered, inFlight, cancelled, topProducts] = await Promise.all([
    prisma.subOrder.findMany({
      where: {
        sellerId,
        status: SUB_ORDER_STATUS.DELIVERED,
        deliveredAt: { gte: since },
      },
      orderBy: { deliveredAt: "asc" },
      select: {
        id: true,
        subtotal: true,
        deliveredAt: true,
        items: { select: { quantity: true } },
      },
    }),

    prisma.subOrder.aggregate({
      where: {
        sellerId,
        status: {
          in: [
            SUB_ORDER_STATUS.CONFIRMED,
            SUB_ORDER_STATUS.WAREHOUSE_QUEUE,
            SUB_ORDER_STATUS.PICKING,
            SUB_ORDER_STATUS.PICKED,
            SUB_ORDER_STATUS.QC_PENDING,
            SUB_ORDER_STATUS.QC_PASSED,
            SUB_ORDER_STATUS.PACKING,
            SUB_ORDER_STATUS.READY_FOR_DISPATCH,
            SUB_ORDER_STATUS.DISPATCHED,
            SUB_ORDER_STATUS.IN_TRANSIT,
            SUB_ORDER_STATUS.OUT_FOR_DELIVERY,
          ],
        },
      },
      _sum: { subtotal: true },
      _count: { _all: true },
    }),

    prisma.subOrder.count({
      where: {
        sellerId,
        status: SUB_ORDER_STATUS.CANCELLED,
        createdAt: { gte: since },
      },
    }),

    /**
     * Top products by units, computed from OrderItem restricted to this
     * seller's *delivered* sub-orders.
     *
     * `Product.salesCount` is a lifetime total maintained by
     * `recomputeProductSales`, and this report is a period figure sitting
     * beside period revenue. A lifetime counter cannot answer "how did this
     * month go", so the aggregate is computed here even though the two now
     * agree on what "sold" means.
     */
    prisma.orderItem.groupBy({
      by: ["productId", "productName"],
      where: {
        subOrder: {
          sellerId,
          status: SUB_ORDER_STATUS.DELIVERED,
          deliveredAt: { gte: since },
        },
      },
      _sum: { quantity: true, lineTotal: true },
      orderBy: { _sum: { lineTotal: "desc" } },
      take: 8,
    }),
  ]);

  const revenue = delivered.reduce((sum, sub) => sum + sub.subtotal, 0);
  const units = delivered.reduce(
    (sum, sub) => sum + sub.items.reduce((n, item) => n + item.quantity, 0),
    0,
  );

  return {
    since,
    days,
    revenue,
    units,
    orderCount: delivered.length,
    averageOrderValue:
      delivered.length > 0 ? Math.round(revenue / delivered.length) : 0,
    inFlight: {
      value: inFlight._sum.subtotal ?? 0,
      count: inFlight._count._all,
    },
    cancelled,
    topProducts,
    series: buildSeries(
      delivered.map((sub) => ({ at: sub.deliveredAt, value: sub.subtotal })),
      since,
      days,
    ),
  };
}
