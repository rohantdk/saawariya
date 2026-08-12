import "server-only";
import { prisma } from "@/lib/prisma";
import { INVENTORY_STATUS, SUB_ORDER_STATUS as S } from "@/lib/constants";

/**
 * Warehouse reads beyond the queues — SRS §96-98.
 *
 * Two things the picking queues cannot answer: what is on the shelves, and what
 * has moved. Both are platform-wide here, unlike the seller's own inventory
 * screen, because the warehouse physically holds every seller's goods under the
 * platform-warehouse model.
 *
 * Both are **read-only**. The one stock write this desk can make is a shortage
 * or damage report against a parcel it is picking (see
 * `src/app/actions/operations-warehouse.ts`), and that is a deliberate limit:
 * "no role manages all stock" was settled in Phase 6, and an operator who can
 * type a new number into any product has that power under another name.
 */

export const INVENTORY_PAGE_SIZE = 20;
export const MOVEMENTS_PAGE_SIZE = 30;

export type WarehouseInventoryFilter = "alerts" | "low" | "out" | "reserved" | "all";

const INVENTORY_WHERE: Record<WarehouseInventoryFilter, object> = {
  // The default view is the one with work in it. A warehouse opening a stock
  // screen is nearly always asking "what is about to run out", not "list
  // everything alphabetically".
  alerts: {
    status: { in: [INVENTORY_STATUS.LOW_STOCK, INVENTORY_STATUS.OUT_OF_STOCK] },
  },
  low: { status: INVENTORY_STATUS.LOW_STOCK },
  out: { status: INVENTORY_STATUS.OUT_OF_STOCK },
  reserved: { reservedQty: { gt: 0 } },
  all: {},
};

export async function listWarehouseInventory(
  options: { filter?: WarehouseInventoryFilter; q?: string; page?: number } = {},
) {
  const filter = options.filter ?? "alerts";
  const q = options.q?.trim();

  const where = {
    ...INVENTORY_WHERE[filter],
    ...(q
      ? {
          product: {
            OR: [
              { name: { contains: q } },
              { sku: { contains: q } },
              { seller: { businessName: { contains: q } } },
            ],
          },
        }
      : {}),
  };

  const total = await prisma.inventory.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / INVENTORY_PAGE_SIZE));
  const page = Math.min(Math.max(1, options.page ?? 1), pageCount);

  const items = await prisma.inventory.findMany({
    where,
    // Emptiest first — the rows worth acting on are the ones nearest zero.
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
          images: { where: { isMain: true }, take: 1, select: { url: true } },
          seller: { select: { businessName: true } },
        },
      },
    },
  });

  return { items, total, page, pageCount, filter };
}

export async function warehouseInventoryCounts() {
  const [all, low, out, reserved] = await Promise.all([
    prisma.inventory.count(),
    prisma.inventory.count({ where: { status: INVENTORY_STATUS.LOW_STOCK } }),
    prisma.inventory.count({ where: { status: INVENTORY_STATUS.OUT_OF_STOCK } }),
    prisma.inventory.count({ where: { reservedQty: { gt: 0 } } }),
  ]);

  return { all, low, out, reserved, alerts: low + out };
}

/**
 * The stock ledger, platform-wide — SRS §97.
 *
 * Append-only by construction: there is no update or delete path to
 * `StockMovement` anywhere in the codebase, so every row here corresponds to
 * something that actually happened. That is what makes it usable as the answer
 * to "where did those units go", which is the question a shortage raises.
 */
export async function listStockMovements(
  options: { reason?: string; q?: string; page?: number } = {},
) {
  const reason = options.reason;
  const q = options.q?.trim();

  const where = {
    ...(reason && reason !== "all" ? { reason } : {}),
    ...(q
      ? {
          inventory: {
            product: {
              OR: [{ name: { contains: q } }, { sku: { contains: q } }],
            },
          },
        }
      : {}),
  };

  const total = await prisma.stockMovement.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / MOVEMENTS_PAGE_SIZE));
  const page = Math.min(Math.max(1, options.page ?? 1), pageCount);

  const movements = await prisma.stockMovement.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * MOVEMENTS_PAGE_SIZE,
    take: MOVEMENTS_PAGE_SIZE,
    select: {
      id: true,
      changeQty: true,
      reason: true,
      note: true,
      referenceId: true,
      createdAt: true,
      inventory: {
        select: {
          stockQty: true,
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              seller: { select: { businessName: true } },
            },
          },
        },
      },
    },
  });

  return { movements, total, page, pageCount };
}

/** Reasons actually present in the ledger, so the filter never offers an empty set. */
export async function stockMovementReasons() {
  const rows = await prisma.stockMovement.groupBy({
    by: ["reason"],
    _count: { _all: true },
  });
  return rows
    .map((row) => ({ reason: row.reason, count: row._count._all }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Headline figures for the warehouse landing page.
 *
 * `dueToday` counts parcels the desk has been sitting on for more than a day —
 * a queue length alone does not distinguish "busy" from "stuck", and the second
 * is the one worth a number on the screen.
 */
export async function warehouseSummary() {
  const yesterday = new Date(Date.now() - 24 * 3_600_000);

  const [inbound, onFloor, packing, ageing, alerts] = await Promise.all([
    prisma.subOrder.count({ where: { status: S.CONFIRMED } }),
    prisma.subOrder.count({
      where: {
        status: {
          in: [S.WAREHOUSE_QUEUE, S.PICKING, S.PICKED, S.RETURNED_TO_WAREHOUSE],
        },
      },
    }),
    prisma.subOrder.count({
      where: { status: { in: [S.QC_PASSED, S.PACKING] } },
    }),
    prisma.subOrder.count({
      where: {
        status: {
          in: [
            S.CONFIRMED,
            S.WAREHOUSE_QUEUE,
            S.PICKING,
            S.PICKED,
            S.RETURNED_TO_WAREHOUSE,
            S.QC_PASSED,
            S.PACKING,
          ],
        },
        createdAt: { lt: yesterday },
      },
    }),
    prisma.inventory.count({
      where: {
        status: {
          in: [INVENTORY_STATUS.LOW_STOCK, INVENTORY_STATUS.OUT_OF_STOCK],
        },
      },
    }),
  ]);

  return { inbound, onFloor, packing, ageing, alerts };
}
