import type { Metadata } from "next";
import Link from "next/link";
import { requireDesk } from "@/lib/admin/context";
import {
  listSettlements,
  payoutBlockedReason,
  settlementCounts,
  settlementSellerOptions,
} from "@/lib/finance/settlements";
import { availableMoves, SETTLEMENT_MOVES } from "@/lib/finance/states";
import { moveSettlement } from "@/app/actions/finance";
import { ROLES, SETTLEMENT_STATUS } from "@/lib/constants";
import { SETTLEMENT_STATUS_TONE } from "@/lib/status-tone";
import { formatDate, formatPaise } from "@/lib/utils";
import { StatusBadge } from "@/components/commerce/status-badge";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { DecisionPanel } from "@/components/ui/decision-panel";

export const metadata: Metadata = { title: "Seller payouts" };

const TABS = [
  { key: SETTLEMENT_STATUS.PENDING, label: "To release" },
  { key: SETTLEMENT_STATUS.UNDER_REVIEW, label: "On hold" },
  { key: SETTLEMENT_STATUS.FAILED, label: "Failed" },
  { key: SETTLEMENT_STATUS.RELEASED, label: "Released" },
  { key: "all", label: "All" },
];

/**
 * The payout queue — SRS §119, §120.
 *
 * Every row shows the arithmetic in full: gross, the commission percentage that
 * was fixed when the settlement was raised, and the net. The percentage is
 * stored on the row rather than read from the seller, because an admin can
 * change a seller's rate and recomputing history from today's rate would restate
 * payouts that have already been made.
 *
 * The controls come from `availableMoves()`, so an action nobody may take is
 * never drawn — and `moveSettlement` re-checks on submit, because a button that
 * is not drawn is not a control. The one rule that is *not* in the state machine
 * is stated on the row itself: a payout is released once the customer has the
 * goods, so an undelivered parcel says so instead of offering the button.
 */
