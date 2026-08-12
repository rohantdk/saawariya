import "server-only";
import { prisma } from "@/lib/prisma";
import { PRODUCT_STATUS } from "@/lib/constants";

/**
 * Catalogue administration — SRS §75 (product approval), §76.
 *
 * The mirror image of `src/lib/seller/products.ts`: the same rows, without the
 * `sellerId` scope and with the seller shown as a column instead. That is the
 * *only* difference, deliberately — an approver has to be looking at exactly
 * what the seller submitted, so the projection is kept aligned field for field
 * rather than trimmed to what today's screen happens to render.
 */

const PAGE_SIZE = 20;

export type AdminProductFilters = {
  status?: string;
  sellerId?: string;
  categoryId?: string;
  q?: string;
  page?: number;
};

export async function listProducts(filters: AdminProductFilters = {}) {
  const { status = "all", sellerId, categoryId, q = "", page = 1 } = filters;

  const where = {
    ...(status !== "all" ? { status } : {}),
    ...(sellerId ? { sellerId } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { sku: { contains: q } },
            { collection: { contains: q } },
            { seller: { businessName: { contains: q } } },
          ],
        }
      : {}),
  };

  const total = await prisma.product.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(Math.max(1, page), pageCount);

  const products = await prisma.product.findMany({
    where,
    // Oldest submission first *within* the pending queue would be fairer, but
    // this list is also the whole catalogue browser. Most recently touched is
    // the right default for both, and the status tab is what turns it into a
    // queue.
    orderBy: { updatedAt: "desc" },
    skip: (current - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      name: true,
      sku: true,
      slug: true,
      status: true,
      rejectionReason: true,
      priceRetail: true,
      priceOffer: true,
      priceEffective: true,
      ratingAvg: true,
      ratingCount: true,
      salesCount: true,
      updatedAt: true,
      seller: {
        select: { id: true, businessName: true, verificationStatus: true },
      },
      category: { select: { id: true, name: true } },
      images: {
        where: { isMain: true },
        take: 1,
        select: { url: true, alt: true },
      },
      inventory: { select: { stockQty: true, reservedQty: true, status: true } },
    },
  });

  return { products, total, page: current, pageCount };
}

export async function productCounts(): Promise<Record<string, number>> {
  const rows = await prisma.product.groupBy({
    by: ["status"],
    _count: { _all: true },
  });

  const counts: Record<string, number> = {
    all: 0,
    [PRODUCT_STATUS.DRAFT]: 0,
    [PRODUCT_STATUS.PENDING]: 0,
    [PRODUCT_STATUS.APPROVED]: 0,
    [PRODUCT_STATUS.REJECTED]: 0,
    [PRODUCT_STATUS.HIDDEN]: 0,
  };
  for (const row of rows) {
    counts[row.status] = row._count._all;
    counts.all += row._count._all;
  }
  return counts;
}

/**
 * One product, everything an approver needs to judge it.
 *
 * Includes the seller's verification status: approving a product belonging to
 * an unverified seller does not put it on the storefront, because the
 * catalogue queries filter on both. The screen has to say so, or the approver
 * will believe they published something they did not.
 */
export async function getProductForReview(productId: string) {
  return prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      sku: true,
      slug: true,
      description: true,
      brand: true,
      collection: true,
      fabric: true,
      pattern: true,
      occasion: true,
      workType: true,
      color: true,
      weightGrams: true,
      priceRetail: true,
      priceWholesale: true,
      priceOffer: true,
      priceEffective: true,
      minOrderQty: true,
      maxOrderQty: true,
      status: true,
      rejectionReason: true,
      approvedAt: true,
      isFeatured: true,
      isNewArrival: true,
      salesCount: true,
      ratingAvg: true,
      ratingCount: true,
      createdAt: true,
      updatedAt: true,
      seller: {
        select: {
          id: true,
          businessName: true,
          verificationStatus: true,
          user: { select: { email: true } },
        },
      },
      category: {
        select: { id: true, name: true, parent: { select: { name: true } } },
      },
      approvedBy: { select: { fullName: true } },
      images: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, url: true, alt: true, isMain: true },
      },
      variants: {
        orderBy: { sku: "asc" },
        select: {
          id: true,
          name: true,
          value: true,
          sku: true,
          priceDeltaPaise: true,
          stockQty: true,
        },
      },
      inventory: {
        select: {
          stockQty: true,
          reservedQty: true,
          lowStockThreshold: true,
          status: true,
        },
      },
      _count: { select: { reviews: true, orderItems: true } },
    },
  });
}

/** Seller and category options for the list filters. */
export async function productFilterOptions() {
  const [sellers, categories] = await Promise.all([
    prisma.seller.findMany({
      orderBy: { businessName: "asc" },
      select: { id: true, businessName: true },
    }),
    prisma.category.findMany({
      where: { parentId: { not: null } },
      orderBy: [{ parent: { sortOrder: "asc" } }, { sortOrder: "asc" }],
      select: {
        id: true,
        name: true,
        parent: { select: { name: true } },
      },
    }),
  ]);

  return {
    sellers,
    categories: categories.map((c) => ({
      id: c.id,
      label: c.parent ? `${c.parent.name} › ${c.name}` : c.name,
    })),
  };
}
