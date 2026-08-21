import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireDesk } from "@/lib/admin/context";
import { findBanner } from "@/lib/marketing/banners";
import { BANNER_POSITION_LABEL, ROLES } from "@/lib/constants";
import { StatusBadge } from "@/components/commerce/status-badge";
import { BannerForm } from "@/components/marketing/banner-form";

export const metadata: Metadata = { title: "Banner" };

export default async function BannerDetailPage({
  params,
}: PageProps<"/admin/marketing/banners/[id]">) {
  await requireDesk(ROLES.MARKETING, "/admin/marketing/banners");
  const { id } = await params;

  const banner = await findBanner(id);
  if (!banner) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/admin/marketing/banners"
        className="mb-4 inline-block text-xs font-medium uppercase tracking-[0.14em] text-ink-500 transition-colors hover:text-brand-600"
      >
        ← All banners
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow mb-2">
            {BANNER_POSITION_LABEL[banner.position]}
          </p>
          <h1 className="font-display text-3xl">{banner.title}</h1>
        </div>
        <StatusBadge label={banner.state.label} />
      </header>

      {/*
        A banner's linkUrl is not decoration. Phase 3 found a seeded banner
        promising "MOQ from 10 metres" against products that all had a minimum of
        one, and every seeded link had to resolve for the storefront to be
        honest. Saying where this one goes, on the page that edits it, is the
        cheapest way to keep that true.
      */}
      {banner.linkUrl && (
        <p className="mb-6 rounded-md border border-ivory-400 bg-ivory-50 px-4 py-3 text-sm text-ink-500">
          Tapping this banner takes a shopper to{" "}
          <Link
            href={banner.linkUrl}
            className="text-brand-600 underline-offset-4 hover:underline"
          >
            {banner.linkUrl}
          </Link>
          . Check it resolves — a banner pointing at a 404 is worse than no
          banner.
        </p>
      )}

      <BannerForm banner={banner} />
    </div>
  );
}
