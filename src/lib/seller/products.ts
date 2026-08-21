import "server-only";
import { prisma } from "@/lib/prisma";
import { PRODUCT_STATUS, type ProductStatus } from "@/lib/constants";

/**
 * Seller catalogue reads — SRS §58, §59.
 *
 * Every query is scoped by `sellerId` inside the `where`, never by fetching a
 * row and checking ownership afterwards. Product ids appear in URLs, and a
 * seller must not be able to open, edit or delete another seller's product by
 * pasting one in. Same rule the customer order queries follow.
 */

export const PRODUCTS_PAGE_SIZE = 12;

export type ProductListFilter = ProductStatus | "all";

export async function listSellerProducts(
  sellerId: string,
  options: { status?: string; q?: string; page?: number } = {},
) {
  const status =
    options.status && options.status !== "all" ? options.status : null;
  const q = options.q?.trim();

  const where = {
    sellerId,
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { sku: { contains: q } },
            { collection: { contains: q } },
          ],
        }
      : {}),
  };

  const total = await prisma.product.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / PRODUCTS_PAGE_SIZE));
  const page = Math.min(Math.max(1, options.page ?? 1), pageCount);

  const products = await prisma.product.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    skip: (page - 1) * PRODUCTS_PAGE_SIZE,
    take: PRODUCTS_PAGE_SIZE,
    select: {
      id: true,
      name: true,
      sku: true,
      slug: true,
      status: true,
      rejectionReason: true,
      priceRetail: true,
      priceOffer: true,
      priceWholesale: true,
      priceEffective: true,
      minOrderQty: true,
      ratingAvg: true,
      ratingCount: true,
      salesCount: true,
      updatedAt: true,
      category: { select: { name: true, slug: true } },
      images: {
        where: { isMain: true },
        take: 1,
        select: { url: true, alt: true },
      },
      inventory: {
        select: { stockQty: true, reservedQty: true, status: true },
      },
    },
  });

  return { products, total, page, pageCount };
}

/** Counts per status, for the filter tabs. Zero-filled so no tab disappears. */
export async function sellerProductCounts(sellerId: string) {
  const rows = await prisma.product.groupBy({
    by: ["status"],
    where: { sellerId },
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

/** One product, or null if it is not this seller's. */
export async function getSellerProduct(sellerId: string, productId: string) {
  return prisma.product.findFirst({
    where: { id: productId, sellerId },
    select: {
      id: true,
      name: true,
      sku: true,
      slug: true,
      description: true,
      categoryId: true,
      brand: true,
      collection: true,
      fabric: true,
      pattern: true,
      occasion: true,
      workType: true,
      color: true,
      weightGrams: true,
      zariType: true,
      blousePieceCm: true,
      washCare: true,
      isMadeToOrder: true,
      loomWeeks: true,
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
      category: { select: { id: true, name: true } },
      images: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, url: true, alt: true, isMain: true, sortOrder: true },
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
          id: true,
          stockQty: true,
          reservedQty: true,
          lowStockThreshold: true,
          status: true,
        },
      },
    },
  });
}

/**
 * Leaf categories only.
 *
 * A product hangs off a *sub*-category — the storefront routes are
 * `/shop/[category]/[sub]`, so a product filed directly under "Sarees" would be
 * unreachable by browsing. Offering the parents in the picker would let a seller
 * create exactly that product, so they are not offered.
 */
export async function listAssignableCategories() {
  const categories = await prisma.category.findMany({
    where: { parentId: { not: null }, isActive: true },
    orderBy: [{ parent: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      parent: { select: { name: true, slug: true } },
    },
  });

  return categories.map((c) => ({
    id: c.id,
    label: c.parent ? `${c.parent.name} › ${c.name}` : c.name,
    slug: c.slug,
  }));
}
