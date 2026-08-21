import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { resolvePrice, type ResolvedPrice } from "@/lib/catalogue/pricing";
import { PUBLIC_PRODUCT_WHERE } from "@/lib/catalogue/queries";
import { availabilityOf } from "@/lib/catalogue/availability";
import { INVENTORY_STATUS, type PriceTier } from "@/lib/constants";

/**
 * Reading the cart.
 *
 * A cart line is not a snapshot — it is a live pointer at a product whose
 * price, stock and approval state can all change between adding it and paying
 * for it. So every read re-resolves the price at the viewer's tier and
 * re-checks availability, and anything wrong comes back as a structured
 * `issues` list rather than being silently corrected. Silently dropping a
 * sold-out line is how a customer ends up paying for an order they did not
 * place; showing them the problem and refusing to check out is the honest
 * behaviour.
 *
 * Lines are grouped by seller, because that grouping is what becomes SubOrders
 * (see the multi-seller note in prisma/schema.prisma) — the customer should be
 * able to see the shape of their order before they place it.
 */

export type CartIssue =
  | { kind: "UNAVAILABLE"; message: string }
  | { kind: "OUT_OF_STOCK"; message: string }
  | { kind: "INSUFFICIENT_STOCK"; message: string; availableQty: number }
  | { kind: "BELOW_MOQ"; message: string; minOrderQty: number }
  | { kind: "ABOVE_MAX"; message: string; maxOrderQty: number };

export type CartLine = {
  id: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  name: string;
  slug: string;
  sku: string;
  imageUrl: string | null;
  imageAlt: string;
  variantLabel: string | null;
  price: ResolvedPrice;
  unitPrice: number;
  lineTotal: number;
  availableQty: number;
  minOrderQty: number;
  maxOrderQty: number;
  /**
   * Set when this line is being woven rather than picked. The cart and the
   * checkout both print it, because a bag holding one stocked piece and one
   * eight-week commission must not imply the whole order ships together.
   */
  loomWeeks: number | null;
  issues: CartIssue[];
};

export type CartSellerGroup = {
  sellerId: string;
  businessName: string;
  city: string | null;
  state: string | null;
  lines: CartLine[];
  subtotal: number;
};

export type Cart = {
  groups: CartSellerGroup[];
  lines: CartLine[];
  subtotal: number;
  itemCount: number;
  /** Distinct lines — what the header badge shows. */
  lineCount: number;
  /** True when nothing blocks checkout. */
  isCheckoutable: boolean;
  issueCount: number;
};

export const EMPTY_CART: Cart = {
  groups: [],
  lines: [],
  subtotal: 0,
  itemCount: 0,
  lineCount: 0,
  isCheckoutable: false,
  issueCount: 0,
};

export async function getCart(
  customerId: string,
  tier: PriceTier,
): Promise<Cart> {
  const items = await prisma.cartItem.findMany({
    where: { customerId },
    orderBy: { addedAt: "desc" },
    select: {
      id: true,
      productId: true,
      variantId: true,
      quantity: true,
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          sku: true,
          status: true,
          priceRetail: true,
          priceOffer: true,
          priceWholesale: true,
          minOrderQty: true,
          maxOrderQty: true,
          isMadeToOrder: true,
          loomWeeks: true,
          seller: {
            select: {
              id: true,
              businessName: true,
              city: true,
              state: true,
              verificationStatus: true,
            },
          },
          images: {
            orderBy: [{ isMain: "desc" }, { sortOrder: "asc" }],
            take: 1,
            select: { url: true, alt: true },
          },
          variants: {
            select: {
              id: true,
              name: true,
              value: true,
              priceDeltaPaise: true,
              stockQty: true,
            },
          },
          inventory: {
            select: { status: true, stockQty: true, reservedQty: true },
          },
        },
      },
    },
  });

  // One query settles which of these products are still publicly buyable,
  // using the same rule the storefront uses rather than a second opinion.
  const buyableIds = new Set(
    (
      await prisma.product.findMany({
        where: { id: { in: items.map((i) => i.productId) }, ...PUBLIC_PRODUCT_WHERE },
        select: { id: true },
      })
    ).map((row) => row.id),
  );

  const lines: CartLine[] = items.map((item) => {
    const product = item.product;
    // "" is the no-variant sentinel — see the note on CartItem in the schema.
    // Everything above this line works in nulls.
    const variantId = item.variantId || null;
    const variant = variantId
      ? (product.variants.find((v) => v.id === variantId) ?? null)
      : null;
    const delta = variant?.priceDeltaPaise ?? 0;

    const price = resolvePrice(
      {
        priceRetail: product.priceRetail + delta,
        priceOffer:
          product.priceOffer === null ? null : product.priceOffer + delta,
        priceWholesale:
          product.priceWholesale === null
            ? null
            : product.priceWholesale + delta,
        minOrderQty: product.minOrderQty,
      },
      tier,
    );

    const availability = availabilityOf(product);
    // A piece being woven to order is not limited by what is on the shelf, so
    // the only ceiling left is the per-order maximum. Anything still selling
    // from stock is capped by stock, exactly as before.
    const availableQty = availability.isOnTheLoom
      ? product.maxOrderQty
      : availableFor(product.inventory, variant);

    const issues = lineIssues({
      isBuyable: buyableIds.has(product.id),
      // A variant that has been deleted since it was added leaves a dangling
      // variantId; treat that as unavailable rather than quietly charging the
      // base price for something the customer did not choose.
      variantMissing: variantId !== null && variant === null,
      inventoryStatus: product.inventory?.status ?? null,
      isOnTheLoom: availability.isOnTheLoom,
      availableQty,
      quantity: item.quantity,
      minOrderQty: price.minOrderQty,
      maxOrderQty: product.maxOrderQty,
      name: product.name,
    });

    return {
      id: item.id,
      productId: product.id,
      variantId,
      quantity: item.quantity,
      name: product.name,
      slug: product.slug,
      sku: product.sku,
      imageUrl: product.images[0]?.url ?? null,
      imageAlt: product.images[0]?.alt ?? product.name,
      variantLabel: variant ? `${variant.name}: ${variant.value}` : null,
      price,
      unitPrice: price.amount,
      lineTotal: price.amount * item.quantity,
      availableQty,
      minOrderQty: price.minOrderQty,
      maxOrderQty: product.maxOrderQty,
      loomWeeks: availability.isOnTheLoom ? availability.loomWeeks : null,
      issues,
    };
  });

  const groups = groupBySeller(items, lines);
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const issueCount = lines.reduce((sum, line) => sum + line.issues.length, 0);

  return {
    groups,
    lines,
    subtotal,
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    lineCount: lines.length,
    isCheckoutable: lines.length > 0 && issueCount === 0,
    issueCount,
  };
}

