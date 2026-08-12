import "server-only";
import { prisma } from "@/lib/prisma";
import { getSellerProfile, kycProgress } from "@/lib/seller/profile";
import {
  PRODUCT_STATUS,
  SELLER_VERIFICATION,
  SETTLEMENT_STATUS,
  SUB_ORDER_STATUS,
} from "@/lib/constants";

/**
 * Seller administration — SRS §74 (seller management), §55 (verification).
 *
 * The detail read deliberately calls `getSellerProfile()` from the seller
 * module rather than re-selecting the columns: the admin is reviewing *the same
 * record the seller submitted*, and a second projection is how the two panels
 * end up disagreeing about which documents exist. `kycChecklist` /
 * `kycProgress` are shared for the same reason — the four-row checklist an
 * admin ticks off has to be the four rows `/seller/pending` shows.
 */

const PAGE_SIZE = 20;

export type SellerListFilters = {
  status?: string;
  q?: string;
  page?: number;
};

export async function listSellers(filters: SellerListFilters = {}) {
  const { status = "all", q = "", page = 1 } = filters;

  const where = {
    ...(status !== "all" ? { verificationStatus: status } : {}),
    ...(q
      ? {
          OR: [
            { businessName: { contains: q } },
            { ownerName: { contains: q } },
            { gstNumber: { contains: q } },
            { user: { email: { contains: q } } },
          ],
        }
      : {}),
  };

  const [sellers, total] = await Promise.all([
    prisma.seller.findMany({
      where,
      // Newest application first: the queue is worked from the top, and a
      // seller who applied this morning is the one being asked about.
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        businessName: true,
        ownerName: true,
        businessType: true,
        city: true,
        state: true,
        gstNumber: true,
        verificationStatus: true,
        verificationNote: true,
        commissionPercent: true,
        createdAt: true,
        verifiedAt: true,
        user: { select: { email: true, status: true } },
        documents: { select: { docType: true, status: true } },
        _count: { select: { products: true, subOrders: true } },
      },
    }),
    prisma.seller.count({ where }),
  ]);

  return {
    sellers,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

/** Tab counts. Zero-filled so an empty state renders "0", not a gap. */
export async function sellerCounts(): Promise<Record<string, number>> {
  const rows = await prisma.seller.groupBy({
    by: ["verificationStatus"],
    _count: { _all: true },
  });

  const counts: Record<string, number> = {
    all: 0,
    ...Object.fromEntries(
      Object.values(SELLER_VERIFICATION).map((value) => [value, 0]),
    ),
  };
  for (const row of rows) {
    counts[row.verificationStatus] = row._count._all;
    counts.all += row._count._all;
  }
  return counts;
}

/**
 * Everything the seller detail screen shows: the submitted application, plus
 * the trading record an approver needs in order to judge a suspension.
 */
export async function getSellerForReview(sellerId: string) {
  const profile = await getSellerProfile(sellerId);
  if (!profile) return null;

  const [productsByStatus, subOrders, delivered, settlements, recentProducts] =
    await Promise.all([
      prisma.product.groupBy({
        by: ["status"],
        where: { sellerId },
        _count: { _all: true },
      }),
      prisma.subOrder.count({ where: { sellerId } }),
      prisma.subOrder.aggregate({
        where: { sellerId, status: SUB_ORDER_STATUS.DELIVERED },
        _sum: { subtotal: true },
        _count: { _all: true },
      }),
      prisma.settlement.groupBy({
        by: ["status"],
        where: { sellerId },
        _sum: { netAmount: true },
        _count: { _all: true },
      }),
      prisma.product.findMany({
        where: { sellerId },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: {
          id: true,
          name: true,
          sku: true,
          status: true,
          priceEffective: true,
        },
      }),
    ]);

  const products: Record<string, number> = {
    [PRODUCT_STATUS.DRAFT]: 0,
    [PRODUCT_STATUS.PENDING]: 0,
    [PRODUCT_STATUS.APPROVED]: 0,
    [PRODUCT_STATUS.REJECTED]: 0,
    [PRODUCT_STATUS.HIDDEN]: 0,
  };
  for (const row of productsByStatus) products[row.status] = row._count._all;

  const settlementPending = settlements
    .filter(
      (row) =>
        row.status === SETTLEMENT_STATUS.PENDING ||
        row.status === SETTLEMENT_STATUS.UNDER_REVIEW,
    )
    .reduce((sum, row) => sum + (row._sum.netAmount ?? 0), 0);

  return {
    profile,
    kyc: kycProgress(profile.documents),
    stats: {
      products,
      productTotal: productsByStatus.reduce(
        (sum, row) => sum + row._count._all,
        0,
      ),
      subOrders,
      deliveredCount: delivered._count._all,
      deliveredGross: delivered._sum.subtotal ?? 0,
      settlementPending,
      settlementReleased: settlements
        .filter((row) => row.status === SETTLEMENT_STATUS.RELEASED)
        .reduce((sum, row) => sum + (row._sum.netAmount ?? 0), 0),
    },
    recentProducts,
  };
}
