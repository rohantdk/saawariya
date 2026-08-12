import "server-only";
import { prisma } from "@/lib/prisma";
import { resolvePrice, type ResolvedPrice } from "@/lib/catalogue/pricing";
import { PUBLIC_PRODUCT_WHERE } from "@/lib/catalogue/queries";
import { availableFor } from "@/lib/commerce/cart";
import { INVENTORY_STATUS, type PriceTier } from "@/lib/constants";

/**
 * Wishlist reads — SRS §41.
 *
 * A wishlist outlives the catalogue state it was created against, so a saved
 * item can be sold out, delisted, or belong to a seller who has since been
 * suspended. Rather than hide those rows — which looks like data loss to the
 * customer — each one is returned with an `isBuyable` flag and rendered as
 * unavailable. The customer keeps the record of what they liked and can see
 * why they cannot buy it.
 */

export type WishlistEntry = {
  productId: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  imageAlt: string;
  sellerName: string;
  addedAt: Date;
  price: ResolvedPrice;
  hasVariants: boolean;
  availableQty: number;
  isBuyable: boolean;
  isOutOfStock: boolean;
};

export async function getWishlist(
  customerId: string,
  tier: PriceTier,
): Promise<WishlistEntry[]> {
  const items = await prisma.wishlistItem.findMany({
    where: { customerId },
    orderBy: { addedAt: "desc" },
    select: {
      addedAt: true,
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          priceRetail: true,
          priceOffer: true,
          priceWholesale: true,
          minOrderQty: true,
          seller: { select: { businessName: true, verificationStatus: true } },
          images: {
            orderBy: [{ isMain: "desc" }, { sortOrder: "asc" }],
            take: 1,
            select: { url: true, alt: true },
          },
          variants: { select: { id: true } },
          inventory: {
            select: { status: true, stockQty: true, reservedQty: true },
          },
        },
      },
    },
  });

  // The storefront's own visibility rule, asked once, rather than reimplemented
  // from the status columns above.
  const buyableIds = new Set(
    (
      await prisma.product.findMany({
        where: {
          id: { in: items.map((item) => item.product.id) },
          ...PUBLIC_PRODUCT_WHERE,
        },
        select: { id: true },
      })
    ).map((row) => row.id),
  );

  return items.map((item) => {
    const product = item.product;
    const availableQty = availableFor(product.inventory, null);

    return {
      productId: product.id,
      name: product.name,
      slug: product.slug,
      imageUrl: product.images[0]?.url ?? null,
      imageAlt: product.images[0]?.alt ?? product.name,
      sellerName: product.seller.businessName,
      addedAt: item.addedAt,
      price: resolvePrice(product, tier),
      hasVariants: product.variants.length > 0,
      availableQty,
      isBuyable: buyableIds.has(product.id),
      isOutOfStock:
        availableQty <= 0 ||
        product.inventory?.status === INVENTORY_STATUS.OUT_OF_STOCK ||
        product.inventory?.status === INVENTORY_STATUS.DISCONTINUED,
    };
  });
}

export async function isWishlisted(
  customerId: string,
  productId: string,
): Promise<boolean> {
  const row = await prisma.wishlistItem.findUnique({
    where: { customerId_productId: { customerId, productId } },
    select: { id: true },
  });
  return row !== null;
}

/** Which of these products the customer has saved — for grids of cards. */
export async function wishlistedIds(
  customerId: string,
  productIds: string[],
): Promise<Set<string>> {
  if (productIds.length === 0) return new Set();

  const rows = await prisma.wishlistItem.findMany({
    where: { customerId, productId: { in: productIds } },
    select: { productId: true },
  });

  return new Set(rows.map((row) => row.productId));
}
