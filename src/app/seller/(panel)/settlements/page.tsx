import type { Metadata } from "next";
import Link from "next/link";
import { requireSeller } from "@/lib/seller/context";
import {
  listSellerSettlements,
  sellerSettlementSummary,
  type SettlementFilter,
} from "@/lib/seller/settlements";
import { getSellerProfile } from "@/lib/seller/profile";
import { SETTLEMENT_STATUS } from "@/lib/constants";
import { formatDate, formatPaise } from "@/lib/utils";
import { StatusBadge } from "@/components/commerce/status-badge";
import { StatTile } from "@/components/ui/stat-tile";
import type { Tone } from "@/lib/commerce/order-status";

export const metadata: Metadata = { title: "Settlements" };

const STATUS_TONE: Record<string, Tone> = {
  PENDING: "warning",
  UNDER_REVIEW: "info",
  RELEASED: "success",
  FAILED: "danger",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Awaiting payout",
  UNDER_REVIEW: "Under review",
  RELEASED: "Paid out",
  FAILED: "Failed",
};

const FILTERS: { key: SettlementFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Awaiting payout" },
  { key: "released", label: "Paid out" },
];

/**
 * Seller payouts — SRS §119, §120.
 *
 * Read-only: releasing a payout is a Finance action, so there is no control
 * here that would let a seller mark themselves paid. The commission line is
 * shown per settlement rather than only in the total, because "why is the net
 * lower than the order" is the first question this screen has to answer.
 */
