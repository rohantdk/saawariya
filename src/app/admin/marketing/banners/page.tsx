import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { requireDesk } from "@/lib/admin/context";
import { bannerCounts, listBannersByPosition } from "@/lib/marketing/banners";
import { BANNER_POSITION_LABEL, ROLES } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/commerce/status-badge";
import { BannerForm } from "@/components/marketing/banner-form";
import { ToggleButton } from "@/components/marketing/toggle-button";
import type { Tone } from "@/lib/commerce/order-status";

export const metadata: Metadata = { title: "Banners" };

const STATE_TONE: Record<string, Tone> = {
  live: "success",
  scheduled: "info",
  expired: "neutral",
  inactive: "neutral",
};

/**
 * Banner administration — SRS §125.
 *
 * Grouped by slot and shown in `sortOrder`, because that **is** the homepage:
 * `getBanners("HOME_HERO")` returns exactly this list in exactly this order, so
 * reading down the group is reading what the carousel will render. A flat list
 * sorted by date would hide the one thing this screen is for.
 */
export default async function BannersPage() {
  await requireDesk(ROLES.MARKETING, "/admin/marketing/banners");

  const [groups, counts] = await Promise.all([
    listBannersByPosition(),
    bannerCounts(),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6">
        <p className="eyebrow mb-2">Banners</p>
        <h1 className="font-display text-3xl">Banners</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-400">
          Grouped by slot and shown in the order the storefront renders them.{" "}
          {counts.live} of {counts.total} are live right now.
        </p>
      </header>

      <details className="mb-8 rounded-md border border-ivory-400 bg-ivory-50">
        <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-ink-900 hover:bg-ivory-200">
          Add a banner
        </summary>
        <div className="border-t border-ivory-300 p-5">
          <BannerForm />
        </div>
      </details>

      <div className="space-y-10">
        {groups.map((group) => (
          <section key={group.position}>
            <h2 className="mb-1 font-display text-xl">
              {BANNER_POSITION_LABEL[group.position]}
            </h2>
            <p className="mb-4 text-xs text-ink-400">
              {group.banners.length === 0
                ? "Nothing in this slot."
                : `${group.banners.length} banner${
                    group.banners.length === 1 ? "" : "s"
                  }, rendered in this order.`}
            </p>

            {group.banners.length > 0 && (
              <ul className="space-y-3">
                {group.banners.map((banner) => (
                  <li
                    key={banner.id}
                    className="flex flex-wrap items-start gap-4 rounded-md border border-ivory-400 bg-ivory-50 p-4"
                  >
                    <span className="relative aspect-[3/1] w-32 shrink-0 overflow-hidden bg-ivory-200">
                      <Image
                        src={banner.imageUrl}
                        alt=""
                        fill
                        sizes="128px"
                        className="object-cover"
                      />
                    </span>

                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/admin/marketing/banners/${banner.id}`}
                        className="text-sm text-ink-900 underline-offset-4 hover:text-brand-600 hover:underline"
                      >
                        {banner.title}
                      </Link>
                      {banner.subtitle && (
                        <p className="mt-0.5 text-xs text-ink-500">
                          {banner.subtitle}
                        </p>
                      )}
                      <p className="mt-0.5 text-xs text-ink-400">
                        Order {banner.sortOrder}
                        {banner.linkUrl ? ` · links to ${banner.linkUrl}` : ""}
                        {banner.startsAt || banner.endsAt
                          ? ` · ${banner.startsAt ? formatDate(banner.startsAt) : "any time"} – ${
                              banner.endsAt ? formatDate(banner.endsAt) : "no end"
                            }`
                          : ""}
                      </p>
                      <div className="mt-3">
                        <ToggleButton
                          kind="banner"
                          id={banner.id}
                          isActive={banner.isActive}
                        />
                      </div>
                    </div>

                    <StatusBadge
                      label={banner.state.label}
                      tone={STATE_TONE[banner.state.key] ?? "neutral"}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