/**
 * How many units can actually be sold right now.
 *
 * Two limits apply and the tighter one wins. A variant caps the line at that
 * variant's own stock, because that is the physical thing being shipped. The
 * product's inventory row caps it at stock minus what other placed orders are
 * already holding — `reservedQty` exists precisely so two customers cannot both
 * buy the last piece. Reservations are tracked per product rather than per
 * variant, so a variant line is checked against both.
 */
export function availableFor(
  inventory: { stockQty: number; reservedQty: number } | null,
  variant: { stockQty: number } | null,
): number {
  const unreserved = inventory
    ? Math.max(0, inventory.stockQty - inventory.reservedQty)
    : 0;
  if (!variant) return unreserved;
  return Math.max(0, Math.min(variant.stockQty, unreserved));
}

function lineIssues(input: {
  isBuyable: boolean;
  variantMissing: boolean;
  inventoryStatus: string | null;
  /** Woven to order: the inventory row says nothing about whether it can be had. */
  isOnTheLoom: boolean;
  availableQty: number;
  quantity: number;
  minOrderQty: number;
  maxOrderQty: number;
  name: string;
}): CartIssue[] {
  if (!input.isBuyable || input.variantMissing) {
    return [
      {
        kind: "UNAVAILABLE",
        message: `${input.name} is no longer available. Remove it to continue.`,
      },
    ];
  }

  const issues: CartIssue[] = [];

  // DISCONTINUED still blocks a made-to-order line: that status means the loom
  // is not being set up for this piece again, which is a stronger statement
  // than an empty shelf.
  const isOut = input.isOnTheLoom
    ? input.inventoryStatus === INVENTORY_STATUS.DISCONTINUED
    : input.availableQty <= 0 ||
      input.inventoryStatus === INVENTORY_STATUS.OUT_OF_STOCK ||
      input.inventoryStatus === INVENTORY_STATUS.DISCONTINUED;

  if (isOut) {
    issues.push({ kind: "OUT_OF_STOCK", message: "Out of stock." });
  } else if (input.quantity > input.availableQty) {
    issues.push({
      kind: "INSUFFICIENT_STOCK",
      message: `Only ${input.availableQty} left — reduce the quantity to continue.`,
      availableQty: input.availableQty,
    });
  }

  if (input.quantity < input.minOrderQty) {
    issues.push({
      kind: "BELOW_MOQ",
      message: `Minimum order is ${input.minOrderQty}.`,
      minOrderQty: input.minOrderQty,
    });
  }

  if (input.quantity > input.maxOrderQty) {
    issues.push({
      kind: "ABOVE_MAX",
      message: `Maximum ${input.maxOrderQty} per order.`,
      maxOrderQty: input.maxOrderQty,
    });
  }

  return issues;
}

function groupBySeller(
  items: {
    id: string;
    product: {
      seller: {
        id: string;
        businessName: string;
        city: string | null;
        state: string | null;
      };
    };
  }[],
  lines: CartLine[],
): CartSellerGroup[] {
  const byLineId = new Map(lines.map((line) => [line.id, line]));
  const groups = new Map<string, CartSellerGroup>();

  for (const item of items) {
    const line = byLineId.get(item.id);
    if (!line) continue;

    const seller = item.product.seller;
    let group = groups.get(seller.id);
    if (!group) {
      group = {
        sellerId: seller.id,
        businessName: seller.businessName,
        city: seller.city,
        state: seller.state,
        lines: [],
        subtotal: 0,
      };
      groups.set(seller.id, group);
    }

    group.lines.push(line);
    group.subtotal += line.lineTotal;
  }

  return [...groups.values()].sort((a, b) =>
    a.businessName.localeCompare(b.businessName),
  );
}

/**
 * Cart and wishlist counts for the header. Deliberately its own tiny query —
 * the header renders on every page and has no use for the full cart.
 */
export const getBagCounts = cache(
  async (customerId: string): Promise<{ cart: number; wishlist: number }> => {
    const [cart, wishlist] = await Promise.all([
      prisma.cartItem.count({ where: { customerId } }),
      prisma.wishlistItem.count({ where: { customerId } }),
    ]);
    return { cart, wishlist };
  },
);