export default async function SellerSettlementsPage({
  searchParams,
}: PageProps<"/seller/settlements">) {
  const seller = await requireSeller("/seller/settlements");
  const params = await searchParams;

  const filter = (
    FILTERS.some((f) => f.key === params.filter) ? params.filter : "all"
  ) as SettlementFilter;
  const page = Number(params.page) || 1;

  const [{ settlements, total, pageCount }, summary, profile] =
    await Promise.all([
      listSellerSettlements(seller.sellerId, { filter, page }),
      sellerSettlementSummary(seller.sellerId),
      getSellerProfile(seller.sellerId),
    ]);

  const href = (extra: Record<string, string | number>) => {
    const search = new URLSearchParams();
    if (filter !== "all") search.set("filter", filter);
    for (const [key, value] of Object.entries(extra)) {
      if (value === "" || value === "all") search.delete(key);
      else search.set(key, String(value));
    }
    const qs = search.toString();
    return qs ? `/seller/settlements?${qs}` : "/seller/settlements";
  };

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <p className="eyebrow mb-2">SRS §119 — Settlements</p>
        <h1 className="font-display text-3xl">Settlements</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-400">
          A settlement is raised when a parcel is delivered. Saawariya charges{" "}
          {profile?.commissionPercent ?? 10}% commission on the order value and
          pays the balance into your registered bank account.
        </p>
      </header>

      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <StatTile
          value={formatPaise(summary.pending.net)}
          label="Awaiting payout"
          hint={`${summary.pending.count} settlement${summary.pending.count === 1 ? "" : "s"}`}
          tone={summary.pending.net > 0 ? "attention" : "default"}
        />
        <StatTile
          value={formatPaise(summary.released.net)}
          label="Paid out to date"
          hint={`${summary.released.count} settlement${summary.released.count === 1 ? "" : "s"}`}
        />
        <StatTile
          value={formatPaise(
            summary.pending.commission + summary.released.commission,
          )}
          label="Commission charged"
          hint="Across all settlements"
        />
      </div>

      {/* ---- Where the money goes ---- */}
      {profile?.bankAccountNumber ? (
        <p className="mb-8 border border-ivory-400 bg-ivory-50 px-5 py-4 text-sm text-ink-500">
          Payouts are credited to{" "}
          <span className="text-ink-900">
            {profile.bankAccountName ?? profile.businessName}
          </span>{" "}
          ·{" "}
          <span className="text-ink-900">
            ••••{profile.bankAccountNumber.slice(-4)}
          </span>
          {profile.bankIfsc && ` · ${profile.bankIfsc}`}.{" "}
          <Link
            href="/seller/profile"
            className="text-brand-600 hover:underline"
          >
            Change
          </Link>
        </p>
      ) : (
        <p className="mb-8 border border-warning/30 bg-warning-soft px-5 py-4 text-sm text-ink-900">
          You have not added a bank account, so payouts cannot be released.{" "}
          <Link
            href="/seller/profile"
            className="text-brand-600 hover:underline"
          >
            Add one now
          </Link>
          .
        </p>
      )}

      <nav aria-label="Filter settlements" className="mb-6">
        <ul className="flex flex-wrap gap-1 border-b border-ivory-400">
          {FILTERS.map((tab) => {
            const isActive = filter === tab.key;
            return (
              <li key={tab.key}>
                <Link
                  href={href({ filter: tab.key, page: 1 })}
                  aria-current={isActive ? "page" : undefined}
                  className={`-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm transition-colors ${
                    isActive
                      ? "border-brand-600 text-brand-600"
                      : "border-transparent text-ink-500 hover:text-ink-900"
                  }`}
                >
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {settlements.length === 0 ? (
        <div className="border border-ivory-400 bg-ivory-50 p-10 text-center">
          <p className="text-sm text-ink-400">
            {summary.total === 0
              ? "No settlements yet. One is raised for each parcel that reaches the customer."
              : "Nothing in this view."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {settlements.map((settlement) => (
            <li
              key={settlement.id}
              className="border border-ivory-400 bg-ivory-50 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <Link
                    href={`/seller/orders/${settlement.subOrder.subOrderNumber}`}
                    className="text-sm text-ink-900 transition-colors hover:text-brand-600"
                  >
                    {settlement.subOrder.subOrderNumber}
                  </Link>
                  <p className="mt-0.5 text-xs text-ink-400">
                    {settlement.subOrder.deliveredAt
                      ? `Delivered ${formatDate(settlement.subOrder.deliveredAt)}`
                      : `Raised ${formatDate(settlement.createdAt)}`}
                    {settlement.status === SETTLEMENT_STATUS.RELEASED &&
                      settlement.releasedAt &&
                      ` · paid ${formatDate(settlement.releasedAt)}`}
                  </p>
                  {settlement.reference && (
                    <p className="mt-0.5 text-xs text-ink-400">
                      Ref {settlement.reference}
                    </p>
                  )}
                </div>

                <StatusBadge
                  label={STATUS_LABEL[settlement.status] ?? settlement.status}
                  tone={STATUS_TONE[settlement.status] ?? "neutral"}
                />
              </div>

              <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-1 border-t border-ivory-300 pt-3 text-xs">
                <div className="flex gap-1.5">
                  <dt className="text-ink-400">Gross</dt>
                  <dd className="text-ink-900">
                    {formatPaise(settlement.grossAmount)}
                  </dd>
                </div>
                <div className="flex gap-1.5">
                  <dt className="text-ink-400">
                    Commission ({settlement.commissionPercent}%)
                  </dt>
                  <dd className="text-ink-500">
                    − {formatPaise(settlement.commissionAmount)}
                  </dd>
                </div>
                <div className="flex gap-1.5">
                  <dt className="text-ink-400">Net to you</dt>
                  <dd className="text-ink-900">
                    {formatPaise(settlement.netAmount)}
                  </dd>
                </div>
              </dl>

              {/*
                Why a payout was stopped, in finance's own words.
                Their note box says it appears here word for word, and a status
                of "Under review" with no reason is the dead end this build
                refuses to ship — the more so when it is the seller's money.
              */}
              {settlement.note && (
                <p className="mt-3 border-l-2 border-warning/40 pl-3 text-sm leading-relaxed text-ink-500">
                  {settlement.note}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {pageCount > 1 && (
        <nav
          aria-label="Pagination"
          className="mt-8 flex items-center justify-between gap-4"
        >
          {page > 1 ? (
            <Link
              href={href({ page: page - 1 })}
              className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500 transition-colors hover:text-brand-600"
            >
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <p className="text-xs text-ink-400">
            Page {page} of {pageCount} · {total} settlement
            {total === 1 ? "" : "s"}
          </p>
          {page < pageCount ? (
            <Link
              href={href({ page: page + 1 })}
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
