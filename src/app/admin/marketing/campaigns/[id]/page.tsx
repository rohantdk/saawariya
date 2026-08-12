import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireDesk } from "@/lib/admin/context";
import { findCampaign } from "@/lib/marketing/campaigns";
import { CAMPAIGN_AUDIENCE_LABEL, ROLES } from "@/lib/constants";
import { CAMPAIGN_STATUS_TONE } from "@/lib/status-tone";
import { formatDateTime } from "@/lib/utils";
import { StatusBadge } from "@/components/commerce/status-badge";
import {
  CampaignForm,
  CampaignStatusActions,
} from "@/components/marketing/campaign-form";

export const metadata: Metadata = { title: "Campaign" };

export default async function CampaignDetailPage({
  params,
}: PageProps<"/admin/marketing/campaigns/[id]">) {
  await requireDesk(ROLES.MARKETING, "/admin/marketing/campaigns");
  const { id } = await params;

  const campaign = await findCampaign(id);
  if (!campaign) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/admin/marketing/campaigns"
        className="mb-4 inline-block text-xs font-medium uppercase tracking-[0.14em] text-ink-500 transition-colors hover:text-brand-600"
      >
        ← All campaigns
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow mb-2">
            SRS §127 — {CAMPAIGN_AUDIENCE_LABEL[campaign.audience]}
          </p>
          <h1 className="font-display text-3xl">{campaign.name}</h1>
        </div>
        <StatusBadge
          label={campaign.status}
          tone={CAMPAIGN_STATUS_TONE[campaign.status] ?? "neutral"}
        />
      </header>

      <section className="mb-8 border border-ivory-400 bg-ivory-50 p-5">
        <h2 className="mb-3 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400">
          Where this campaign goes next
        </h2>
        <CampaignStatusActions
          campaignId={campaign.id}
          status={campaign.status}
        />
      </section>

      <section className="mb-8">
        <h2 className="mb-3 font-display text-xl">Performance</h2>
        <div className="grid grid-cols-3 gap-3 border border-ivory-400 bg-ivory-50 p-5">
          <div className="min-w-0">
            <p className="text-xs text-ink-400">Reached</p>
            <p className="font-display text-2xl text-ink-900">
              {campaign.viewCount}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-ink-400">Clicks</p>
            <p className="font-display text-2xl text-ink-900">
              {campaign.clickCount}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-ink-400">Conversions</p>
            <p className="font-display text-2xl text-ink-900">
              {campaign.conversionCount}
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-ink-400">
          &ldquo;Reached&rdquo; counts the notifications a broadcast wrote
          against this campaign — send one from{" "}
          <Link
            href="/admin/marketing/audience"
            className="text-brand-600 underline-offset-4 hover:underline"
          >
            Audience
          </Link>
          . There is no analytics pipeline in this build, so nothing here moves
          on its own.
        </p>
      </section>

      <section>
        <h2 className="mb-4 font-display text-xl">Details</h2>
        <CampaignForm campaign={campaign} />
        <p className="mt-4 text-xs text-ink-400">
          Created {formatDateTime(campaign.createdAt)}.
        </p>
      </section>
    </div>
  );
}
