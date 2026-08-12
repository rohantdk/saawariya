import "server-only";
import { prisma } from "@/lib/prisma";
import { CAMPAIGN_STATUS } from "@/lib/constants";

/**
 * Campaigns — SRS §127, §129.
 *
 * A campaign is a planned promotion with a window, an audience and three
 * performance counters. This build does **not** invent traffic for it: the
 * counters are moved by the broadcast that a campaign sends (one view per
 * recipient) and by nothing else, so a campaign nobody has run reads zero rather
 * than showing a plausible-looking number the software cannot account for.
 *
 * That is the same rule the whole build follows about payment gateways and
 * couriers — a screen may be simple, but it may not lie about where its numbers
 * came from. The campaign page says on it where the counters come from.
 */

export type CampaignFilter = string;

export async function listCampaigns(filter: CampaignFilter = "all") {
  const where = filter !== "all" ? { status: filter } : {};

  const campaigns = await prisma.campaign.findMany({
    where,
    orderBy: [{ startsAt: "desc" }],
  });

  return campaigns.map((campaign) => ({
    ...campaign,
    isRunning:
      campaign.status === CAMPAIGN_STATUS.ACTIVE &&
      campaign.startsAt <= new Date() &&
      campaign.endsAt >= new Date(),
  }));
}

export async function campaignCounts() {
  const grouped = await prisma.campaign.groupBy({
    by: ["status"],
    _count: { _all: true },
  });

  const counts: Record<string, number> = { all: 0 };
  for (const status of Object.values(CAMPAIGN_STATUS)) counts[status] = 0;
  for (const row of grouped) {
    counts[row.status] = row._count._all;
    counts.all += row._count._all;
  }
  return counts;
}

export async function findCampaign(id: string) {
  return prisma.campaign.findUnique({ where: { id } });
}

/**
 * The legal status moves live in `campaign-states.ts`, which is pure. They are
 * re-exported here so a Server Component fetching campaigns keeps one import —
 * but the buttons are rendered from a Client Component, and a `server-only`
 * module may export a type to a client, never a value. That mistake broke the
 * production build in Phase 6 and again in Phase 7, in the very file whose
 * comment warned about it.
 */
export {
  CAMPAIGN_MOVES,
  CAMPAIGN_MOVE_LABEL,
} from "@/lib/marketing/campaign-states";
