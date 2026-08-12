import "server-only";
import { prisma } from "@/lib/prisma";
import {
  INVENTORY_STATUS,
  ORDER_STATUS,
  PRODUCT_STATUS,
  REVIEW_STATUS,
  SELLER_VERIFICATION,
  SETTLEMENT_STATUS,
  SUB_ORDER_STATUS,
} from "@/lib/constants";

/**
 * Aggregates for the admin console dashboard and its sidebar badges.
 *
 * Same rule as the seller side: **a badge counts work waiting, not rows that
 * exist.** "41 products" tells an admin nothing; "5 awaiting approval" is a
 * queue they can empty. Every count below is something a person has to act on,
 * which is also why the dashboard and the sidebar read from one function — two
 * queries that disagree about how many sellers are pending is the kind of
 * discrepancy that makes a reviewer distrust every other number on the page.
 */

/** Applications sitting in the verification queue — SRS §74. */
const SELLER_QUEUE = [
  SELLER_VERIFICATION.PENDING,
  SELLER_VERIFICATION.UNDER_REVIEW,
];

/** Orders still moving. Everything else is cancelled, returned or delivered. */
const ORDERS_IN_FLIGHT = [
  ORDER_STATUS.PENDING,
  ORDER_STATUS.CONFIRMED,
  ORDER_STATUS.PROCESSING,
  ORDER_STATUS.PARTIALLY_SHIPPED,
  ORDER_STATUS.SHIPPED,
];

export type AdminNavCounts = {
  sellersPending: number;
  productsPending: number;
  reviewsPending: number;
  ordersInFlight: number;
  stockAlerts: number;
};

export async function getAdminNavCounts(): Promise<AdminNavCounts> {
  const [
    sellersPending,
    productsPending,
    reviewsPending,
    ordersInFlight,
    stockAlerts,
  ] = await Promise.all([
    prisma.seller.count({
      where: { verificationStatus: { in: SELLER_QUEUE } },
    }),
    prisma.product.count({ where: { status: PRODUCT_STATUS.PENDING } }),
    prisma.review.count({ where: { status: REVIEW_STATUS.PENDING } }),
    prisma.order.count({ where: { status: { in: ORDERS_IN_FLIGHT } } }),
    prisma.inventory.count({
      where: {
        status: {
          in: [INVENTORY_STATUS.LOW_STOCK, INVENTORY_STATUS.OUT_OF_STOCK],
        },
      },
    }),
  ]);

  return {
    sellersPending,
    productsPending,
    reviewsPending,
    ordersInFlight,
    stockAlerts,
  };
}

/**
 * Everything the dashboard renders.
 *
 * Gross merchandise value counts **delivered sub-orders**, not orders: an Order
 * spans sellers and can be part-delivered, so summing `Order.totalAmount` would
 * count goods that were cancelled alongside goods that arrived. This is the same
 * reasoning that keeps settlement on SubOrder — see
 * src/lib/commerce/totals.ts.
 */
export async function getAdminDashboard() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    counts,
    delivered,
    deliveredRecent,
    ordersTotal,
    customers,
    wholesaleCustomers,
    sellersApproved,
    productsLive,
    settlementsPending,
    commissionTotal,
    subOrdersByStatus,
    recentOrders,
    recentAudit,
    topSellers,
  ] = await Promise.all([
    getAdminNavCounts(),

    prisma.subOrder.aggregate({
      where: { status: SUB_ORDER_STATUS.DELIVERED },
      _sum: { subtotal: true },
      _count: { _all: true },
    }),

    prisma.subOrder.aggregate({
      where: {
        status: SUB_ORDER_STATUS.DELIVERED,
        createdAt: { gte: thirtyDaysAgo },
      },
      _sum: { subtotal: true },
      _count: { _all: true },
    }),

    prisma.order.count(),
    prisma.customer.count(),
    prisma.customer.count({ where: { customerType: "WHOLESALE" } }),
    prisma.seller.count({
      where: { verificationStatus: SELLER_VERIFICATION.APPROVED },
    }),
    prisma.product.count({ where: { status: PRODUCT_STATUS.APPROVED } }),

    prisma.settlement.aggregate({
      where: {
        status: {
          in: [SETTLEMENT_STATUS.PENDING, SETTLEMENT_STATUS.UNDER_REVIEW],
        },
      },
      _sum: { netAmount: true },
      _count: { _all: true },
    }),

    // Commission is a column on Settlement, not on SubOrder: it is only known
    // once a payout is raised, because the rate is per seller and can change.
    // Summing it here rather than recomputing from a percentage is what keeps
    // this figure equal to what Finance will actually see in Phase 8.
    prisma.settlement.aggregate({ _sum: { commissionAmount: true } }),

    prisma.subOrder.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),

    prisma.order.findMany({
      orderBy: { placedAt: "desc" },
      take: 6,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalAmount: true,
        placedAt: true,
        customer: {
          select: { user: { select: { fullName: true } } },
        },
        _count: { select: { subOrders: true } },
      },
    }),

    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        action: true,
        summary: true,
        createdAt: true,
        user: { select: { fullName: true, roleCode: true } },
      },
    }),

    prisma.subOrder.groupBy({
      by: ["sellerId"],
      where: { status: SUB_ORDER_STATUS.DELIVERED },
      _sum: { subtotal: true },
      _count: { _all: true },
      orderBy: { _sum: { subtotal: "desc" } },
      take: 5,
    }),
  ]);

  // groupBy omits statuses with no rows, so a pipeline stage that happens to be
  // empty would simply vanish from the breakdown rather than read as zero.
  const pipeline: Record<string, number> = {};
  for (const row of subOrdersByStatus) pipeline[row.status] = row._count._all;

  // One extra query rather than a join: groupBy cannot include relation fields,
  // and five ids is a cheap `in`.
  const sellerNames = await prisma.seller.findMany({
    where: { id: { in: topSellers.map((row) => row.sellerId) } },
    select: { id: true, businessName: true },
  });
  const nameById = new Map(sellerNames.map((s) => [s.id, s.businessName]));

  return {
    counts,
    revenue: {
      gmvDelivered: delivered._sum.subtotal ?? 0,
      commissionEarned: commissionTotal._sum.commissionAmount ?? 0,
      deliveredCount: delivered._count._all,
      gmvRecent: deliveredRecent._sum.subtotal ?? 0,
      deliveredRecentCount: deliveredRecent._count._all,
      settlementsPending: settlementsPending._sum.netAmount ?? 0,
      settlementsPendingCount: settlementsPending._count._all,
    },
    totals: {
      orders: ordersTotal,
      customers,
      wholesaleCustomers,
      sellersApproved,
      productsLive,
    },
    pipeline,
    recentOrders,
    recentAudit,
    topSellers: topSellers.map((row) => ({
      sellerId: row.sellerId,
      businessName: nameById.get(row.sellerId) ?? "Unknown seller",
      gross: row._sum.subtotal ?? 0,
      orders: row._count._all,
    })),
  };
}
