import type { Metadata } from "next";
import Link from "next/link";
import { requireDesk } from "@/lib/admin/context";
import { campaignCounts, listCampaigns } from "@/lib/marketing/campaigns";
import {
  CAMPAIGN_AUDIENCE_LABEL,
  CAMPAIGN_STATUS,
  ROLES,
} from "@/lib/constants";
import { CAMPAIGN_STATUS_TONE } from "@/lib/status-tone";
import { formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/commerce/status-badge";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { CampaignForm } from "@/components/marketing/campaign-form";

export const metadata: Metadata = { title: "Campaigns" };

const TABS = [
  { key: "all", label: "All" },
  { key: CAMPAIGN_STATUS.ACTIVE, label: "Running" },
  { key: CAMPAIGN_STATUS.SCHEDULED, label: "Scheduled" },
  { key: CAMPAIGN_STATUS.DRAFT, label: "Drafts" },
  { key: CAMPAIGN_STATUS.COMPLETED, label: "Finished" },
  { key: CAMPAIGN_STATUS.CANCELLED, label: "Cancelled" },
];

/**
 * Campaigns — SRS §127.
 *
 * The warning on a row is the useful part: a campaign whose window opened while
 * it was still a draft, or one that ran past its end date and was never closed.
 * Neither produces an error anywhere and both mean the schedule is fiction.
 */
export default async function CampaignsPage({
  searchParams,
}: PageProps<"/admin/marketing/campaigns">) {
  await requireDesk(ROLES.MARKETING, "/admin/marketing/campaigns");
  const params = await searchParams;

  const filter = typeof params.filter === "string" ? params.filter : "all";

  const [campaigns, counts] = await Promise.all([
    listCampaigns(filter),
    campaignCounts(),
  ]);

  const now = new Date();

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6">
        <p className="eyebrow mb-2">Campaigns</p>
        <h1 className="font-display text-3xl">Campaigns</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-400">
          A campaign is a planned promotion with a window and an audience. Its
          reach moves when a broadcast is sent against it and at no other time —
          there is no analytics pipeline inventing numbers behind this screen.
        </p>
      </header>

      <FilterTabs
        tabs={TABS.map((tab) => ({ ...tab, count: counts[tab.key] ?? 0 }))}
        active={filter}
        href={(key) => `/admin/marketing/campaigns?filter=${key}`}
      />

      <details className="mb-6 rounded-md border border-ivory-400 bg-ivory-50">
        <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-ink-900 hover:bg-ivory-200">
          Plan a campaign
        </summary>
        <div className="border-t border-ivory-300 p-5">
          <CampaignForm />
        </div>
      </details>

      {campaigns.length === 0 ? (
        <div className="rounded-md border border-ivory-400 bg-ivory-50 p-10 text-center">
          <p className="text-sm text-ink-400">No campaigns in this view.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {campaigns.map((campaign) => {
            const overdueToStart =
              (campaign.status === CAMPAIGN_STATUS.DRAFT ||
                campaign.status === CAMPAIGN_STATUS.SCHEDULED) &&
              campaign.startsAt <= now;
            const overdueToClose =
              campaign.status === CAMPAIGN_STATUS.ACTIVE &&
              campaign.endsAt < now;

            return (
              <li
                key={campaign.id}
                className="rounded-md border border-ivory-400 bg-ivory-50 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/marketing/campaigns/${campaign.id}`}
                      className="text-sm text-ink-900 underline-offset-4 hover:text-brand-600 hover:underline"
                    >
                      {campaign.name}
                    </Link>
                    <p className="mt-0.5 text-xs text-ink-400">
                      {CAMPAIGN_AUDIENCE_LABEL[campaign.audience]} ·{" "}
                      {formatDate(campaign.startsAt)} –{" "}
                      {formatDate(campaign.endsAt)}
                    </p>
                    {campaign.offerDetail && (
                      <p className="mt-1 text-sm text-ink-500">
                        {campaign.offerDetail}
                      </p>
                    )}
                  </div>
                  <StatusBadge
                    label={campaign.status}
                    tone={CAMPAIGN_STATUS_TONE[campaign.status] ?? "neutral"}
                  />
                </div>

                {overdueToStart && (
                  <p className="mt-3 text-sm text-warning">
                    This should have started on{" "}
                    {formatDate(campaign.startsAt)} and has not been started.
                  </p>
                )}
                {overdueToClose && (
                  <p className="mt-3 text-sm text-ink-500">
                    Ran past its end date on {formatDate(campaign.endsAt)} and is
                    still marked active.
                  </p>
                )}

                <p className="mt-3 border-t border-ivory-300 pt-3 text-xs text-ink-400">
                  {campaign.viewCount} reached · {campaign.clickCount} clicks ·{" "}
                  {campaign.conversionCount} conversions
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
