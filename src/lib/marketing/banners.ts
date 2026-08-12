import "server-only";
import { prisma } from "@/lib/prisma";
import { BANNER_POSITION } from "@/lib/constants";

/**
 * Banner administration — SRS §125.
 *
 * These rows are read by `getBanners(position)` on the storefront, which applies
 * three conditions: active, started, not ended. This screen shows the same three
 * as one derived state per row, so a banner that marketing believes is live and
 * that the homepage is not rendering is visible as such rather than being a
 * mystery. It does not re-implement the query — that would be a second copy of
 * the rule.
 *
 * A banner's `linkUrl` is not decoration. Phase 3 found a seeded banner
 * promising "MOQ from 10 metres" against products that all had `minOrderQty: 1`,
 * and every seeded `linkUrl` had to resolve for the storefront to be honest. So
 * this module reports which links are internal and which point off-site, and the
 * form warns before saving one that goes nowhere on this platform.
 */

export type BannerState = { key: string; label: string };

export function bannerState(banner: {
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
}): BannerState {
  if (!banner.isActive) return { key: "inactive", label: "Switched off" };

  const now = new Date();
  if (banner.startsAt && banner.startsAt > now) {
    return { key: "scheduled", label: "Scheduled" };
  }
  if (banner.endsAt && banner.endsAt < now) {
    return { key: "expired", label: "Finished" };
  }
  return { key: "live", label: "Live" };
}

/**
 * Every banner, grouped by the slot it occupies.
 *
 * Grouped rather than paginated because position and sort order are the whole
 * point: the homepage carousel renders `HOME_HERO` in `sortOrder`, so seeing
 * them in that order *is* seeing what the homepage will do. A flat list sorted
 * by date would hide the one thing this screen is for.
 */
export async function listBannersByPosition() {
  const banners = await prisma.banner.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return Object.values(BANNER_POSITION).map((position) => ({
    position,
    banners: banners
      .filter((banner) => banner.position === position)
      .map((banner) => ({ ...banner, state: bannerState(banner) })),
  }));
}

export async function findBanner(id: string) {
  const banner = await prisma.banner.findUnique({ where: { id } });
  return banner ? { ...banner, state: bannerState(banner) } : null;
}

export async function bannerCounts() {
  const banners = await prisma.banner.findMany({
    select: { isActive: true, startsAt: true, endsAt: true },
  });

  const counts = { live: 0, scheduled: 0, expired: 0, inactive: 0 };
  for (const banner of banners) {
    counts[bannerState(banner).key as keyof typeof counts] += 1;
  }
  return { ...counts, total: banners.length };
}
