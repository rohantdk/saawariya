import type { Metadata } from "next";
import Link from "next/link";
import { Images, Mail, Megaphone, Ticket } from "lucide-react";
import { requireDesk } from "@/lib/admin/context";
import { marketingSummary, topCoupons } from "@/lib/marketing/dashboard";
import { ROLES } from "@/lib/constants";
import { formatPaise } from "@/lib/utils";
import { StatTile } from "@/components/ui/stat-tile";

export const metadata: Metadata = { title: "Marketing" };

/**
 * The marketing dashboard — SRS §124, §129.
 *
 * One question: **what is live on the storefront right now, and is it what
 * marketing thinks is live?** A coupon switched off, a banner whose end date
 * passed last week, a campaign still in draft on the day it was meant to start —
 * none of those raise an error anywhere, and every one is a promotion that is
 * silently not running.
 */
export default async function MarketingDashboardPage() {
  await requireDesk(ROLES.MARKETING, "/admin/marketing");

  const [summary, coupons] = await Promise.all([
    marketingSummary(),
    topCoupons(),
  ]);

  const overdue = summary.campaigns.overdueToStart + summary.campaigns.overdueToClose;

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <p className="eyebrow mb-2">SRS §124 — Marketing</p>
        <h1 className="font-display text-3xl">Marketing</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-400">
          What is running on the storefront, and what it has done. Coupon
          performance is counted from orders that survived — a cancelled order
          gives the customer their use back, so it should not count as a
          redemption either.
        </p>
      </header>

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          href="/admin/marketing/coupons"
          icon={<Ticket className="h-4 w-4" />}
          value={summary.coupons.live}
          label="Coupons live now"
          hint={`${summary.coupons.total} in total`}
        />
        <StatTile
          href="/admin/marketing/banners"
          icon={<Images className="h-4 w-4" />}
          value={summary.banners.live}
          label="Banners on the storefront"
          hint={`${summary.banners.total} in total`}
        />
        <StatTile
          href="/admin/marketing/campaigns"
          icon={<Megaphone className="h-4 w-4" />}
          value={summary.campaigns.active}
          label="Campaigns running"
          hint={
            overdue > 0
              ? `${overdue} need attention`
              : `${summary.campaigns.total} in total`
          }
          tone={overdue > 0 ? "attention" : "default"}
        />
        <StatTile
          href="/admin/marketing/audience"
          icon={<Mail className="h-4 w-4" />}
          value={summary.subscribers}
          label="Newsletter subscribers"
          hint={`${summary.promoNotifications} promotional notifications sent`}
        />
      </div>

      {overdue > 0 && (
        <div className="mb-8 space-y-2">
          {summary.campaigns.overdueToStart > 0 && (
            <p className="border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
              {summary.campaigns.overdueToStart} campaign
              {summary.campaigns.overdueToStart === 1 ? "" : "s"} should have
              started by now and{" "}
              {summary.campaigns.overdueToStart === 1 ? "is" : "are"} still
              waiting.{" "}
              <Link
                href="/admin/marketing/campaigns"
                className="underline underline-offset-4"
              >
                Open campaigns
              </Link>
            </p>
          )}
          {summary.campaigns.overdueToClose > 0 && (
            <p className="border border-ivory-400 bg-ivory-50 px-4 py-3 text-sm text-ink-500">
              {summary.campaigns.overdueToClose} campaign
              {summary.campaigns.overdueToClose === 1 ? "" : "s"} passed{" "}
              {summary.campaigns.overdueToClose === 1 ? "its" : "their"} end date
              while still marked active.
            </p>
          )}
        </div>
      )}

      {/* min-w-0 on each cell: a grid item will not shrink below its
          content, and the scrollable table below carries a min-width. */}
      <div className="grid gap-8 lg:grid-cols-2">
        <section className="min-w-0">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 className="font-display text-xl">What coupons cost</h2>
            <Link
              href="/admin/marketing/coupons"
              className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500 transition-colors hover:text-brand-600"
            >
              All coupons
            </Link>
          </div>

          {coupons.length === 0 ? (
            <p className="border border-ivory-400 bg-ivory-50 px-5 py-4 text-sm text-ink-400">
              No coupon has been redeemed yet.
            </p>
          ) : (
            <div className="overflow-x-auto border border-ivory-400 bg-ivory-50">
              <table className="w-full min-w-[26rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-ivory-400 text-left text-xs uppercase tracking-[0.1em] text-ink-400">
                    <th className="px-4 py-3 font-medium">Code</th>
                    <th className="px-4 py-3 text-right font-medium">Orders</th>
                    <th className="px-4 py-3 text-right font-medium">
                      Given away
                    </th>
                    <th className="px-4 py-3 text-right font-medium">
                      Order value
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {coupons.map((coupon) => (
                    <tr
                      key={coupon.code}
                      className="border-b border-ivory-300 last:border-b-0"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-ink-900">
                        {coupon.code}
                      </td>
                      <td className="px-4 py-3 text-right text-ink-500">
                        {coupon.orders}
                      </td>
                      <td className="px-4 py-3 text-right text-ink-900">
                        {formatPaise(coupon.discount)}
                      </td>
                      <td className="px-4 py-3 text-right text-ink-500">
                        {formatPaise(coupon.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-3 text-xs text-ink-400">
            {formatPaise(summary.coupons.discountGiven)} discounted across{" "}
            {summary.coupons.redeemedOrders} order
            {summary.coupons.redeemedOrders === 1 ? "" : "s"} worth{" "}
            {formatPaise(summary.coupons.revenueInfluenced)}.
          </p>
        </section>

        <section className="min-w-0">
          <h2 className="mb-3 font-display text-xl">Campaign reach</h2>

          <div className="border border-ivory-400 bg-ivory-50 p-5">
            <dl className="grid grid-cols-3 gap-3">
              <div className="min-w-0">
                <dt className="text-xs text-ink-400">Reached</dt>
                <dd className="font-display text-2xl text-ink-900">
                  {summary.campaigns.views}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-ink-400">Clicks</dt>
                <dd className="font-display text-2xl text-ink-900">
                  {summary.campaigns.clicks}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-ink-400">Conversions</dt>
                <dd className="font-display text-2xl text-ink-900">
                  {summary.campaigns.conversions}
                </dd>
              </div>
            </dl>

            {/*
              Saying where a number comes from is part of the number. There is no
              analytics pipeline in this build, so "reached" is exactly the count
              of notifications a broadcast wrote — not an estimate, and not a
              figure the software would be unable to account for.
            */}
            <p className="mt-4 border-t border-ivory-300 pt-3 text-xs leading-relaxed text-ink-400">
              &ldquo;Reached&rdquo; counts the notifications a broadcast actually
              wrote against a campaign. There is no analytics pipeline in this
              build, so clicks and conversions move only when something records
              them — they are not estimated.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
