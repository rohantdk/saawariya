import "server-only";
import { prisma } from "@/lib/prisma";
import { SETTLEMENT_STATUS, SUB_ORDER_STATUS } from "@/lib/constants";

/**
 * The platform-wide payout queue — SRS §119, §120.
 *
 * The counterpart to `src/lib/seller/settlements.ts`, which reads the same rows
 * scoped to one seller and exports **no write at all** — deliberately, because a
 * seller who could mark their own settlement RELEASED could mark themselves
 * paid. This module is the other half: the same rows, unscoped, with the release
 * that lives behind `settlement.release`, a permission only Finance and
 * SUPER_ADMIN hold.
 *
 * Commission is charged on `grossAmount`, which is the sub-order's **subtotal**
 * — the seller's line value before any platform coupon — so a Saawariya-funded
 * promotion does not come out of the seller's payout. That is what
 * `SubOrder.discountAmount` exists for, and every figure on this screen is
 * consistent with it: gross − commission = net, always, in integer paise.
 */

export const SETTLEMENTS_PAGE_SIZE = 25;

export type SettlementFilters = {
  status?: string;
  sellerId?: string;
  q?: string;
  page?: number;
};

function buildWhere({
  status = SETTLEMENT_STATUS.PENDING,
  sellerId = "",
  q = "",
}: SettlementFilters) {
  return {
    ...(status !== "all" ? { status } : {}),
    ...(sellerId ? { sellerId } : {}),
    ...(q
      ? {
          OR: [
            { subOrder: { subOrderNumber: { contains: q } } },
            { subOrder: { order: { orderNumber: { contains: q } } } },
            { seller: { businessName: { contains: q } } },
            { reference: { contains: q } },
          ],
        }
      : {}),
  };
}

export const SETTLEMENT_ROW_SELECT = {
  id: true,
  grossAmount: true,
  commissionPercent: true,
  commissionAmount: true,
  netAmount: true,
  status: true,
  reference: true,
  note: true,
  createdAt: true,
  releasedAt: true,
  seller: {
    select: {
      id: true,
      businessName: true,
      bankAccountName: true,
      bankAccountNumber: true,
      bankIfsc: true,
    },
  },
  subOrder: {
    select: {
      id: true,
      subOrderNumber: true,
      status: true,
      deliveredAt: true,
      order: { select: { orderNumber: true } },
    },
  },
} as const;

export async function listSettlements(filters: SettlementFilters = {}) {
  const where = buildWhere(filters);

  const total = await prisma.settlement.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / SETTLEMENTS_PAGE_SIZE));
  const page = Math.min(Math.max(1, filters.page ?? 1), pageCount);

  const [settlements, sums] = await Promise.all([
    prisma.settlement.findMany({
      where,
      // Oldest first inside the open statuses: a queue where the newest work
      // sits at the top is how the oldest payout never gets released.
      orderBy: { createdAt: "asc" },
      skip: (page - 1) * SETTLEMENTS_PAGE_SIZE,
      take: SETTLEMENTS_PAGE_SIZE,
      select: SETTLEMENT_ROW_SELECT,
    }),
    prisma.settlement.aggregate({
      where,
      _sum: { grossAmount: true, commissionAmount: true, netAmount: true },
    }),
  ]);

  return {
    settlements,
    total,
    page,
    pageCount,
    totals: {
      gross: sums._sum.grossAmount ?? 0,
      commission: sums._sum.commissionAmount ?? 0,
      net: sums._sum.netAmount ?? 0,
    },
  };
}

export async function settlementCounts(filters: SettlementFilters = {}) {
  const scope = { sellerId: filters.sellerId, q: filters.q };

  const grouped = await prisma.settlement.groupBy({
    by: ["status"],
    where: buildWhere({ ...scope, status: "all" }),
    _count: { _all: true },
  });

  const counts: Record<string, number> = { all: 0 };
  for (const status of Object.values(SETTLEMENT_STATUS)) counts[status] = 0;
  for (const row of grouped) {
    counts[row.status] = row._count._all;
    counts.all += row._count._all;
  }
  return counts;
}

/** Sellers with at least one settlement, for the filter. */
export async function settlementSellerOptions() {
  const rows = await prisma.settlement.findMany({
    distinct: ["sellerId"],
    orderBy: { seller: { businessName: "asc" } },
    select: { seller: { select: { id: true, businessName: true } } },
  });
  return rows.map((row) => row.seller);
}

export async function findSettlement(id: string) {
  return prisma.settlement.findUnique({
    where: { id },
    select: SETTLEMENT_ROW_SELECT,
  });
}

/**
 * Whether this row may be paid out at all, regardless of who is asking.
 *
 * Separate from the state machine on purpose: `SETTLEMENT_MOVES` answers "is
 * PENDING → RELEASED a legal move", which is a fact about this table. Whether
 * the goods actually reached the customer is a fact about *another* table, and
 * paying a seller for a parcel that is still in a van is money the platform
 * cannot get back if the delivery fails. So it is checked where the row is
 * loaded, and the screen states the rule rather than silently hiding the button.
 */
export function payoutBlockedReason(settlement: {
  subOrder: { status: string; subOrderNumber: string };
}): string | null {
  if (settlement.subOrder.status === SUB_ORDER_STATUS.DELIVERED) return null;

  if (settlement.subOrder.status === SUB_ORDER_STATUS.RETURNED) {
    return `${settlement.subOrder.subOrderNumber} was returned. This payout should be recorded as failed rather than released — the goods came back.`;
  }

  return `${settlement.subOrder.subOrderNumber} has not been delivered yet (currently ${settlement.subOrder.status
    .toLowerCase()
    .replace(/_/g, " ")}). A payout is released once the customer has the goods.`;
}
