import "server-only";
import { prisma } from "@/lib/prisma";
import { INVENTORY_STATUS, PRODUCT_STATUS } from "@/lib/constants";

/**
 * Marketplace-wide stock monitoring — SRS §77.
 *
 * Read-only, deliberately. `INVENTORY_VIEW_ALL` and `INVENTORY_MANAGE_OWN` are
 * separate permissions and no role holds a "manage all stock" one, because
 * stock is a statement about what a seller physically has. An admin adjusting
 * it would be recording a movement of goods nobody moved, and the stock ledger
 * is append-only precisely so that every row corresponds to something that
 * happened. What the platform *can* do about a stock problem — chase the
 * seller, hide the product, suspend the account — it does on other screens.
 */

const PAGE_SIZE = 25;

export type InventoryFilters = {
  status?: string;
  sellerId?: string;
  q?: string;
  page?: number;
};

export async function listInventory(filters: InventoryFilters = {}) {
  const { status = "alerts", sellerId, q = "", page = 1 } = filters;

  const statusWhere =
    status === "alerts"
      ? {
          status: {
            in: [INVENTORY_STATUS.LOW_STOCK, INVENTORY_STATUS.OUT_OF_STOCK],
          },
        }
      : status === "all"
        ? {}
        : { status };

  const where = {
    ...statusWhere,
    product: {
      ...(sellerId ? { sellerId } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { sku: { contains: q } },
              { seller: { businessName: { contains: q } } },
            ],
          }
        : {}),
    },
  };

  const total = await prisma.inventory.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(Math.max(1, page), pageCount);

  const items = await prisma.inventory.findMany({
    where,
    // Emptiest first: the whole point of the screen is what is about to run out.
    orderBy: [{ stockQty: "asc" }, { updatedAt: "desc" }],
    skip: (current - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
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
          seller: { select: { id: true, businessName: true } },
          category: { select: { name: true } },
        },
      },
    },
  });

  return { items, total, page: current, pageCount };
}

export async function inventorySummary() {
  const [byStatus, liveOutOfStock, totalUnits] = await Promise.all([
    prisma.inventory.groupBy({ by: ["status"], _count: { _all: true } }),

    // The number that actually costs money: a product on sale that cannot be
    // bought. Out-of-stock drafts and hidden listings are not a problem.
    prisma.inventory.count({
      where: {
        status: INVENTORY_STATUS.OUT_OF_STOCK,
        product: { status: PRODUCT_STATUS.APPROVED },
      },
    }),

    prisma.inventory.aggregate({
      _sum: { stockQty: true, reservedQty: true },
    }),
  ]);

  const counts: Record<string, number> = {
    all: 0,
    alerts: 0,
    ...Object.fromEntries(Object.values(INVENTORY_STATUS).map((s) => [s, 0])),
  };
  for (const row of byStatus) {
    counts[row.status] = row._count._all;
    counts.all += row._count._all;
  }
  counts.alerts =
    counts[INVENTORY_STATUS.LOW_STOCK] + counts[INVENTORY_STATUS.OUT_OF_STOCK];

  return {
    counts,
    liveOutOfStock,
    unitsOnHand: totalUnits._sum.stockQty ?? 0,
    unitsReserved: totalUnits._sum.reservedQty ?? 0,
  };
}
