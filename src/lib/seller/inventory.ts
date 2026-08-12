import "server-only";
import { prisma } from "@/lib/prisma";
import { INVENTORY_STATUS } from "@/lib/constants";

/**
 * Seller stock reads — SRS §60, §97, §98.
 *
 * Writes live in `src/app/actions/seller-inventory.ts`, because every stock
 * change is a ledger entry plus a derived status and must happen in one
 * transaction.
 */

export const INVENTORY_PAGE_SIZE = 20;

export type InventoryFilter = "all" | "low" | "out" | "reserved";

export async function listSellerInventory(
  sellerId: string,
  options: { filter?: InventoryFilter; q?: string; page?: number } = {},
) {
  const filter = options.filter ?? "all";
  const q = options.q?.trim();

  const where = {
    product: {
      sellerId,
      ...(q ? { OR: [{ name: { contains: q } }, { sku: { contains: q } }] } : {}),
    },
    ...(filter === "low" ? { status: INVENTORY_STATUS.LOW_STOCK } : {}),
    ...(filter === "out" ? { status: INVENTORY_STATUS.OUT_OF_STOCK } : {}),
    ...(filter === "reserved" ? { reservedQty: { gt: 0 } } : {}),
  };

  const total = await prisma.inventory.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / INVENTORY_PAGE_SIZE));
  const page = Math.min(Math.max(1, options.page ?? 1), pageCount);

  const items = await prisma.inventory.findMany({
    where,
    // Emptiest first: the rows a seller needs to act on are the ones nearest
    // zero, and a screen sorted alphabetically buries them.
    orderBy: [{ stockQty: "asc" }, { updatedAt: "desc" }],
    skip: (page - 1) * INVENTORY_PAGE_SIZE,
    take: INVENTORY_PAGE_SIZE,
    select: {
      id: true,
      stockQty: true,
      reservedQty: true,
      lowStockThreshold: true,
      status: true,
      updatedAt: true,
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          status: true,
          images: { where: { isMain: true }, take: 1, select: { url: true } },
        },
      },
    },
  });

  return { items, total, page, pageCount, filter };
}

export async function sellerInventoryCounts(sellerId: string) {
  const [all, low, out, reserved] = await Promise.all([
    prisma.inventory.count({ where: { product: { sellerId } } }),
    prisma.inventory.count({
      where: { product: { sellerId }, status: INVENTORY_STATUS.LOW_STOCK },
    }),
    prisma.inventory.count({
      where: { product: { sellerId }, status: INVENTORY_STATUS.OUT_OF_STOCK },
    }),
    prisma.inventory.count({
      where: { product: { sellerId }, reservedQty: { gt: 0 } },
    }),
  ]);

  return { all, low, out, reserved };
}

/**
 * The stock ledger for one product — SRS §97.
 *
 * Scoped through `inventory.product.sellerId` so another seller's product id
 * yields nothing rather than exposing their movement history.
 */
export async function listStockMovements(
  sellerId: string,
  productId: string,
  take = 20,
) {
  return prisma.stockMovement.findMany({
    where: { inventory: { productId, product: { sellerId } } },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      changeQty: true,
      reason: true,
      note: true,
      referenceId: true,
      createdAt: true,
    },
  });
}

/**
 * Human wording for the ledger's `reason` codes — the set listed on
 * `StockMovement` in schema.prisma. Anything unmapped renders as its raw code
 * rather than blank, so an unrecognised reason is visible instead of silent.
 */
export const STOCK_REASON_LABEL: Record<string, string> = {
  SELLER_RESTOCK: "Restocked",
  ORDER_RESERVED: "Reserved for an order",
  ORDER_DISPATCHED: "Dispatched",
  ORDER_CANCELLED: "Order cancelled",
  QC_DAMAGED: "Damaged at quality check",
  RETURN_RESTOCK: "Returned to stock",
  ADJUSTMENT: "Manual adjustment",
};
