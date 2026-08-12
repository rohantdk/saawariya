import "server-only";
import { prisma } from "@/lib/prisma";
import { CAMPAIGN_STATUS, ORDER_STATUS } from "@/lib/constants";
import { bannerState } from "@/lib/marketing/banners";
import { couponState } from "@/lib/marketing/coupons";

/**
 * The marketing dashboard — SRS §124, §129.
 *
 * Like the finance and operations dashboards, this is not a scorecard. It
 * answers one question: **what is live on the storefront right now, and is it
 * what marketing thinks is live?** A coupon switched off, a banner whose end
 * date passed last week, a campaign still sitting in draft on the day it was
 * meant to start — none of those produce an error anywhere, and every one of
 * them is a promotion that silently is not running.
 */

export async function marketingSummary() {
  const now = new Date();

  const [coupons, banners, campaigns, subscribers, promoNotifications, redemptions] =
    await Promise.all([
      prisma.coupon.findMany({
        select: {
          isActive: true,
          startsAt: true,
          endsAt: true,
          usageLimit: true,
          usageCount: true,
        },
      }),
      prisma.banner.findMany({
        select: { isActive: true, startsAt: true, endsAt: true },
      }),
      prisma.campaign.findMany({
        select: {
          status: true,
          startsAt: true,
          endsAt: true,
          viewCount: true,
          clickCount: true,
          conversionCount: true,
        },
      }),
      prisma.newsletterSubscriber.count({ where: { unsubscribedAt: null } }),
      prisma.notification.count({ where: { category: "PROMOTION" } }),

      // What the coupons actually did, counted from orders that survived.
      prisma.order.aggregate({
        where: {
          couponCode: { not: null },
          status: { not: ORDER_STATUS.CANCELLED },
        },
        _count: { _all: true },
        _sum: { discountAmount: true, totalAmount: true },
      }),
    ]);

  const couponsLive = coupons.filter(
    (coupon) => couponState(coupon).key === "live",
  ).length;
  const bannersLive = banners.filter(
    (banner) => bannerState(banner).key === "live",
  ).length;

  /**
   * The check nothing else surfaces: a campaign whose window has opened but
   * which was never started, or one that finished and was never closed. Both
   * look fine on a list and both mean the schedule is fiction.
   */
  const overdueToStart = campaigns.filter(
    (campaign) =>
      (campaign.status === CAMPAIGN_STATUS.DRAFT ||
        campaign.status === CAMPAIGN_STATUS.SCHEDULED) &&
      campaign.startsAt <= now,
  ).length;

  const overdueToClose = campaigns.filter(
    (campaign) =>
      campaign.status === CAMPAIGN_STATUS.ACTIVE && campaign.endsAt < now,
  ).length;

  return {
    coupons: {
      live: couponsLive,
      total: coupons.length,
      redeemedOrders: redemptions._count._all,
      discountGiven: redemptions._sum.discountAmount ?? 0,
      revenueInfluenced: redemptions._sum.totalAmount ?? 0,
    },
    banners: { live: bannersLive, total: banners.length },
    campaigns: {
      active: campaigns.filter((c) => c.status === CAMPAIGN_STATUS.ACTIVE).length,
      total: campaigns.length,
      overdueToStart,
      overdueToClose,
      views: campaigns.reduce((sum, c) => sum + c.viewCount, 0),
      clicks: campaigns.reduce((sum, c) => sum + c.clickCount, 0),
      conversions: campaigns.reduce((sum, c) => sum + c.conversionCount, 0),
    },
    subscribers,
    promoNotifications,
  };
}

/** Sidebar badges. Counts what is *wrong*, not what exists. */
export async function marketingNavCounts() {
  const now = new Date();

  const [campaigns, unpublished] = await Promise.all([
    prisma.campaign.count({
      where: {
        OR: [
          {
            status: { in: [CAMPAIGN_STATUS.DRAFT, CAMPAIGN_STATUS.SCHEDULED] },
            startsAt: { lte: now },
          },
          { status: CAMPAIGN_STATUS.ACTIVE, endsAt: { lt: now } },
        ],
      },
    }),
    prisma.cmsPage.count({ where: { isPublished: false } }),
  ]);

  return { campaigns, content: unpublished };
}

/** Top coupons by the discount they actually gave away. */
export async function topCoupons(take = 5) {
  const grouped = await prisma.order.groupBy({
    by: ["couponCode"],
    where: {
      couponCode: { not: null },
      status: { not: ORDER_STATUS.CANCELLED },
    },
    _count: { _all: true },
    _sum: { discountAmount: true, totalAmount: true },
    orderBy: { _sum: { discountAmount: "desc" } },
    take,
  });

  return grouped
    .filter((row): row is typeof row & { couponCode: string } =>
      Boolean(row.couponCode),
    )
    .map((row) => ({
      code: row.couponCode,
      orders: row._count._all,
      discount: row._sum.discountAmount ?? 0,
      revenue: row._sum.totalAmount ?? 0,
    }));
}