export default async function SettlementsPage({
  searchParams,
}: PageProps<"/admin/finance/settlements">) {
  const desk = await requireDesk(ROLES.FINANCE, "/admin/finance/settlements");
  const params = await searchParams;

  const status =
    typeof params.status === "string" ? params.status : SETTLEMENT_STATUS.PENDING;
  const sellerId = typeof params.sellerId === "string" ? params.sellerId : "";
  const q = typeof params.q === "string" ? params.q : "";
  const page = Number(params.page) || 1;

  const [{ settlements, total, pageCount, page: current, totals }, counts, sellers] =
    await Promise.all([
      listSettlements({ status, sellerId, q, page }),
      settlementCounts({ sellerId, q }),
      settlementSellerOptions(),
    ]);

  const keep = (extra: Record<string, string | number>) => {
    const search = new URLSearchParams();
    if (status) search.set("status", status);
    if (sellerId) search.set("sellerId", sellerId);
    if (q) search.set("q", q);
    for (const [key, value] of Object.entries(extra)) {
      if (value === "") search.delete(key);
      else search.set(key, String(value));
    }
    const qs = search.toString();
    return qs
      ? `/admin/finance/settlements?${qs}`
      : "/admin/finance/settlements";
  };

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6">
        <p className="eyebrow mb-2">Seller settlements</p>
        <h1 className="font-display text-3xl">Seller payouts</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-400">
          Commission is charged on the seller&rsquo;s gross line value, before
          any platform-funded coupon — a Saawariya promotion does not come out of
          the seller&rsquo;s payout. There is no banking integration in this
          build, so the reference below is whatever you record from your own
          statement.
        </p>
      </header>

      <FilterTabs
        tabs={TABS.map((tab) => ({ ...tab, count: counts[tab.key] ?? 0 }))}
        active={status}
        href={(key) => keep({ status: key, page: 1 })}
      />

      <form
        action="/admin/finance/settlements"
        className="mb-5 flex flex-wrap gap-2"
      >
        <input type="hidden" name="status" value={status} />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Order, sub-order, seller or reference"
          aria-label="Search payouts"
          className="rounded-md w-full max-w-xs border border-ivory-400 bg-ivory-50 px-4 py-2.5 text-sm text-ink-900 placeholder:text-ink-400/60 focus:border-brand-600 focus:outline-none"
        />
        <select
          name="sellerId"
          defaultValue={sellerId}
          aria-label="Filter by seller"
          className="rounded-md border border-ivory-400 bg-ivory-50 px-4 py-2.5 text-sm text-ink-900 focus:border-brand-600 focus:outline-none"
        >
          <option value="">All sellers</option>
          {sellers.map((seller) => (
            <option key={seller.id} value={seller.id}>
              {seller.businessName}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md border border-ink-900/15 px-5 text-xs font-medium uppercase tracking-[0.12em] text-ink-900 transition-colors hover:bg-ivory-200"
        >
          Apply
        </button>
      </form>

      {settlements.length > 0 && (
        <p className="mb-5 rounded-md border border-ivory-400 bg-ivory-50 px-4 py-3 text-sm text-ink-500">
          {total} payout{total === 1 ? "" : "s"} in this view ·{" "}
          {formatPaise(totals.gross)} gross &minus;{" "}
          {formatPaise(totals.commission)} commission ={" "}
          <span className="text-ink-900">{formatPaise(totals.net)}</span> net to
          sellers
        </p>
      )}

      {settlements.length === 0 ? (
        <div className="rounded-md border border-ivory-400 bg-ivory-50 p-10 text-center">
          <p className="text-sm text-ink-400">
            {status === SETTLEMENT_STATUS.PENDING && !q && !sellerId
              ? "No payouts are waiting to be released."
              : "No payouts match this view."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {settlements.map((settlement) => {
            const moves = availableMoves(
              SETTLEMENT_MOVES,
              settlement.status,
              desk.permissions,
            );
            const blocked = payoutBlockedReason(settlement);
            // A blocked row keeps the moves that do *not* pay money out — a
            // parcel that came back should still be recordable as failed.
            const usable = blocked
              ? moves.filter((move) => move.to !== SETTLEMENT_STATUS.RELEASED)
              : moves;

            return (
              <li
                key={settlement.id}
                className="rounded-md border border-ivory-400 bg-ivory-50 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm text-ink-900">
                      {settlement.seller.businessName}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-400">
                      <Link
                        href={`/admin/orders/${settlement.subOrder.order.orderNumber}`}
                        className="underline-offset-4 hover:text-brand-600 hover:underline"
                      >
                        {settlement.subOrder.subOrderNumber}
                      </Link>{" "}
                      · raised {formatDate(settlement.createdAt)}
                      {settlement.subOrder.deliveredAt
                        ? ` · delivered ${formatDate(settlement.subOrder.deliveredAt)}`
                        : ""}
                    </p>
                    {settlement.reference && (
                      <p className="mt-0.5 text-xs text-ink-400">
                        Reference {settlement.reference}
                        {settlement.releasedAt
                          ? ` · released ${formatDate(settlement.releasedAt)}`
                          : ""}
                      </p>
                    )}
                  </div>
                  <StatusBadge
                    label={settlement.status}
                    tone={SETTLEMENT_STATUS_TONE[settlement.status] ?? "neutral"}
                  />
                </div>

                <dl className="mt-4 grid grid-cols-3 gap-3 border-y border-ivory-300 py-3 text-sm">
                  <div className="min-w-0">
                    <dt className="text-xs text-ink-400">Gross</dt>
                    <dd className="text-ink-900">
                      {formatPaise(settlement.grossAmount)}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-ink-400">
                      Commission {settlement.commissionPercent}%
                    </dt>
                    <dd className="text-ink-900">
                      &minus;{formatPaise(settlement.commissionAmount)}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-ink-400">Net payable</dt>
                    <dd className="font-medium text-ink-900">
                      {formatPaise(settlement.netAmount)}
                    </dd>
                  </div>
                </dl>

                {settlement.seller.bankAccountNumber ? (
                  <p className="mt-3 text-xs text-ink-400">
                    {settlement.seller.bankAccountName} ·{" "}
                    {maskAccount(settlement.seller.bankAccountNumber)} ·{" "}
                    {settlement.seller.bankIfsc}
                  </p>
                ) : (
                  <p className="mt-3 text-xs text-danger">
                    This seller has no bank details on file — the payout cannot
                    be sent until they add them.
                  </p>
                )}

                {settlement.note && (
                  <p className="mt-3 border-l-2 border-warning/40 pl-3 text-sm text-ink-500">
                    {settlement.note}
                  </p>
                )}

                {blocked && (
                  <p className="mt-3 text-sm text-danger">{blocked}</p>
                )}

                <div className="mt-4">
                  <DecisionPanel
                    action={moveSettlement}
                    idField="settlementId"
                    id={settlement.id}
                    moves={usable}
                    noteLabel="Note to the seller"
                    notePlaceholder="Appears on the seller's own payouts screen, word for word."
                    reference={{
                      label: "Payment reference",
                      hint: "From your bank statement — left blank, a SIM- marker is recorded",
                    }}
                    closedMessage={
                      settlement.status === SETTLEMENT_STATUS.RELEASED
                        ? `Released ${
                            settlement.releasedAt
                              ? formatDate(settlement.releasedAt)
                              : ""
                          }. Money that has left the platform is not edited here — reversing it is a new transaction.`
                        : "Nothing further can be done with this payout."
                    }
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {pageCount > 1 && (
        <nav
          aria-label="Pagination"
          className="mt-8 flex items-center justify-between gap-4"
        >
          {current > 1 ? (
            <Link
              href={keep({ page: current - 1 })}
              className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500 transition-colors hover:text-brand-600"
            >
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <p className="text-xs text-ink-400">
            Page {current} of {pageCount}
          </p>
          {current < pageCount ? (
            <Link
              href={keep({ page: current + 1 })}
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

/**
 * Bank accounts are shown last-four only. The finance desk needs to tell two
 * accounts apart, which the last four digits do; printing the whole number on a
 * list screen is a disclosure with no matching purpose.
 */
function maskAccount(accountNumber: string): string {
  return `••••${accountNumber.slice(-4)}`;
}
