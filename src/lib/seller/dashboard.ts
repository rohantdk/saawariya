import "server-only";
import { prisma } from "@/lib/prisma";
import {
  INVENTORY_STATUS,
  PRODUCT_STATUS,
  SETTLEMENT_STATUS,
  SUB_ORDER_STATUS,
} from "@/lib/constants";

/**
 * Aggregates for the seller dashboard and the sidebar badges.
 *
 * Two rules this module follows, both learned on the customer side:
 *
 * 1. **A badge counts work waiting, not rows that exist.** "41 products" on a
 *    tab tells a seller nothing; "5 awaiting approval" is a to-do. So the counts
 *    here are all queues.
 * 2. **Revenue is counted on the sub-order, never the order.** An Order spans
 *    sellers; a SubOrder is exactly one seller's share, which is why the whole
 *    fulfilment and settlement model hangs off it. Summing Order.totalAmount
 *    for a seller would bill them for other sellers' goods.
 */

/** Sub-orders sitting in the seller's own court, i.e. waiting on them to act. */
const AWAITING_SELLER = [SUB_ORDER_STATUS.PLACED];

/**
 * Sub-orders that have been handed over and are moving through the platform
 * warehouse. The seller can watch these but cannot act on them — under the
 * §93–95 fulfilment model picking, QC and packing belong to operations.
 */
const IN_FULFILMENT = [
  SUB_ORDER_STATUS.CONFIRMED,
  SUB_ORDER_STATUS.WAREHOUSE_QUEUE,
  SUB_ORDER_STATUS.PICKING,
  SUB_ORDER_STATUS.PICKED,
  SUB_ORDER_STATUS.QC_PENDING,
  SUB_ORDER_STATUS.QC_PASSED,
  SUB_ORDER_STATUS.QC_FAILED,
  SUB_ORDER_STATUS.RETURNED_TO_WAREHOUSE,
  SUB_ORDER_STATUS.PACKING,
  SUB_ORDER_STATUS.READY_FOR_DISPATCH,
  SUB_ORDER_STATUS.DISPATCHED,
  SUB_ORDER_STATUS.IN_TRANSIT,
  SUB_ORDER_STATUS.OUT_FOR_DELIVERY,
];

export type SellerNavCounts = {
  ordersAwaiting: number;
  productsPending: number;
  lowStock: number;
  unreadNotifications: number;
};

/**
 * Sidebar badge counts. Deliberately four cheap `count` queries rather than one
 * clever aggregate — they run in parallel, and the layout renders on every page
 * in the panel, so predictable beats minimal here.
 */
export async function getSellerNavCounts(
  sellerId: string,
  userId: string,
): Promise<SellerNavCounts> {
  const [ordersAwaiting, productsPending, lowStock, unreadNotifications] =
    await Promise.all([
      prisma.subOrder.count({
        where: { sellerId, status: { in: AWAITING_SELLER } },
      }),
      prisma.product.count({
        where: { sellerId, status: PRODUCT_STATUS.PENDING },
      }),
      prisma.inventory.count({
        where: {
          product: { sellerId },
          status: {
            in: [INVENTORY_STATUS.LOW_STOCK, INVENTORY_STATUS.OUT_OF_STOCK],
          },
        },
      }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

  return { ordersAwaiting, productsPending, lowStock, unreadNotifications };
}

/**
 * Everything the dashboard renders.
 *
 * Revenue counts only DELIVERED sub-orders. A seller's dashboard headline
 * number must match what they will actually be paid, and a sub-order that is
 * still in the warehouse can still be cancelled — counting it as revenue means
 * the figure falls when an order fails, which reads as a bug rather than as a
 * cancellation.
 */
export async function getSellerDashboard(sellerId: string, userId: string) {
  const [
    counts,
    productTotals,
    delivered,
    inFulfilment,
    settlementPending,
    settlementReleased,
    recentOrders,
    lowStockItems,
    recentNotifications,
  ] = await Promise.all([
    getSellerNavCounts(sellerId, userId),

    prisma.product.groupBy({
      by: ["status"],
      where: { sellerId },
      _count: { _all: true },
    }),

    prisma.subOrder.aggregate({
      where: { sellerId, status: SUB_ORDER_STATUS.DELIVERED },
      _sum: { subtotal: true },
      _count: { _all: true },
    }),

    prisma.subOrder.count({
      where: { sellerId, status: { in: IN_FULFILMENT } },
    }),

    prisma.settlement.aggregate({
      where: {
        sellerId,
        status: { in: [SETTLEMENT_STATUS.PENDING, SETTLEMENT_STATUS.UNDER_REVIEW] },
      },
      _sum: { netAmount: true },
      _count: { _all: true },
    }),

    prisma.settlement.aggregate({
      where: { sellerId, status: SETTLEMENT_STATUS.RELEASED },
      _sum: { netAmount: true },
    }),

    prisma.subOrder.findMany({
      where: { sellerId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        subOrderNumber: true,
        status: true,
        subtotal: true,
        totalAmount: true,
        createdAt: true,
        order: {
          select: { orderNumber: true, customer: { select: { id: true } } },
        },
        items: {
          select: { id: true, productName: true, quantity: true, imageUrl: true },
        },
      },
    }),

    prisma.inventory.findMany({
      where: {
        product: { sellerId },
        status: {
          in: [INVENTORY_STATUS.LOW_STOCK, INVENTORY_STATUS.OUT_OF_STOCK],
        },
      },
      orderBy: { stockQty: "asc" },
      take: 5,
      select: {
        id: true,
        stockQty: true,
        reservedQty: true,
        lowStockThreshold: true,
        status: true,
        product: { select: { id: true, name: true, sku: true } },
      },
    }),

    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        body: true,
        category: true,
        isRead: true,
        createdAt: true,
        linkUrl: true,
      },
    }),
  ]);

  // groupBy returns only the statuses that occur, so a seller with no rejected
  // products has no REJECTED row at all. Zero-fill, or the dashboard renders a
  // gap where a "0" belongs.
  const byStatus: Record<string, number> = {
    [PRODUCT_STATUS.DRAFT]: 0,
    [PRODUCT_STATUS.PENDING]: 0,
    [PRODUCT_STATUS.APPROVED]: 0,
    [PRODUCT_STATUS.REJECTED]: 0,
    [PRODUCT_STATUS.HIDDEN]: 0,
  };
  for (const row of productTotals) byStatus[row.status] = row._count._all;

  return {
    counts,
    products: {
      byStatus,
      total: productTotals.reduce((sum, row) => sum + row._count._all, 0),
    },
    revenue: {
      deliveredGross: delivered._sum.subtotal ?? 0,
      deliveredCount: delivered._count._all,
      inFulfilment,
      settlementPending: settlementPending._sum.netAmount ?? 0,
      settlementPendingCount: settlementPending._count._all,
      settlementReleased: settlementReleased._sum.netAmount ?? 0,
    },
    recentOrders,
    lowStockItems,
    recentNotifications,
  };
}
