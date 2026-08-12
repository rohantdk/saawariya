import "server-only";
import { prisma } from "@/lib/prisma";
import { ORDER_STATUS } from "@/lib/constants";

/**
 * Coupon administration — SRS §126.
 *
 * The read side of the same rows `src/lib/commerce/coupons.ts` validates at
 * checkout. That module is authoritative about whether a code may be used; this
 * one never re-implements a single one of its rules, because two copies of
 * "has this expired" is how a coupon reads as live on the marketing screen and
 * fails in the cart.
 *
 * What this module adds is the thing marketing actually needs and checkout does
 * not: **what a code has done**. Redemptions are counted from `Order` rather
 * than trusted from `Coupon.usageCount`, because the counter is incremented at
 * checkout and decremented on cancellation, and a coupon's real performance is
 * the orders that survived.
 */

export const COUPONS_PAGE_SIZE = 25;

export type CouponFilter = "live" | "scheduled" | "expired" | "inactive" | "all";

export function couponState(coupon: {
  isActive: boolean;
  startsAt: Date;
  endsAt: Date;
  usageLimit: number | null;
  usageCount: number;
}): { key: string; label: string } {
  if (!coupon.isActive) return { key: "inactive", label: "Switched off" };

  const now = new Date();
  if (coupon.startsAt > now) return { key: "scheduled", label: "Scheduled" };
  if (coupon.endsAt < now) return { key: "expired", label: "Expired" };
  if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) {
    return { key: "expired", label: "Fully redeemed" };
  }
  return { key: "live", label: "Live" };
}

function whereFor(filter: CouponFilter) {
  const now = new Date();
  switch (filter) {
    case "live":
      return { isActive: true, startsAt: { lte: now }, endsAt: { gte: now } };
    case "scheduled":
      return { isActive: true, startsAt: { gt: now } };
    case "expired":
      return { endsAt: { lt: now } };
    case "inactive":
      return { isActive: false };
    default:
      return {};
  }
}

export async function listCoupons(
  options: { filter?: CouponFilter; page?: number } = {},
) {
  const filter = options.filter ?? "live";
  const where = whereFor(filter);

  const total = await prisma.coupon.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / COUPONS_PAGE_SIZE));
  const page = Math.min(Math.max(1, options.page ?? 1), pageCount);

  const coupons = await prisma.coupon.findMany({
    where,
    orderBy: [{ isActive: "desc" }, { endsAt: "desc" }],
    skip: (page - 1) * COUPONS_PAGE_SIZE,
    take: COUPONS_PAGE_SIZE,
  });

  // Redemptions that survived, per code, in one query rather than per row.
  const redemptions = await prisma.order.groupBy({
    by: ["couponCode"],
    where: {
      couponCode: { in: coupons.map((coupon) => coupon.code) },
      status: { not: ORDER_STATUS.CANCELLED },
    },
    _count: { _all: true },
    _sum: { discountAmount: true, totalAmount: true },
  });

  const byCode = new Map(redemptions.map((row) => [row.couponCode, row]));

  return {
    total,
    page,
    pageCount,
    filter,
    coupons: coupons.map((coupon) => {
      const stats = byCode.get(coupon.code);
      return {
        ...coupon,
        state: couponState(coupon),
        orders: stats?._count._all ?? 0,
        discountGiven: stats?._sum.discountAmount ?? 0,
        revenueInfluenced: stats?._sum.totalAmount ?? 0,
      };
    }),
  };
}

export async function couponFilterCounts() {
  const filters: CouponFilter[] = [
    "live",
    "scheduled",
    "expired",
    "inactive",
    "all",
  ];
  const counts: Record<string, number> = {};
  await Promise.all(
    filters.map(async (filter) => {
      counts[filter] = await prisma.coupon.count({ where: whereFor(filter) });
    }),
  );
  return counts;
}

export async function findCoupon(id: string) {
  const coupon = await prisma.coupon.findUnique({ where: { id } });
  if (!coupon) return null;

  const [orders, recent] = await Promise.all([
    prisma.order.aggregate({
      where: {
        couponCode: coupon.code,
        status: { not: ORDER_STATUS.CANCELLED },
      },
      _count: { _all: true },
      _sum: { discountAmount: true, totalAmount: true },
    }),
    prisma.order.findMany({
      where: { couponCode: coupon.code },
      orderBy: { placedAt: "desc" },
      take: 10,
      select: {
        orderNumber: true,
        status: true,
        discountAmount: true,
        totalAmount: true,
        placedAt: true,
        customer: { select: { user: { select: { fullName: true } } } },
      },
    }),
  ]);

  return {
    ...coupon,
    state: couponState(coupon),
    orders: orders._count._all,
    discountGiven: orders._sum.discountAmount ?? 0,
    revenueInfluenced: orders._sum.totalAmount ?? 0,
    recent,
  };
}
