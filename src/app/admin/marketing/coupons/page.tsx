import type { Metadata } from "next";
import Link from "next/link";
import { requireDesk } from "@/lib/admin/context";
import {
  couponFilterCounts,
  listCoupons,
  type CouponFilter,
} from "@/lib/marketing/coupons";
import {
  COUPON_ELIGIBILITY_LABEL,
  DISCOUNT_TYPE,
  ROLES,
} from "@/lib/constants";
import { formatDate, formatPaise } from "@/lib/utils";
import { StatusBadge } from "@/components/commerce/status-badge";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { CouponForm } from "@/components/marketing/coupon-form";
import { ToggleButton } from "@/components/marketing/toggle-button";
import type { Tone } from "@/lib/commerce/order-status";

export const metadata: Metadata = { title: "Coupons" };

const TABS = [
  { key: "live", label: "Live" },
  { key: "scheduled", label: "Scheduled" },
  { key: "expired", label: "Finished" },
  { key: "inactive", label: "Switched off" },
  { key: "all", label: "All" },
];

const STATE_TONE: Record<string, Tone> = {
  live: "success",
  scheduled: "info",
  expired: "neutral",
  inactive: "neutral",
};

/**
 * Coupon administration — SRS §126.
 *
 * The state on each row is derived from the same three conditions the cart
 * applies — active, inside its dates, not fully redeemed — so a code marketing
 * believes is live and that the cart is rejecting shows here as expired rather
 * than being a mystery. This screen does not re-implement the validation; it
 * reports what `src/lib/commerce/coupons.ts` would decide.
 */
export default async function CouponsPage({
  searchParams,
}: PageProps<"/admin/marketing/coupons">) {
  await requireDesk(ROLES.MARKETING, "/admin/marketing/coupons");
  const params = await searchParams;

  const filter = (
    typeof params.filter === "string" ? params.filter : "live"
  ) as CouponFilter;
  const page = Number(params.page) || 1;

  const [{ coupons, total, pageCount, page: current }, counts] =
    await Promise.all([listCoupons({ filter, page }), couponFilterCounts()]);

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6">
        <p className="eyebrow mb-2">SRS §126 — Coupons</p>
        <h1 className="font-display text-3xl">Coupons</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-400">
          Redemptions count orders that survived — a cancelled order gives the
          customer their use back, so it is not counted here either.
        </p>
      </header>

      <FilterTabs
        tabs={TABS.map((tab) => ({ ...tab, count: counts[tab.key] ?? 0 }))}
        active={filter}
        href={(key) => `/admin/marketing/coupons?filter=${key}`}
      />

      <details className="mb-6 border border-ivory-400 bg-ivory-50">
        <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-ink-900 hover:bg-ivory-200">
          Create a coupon
        </summary>
        <div className="border-t border-ivory-300 p-5">
          <CouponForm />
        </div>
      </details>

      {coupons.length === 0 ? (
        <div className="border border-ivory-400 bg-ivory-50 p-10 text-center">
          <p className="text-sm text-ink-400">No coupons in this view.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {coupons.map((coupon) => (
            <li
              key={coupon.id}
              className="border border-ivory-400 bg-ivory-50 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <Link
                    href={`/admin/marketing/coupons/${coupon.id}`}
                    className="font-mono text-sm text-ink-900 underline-offset-4 hover:text-brand-600 hover:underline"
                  >
                    {coupon.code}
                  </Link>
                  <p className="mt-0.5 text-sm text-ink-500">
                    {describe(coupon)}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-400">
                    {COUPON_ELIGIBILITY_LABEL[coupon.eligibility]} ·{" "}
                    {formatDate(coupon.startsAt)} – {formatDate(coupon.endsAt)}
                    {coupon.usageLimit !== null
                      ? ` · ${coupon.usageCount}/${coupon.usageLimit} redeemed`
                      : ` · ${coupon.usageCount} redeemed`}
                  </p>
                </div>
                <StatusBadge
                  label={coupon.state.label}
                  tone={STATE_TONE[coupon.state.key] ?? "neutral"}
                />
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-ivory-300 pt-4">
                <p className="text-xs text-ink-400">
                  {coupon.orders} surviving order
                  {coupon.orders === 1 ? "" : "s"} ·{" "}
                  {formatPaise(coupon.discountGiven)} given away on{" "}
                  {formatPaise(coupon.revenueInfluenced)} of orders
                </p>
                <ToggleButton
                  kind="coupon"
                  id={coupon.id}
                  isActive={coupon.isActive}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {pageCount > 1 && (
        <nav
          aria-label="Pagination"
          className="mt-8 flex items-center justify-between gap-4"
        >
          {current > 1 ? (
            <Link
              href={`/admin/marketing/coupons?filter=${filter}&page=${current - 1}`}
              className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500 transition-colors hover:text-brand-600"
            >
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <p className="text-xs text-ink-400">
            Page {current} of {pageCount} · {total} coupon
            {total === 1 ? "" : "s"}
          </p>
          {current < pageCount ? (
            <Link
              href={`/admin/marketing/coupons?filter=${filter}&page=${current + 1}`}
              className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500 transition-colors hover:text-brand-600"
            >
              Next →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}

function describe(coupon: {
  discountType: string;
  discountValue: number;
  minOrderValue: number;
  maxDiscount: number | null;
}): string {
  const head =
    coupon.discountType === DISCOUNT_TYPE.PERCENTAGE
      ? `${coupon.discountValue}% off`
      : coupon.discountType === DISCOUNT_TYPE.FIXED
        ? `${formatPaise(coupon.discountValue)} off`
        : "Free shipping";

  const parts = [head];
  if (coupon.minOrderValue > 0) {
    parts.push(`over ${formatPaise(coupon.minOrderValue)}`);
  }
  if (coupon.maxDiscount) {
    parts.push(`capped at ${formatPaise(coupon.maxDiscount)}`);
  }
  return parts.join(", ");
}
