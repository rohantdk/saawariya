import type { Metadata } from "next";
import Link from "next/link";
import { requireDesk } from "@/lib/admin/context";
import {
  listRefunds,
  refundCounts,
  refundReasonOptions,
} from "@/lib/finance/refunds";
import { availableMoves, REFUND_MOVES } from "@/lib/finance/states";
import { moveRefund } from "@/app/actions/finance";
import {
  PAYMENT_METHOD_LABEL,
  REFUND_REASON_LABEL,
  REFUND_STATUS,
  ROLES,
  type PaymentMethod,
} from "@/lib/constants";
import { REFUND_STATUS_TONE } from "@/lib/status-tone";
import { formatDate, formatPaise } from "@/lib/utils";
import { StatusBadge } from "@/components/commerce/status-badge";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { DecisionPanel } from "@/components/ui/decision-panel";

export const metadata: Metadata = { title: "Refunds" };

const TABS = [
  { key: REFUND_STATUS.PENDING, label: "To decide" },
  { key: REFUND_STATUS.UNDER_REVIEW, label: "Investigating" },
  { key: REFUND_STATUS.APPROVED, label: "To pay" },
  { key: REFUND_STATUS.PROCESSED, label: "Refunded" },
  { key: REFUND_STATUS.REJECTED, label: "Rejected" },
  { key: "all", label: "All" },
];

/**
 * The refund queue — SRS §121.
 *
 * Phase 4 established the half of this that matters most: cancelling an order
 * raises a refund **PENDING**, never auto-approved, because software that
 * approves its own refunds does not have a refund workflow. This is where they
 * are finally decided.
 *
 * Approving and paying are two separate moves on purpose. "Approved" says
 * finance agrees the money is owed; "Refunded" says it has actually gone. That
 * is exactly the question a customer chasing their money is asking, and merging
 * the two would leave nowhere to answer it from.
 */
export default async function RefundsPage({
  searchParams,
}: PageProps<"/admin/finance/refunds">) {
  const desk = await requireDesk(ROLES.FINANCE, "/admin/finance/refunds");
  const params = await searchParams;

  const status =
    typeof params.status === "string" ? params.status : REFUND_STATUS.PENDING;
  const reason = typeof params.reason === "string" ? params.reason : "all";
  const q = typeof params.q === "string" ? params.q : "";
  const page = Number(params.page) || 1;

  const [{ refunds, total, pageCount, page: current, amount }, counts, reasons] =
    await Promise.all([
      listRefunds({ status, reason, q, page }),
      refundCounts({ reason, q }),
      refundReasonOptions(),
    ]);

  const keep = (extra: Record<string, string | number>) => {
    const search = new URLSearchParams();
    if (status) search.set("status", status);
    if (reason && reason !== "all") search.set("reason", reason);
    if (q) search.set("q", q);
    for (const [key, value] of Object.entries(extra)) {
      if (value === "") search.delete(key);
      else search.set(key, String(value));
    }
    const qs = search.toString();
    return qs ? `/admin/finance/refunds?${qs}` : "/admin/finance/refunds";
  };

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6">
        <p className="eyebrow mb-2">Refund management</p>
        <h1 className="font-display text-3xl">Refunds</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-400">
          A cancelled order raises a refund automatically, but never approves
          one. Approving says the money is owed; marking it refunded says it has
          actually been sent — the customer sees both.
        </p>
      </header>

      <FilterTabs
        tabs={TABS.map((tab) => ({ ...tab, count: counts[tab.key] ?? 0 }))}
        active={status}
        href={(key) => keep({ status: key, page: 1 })}
      />

      <form action="/admin/finance/refunds" className="mb-5 flex flex-wrap gap-2">
        <input type="hidden" name="status" value={status} />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Order number or customer"
          aria-label="Search refunds"
          className="rounded-md w-full max-w-xs border border-ivory-400 bg-ivory-50 px-4 py-2.5 text-sm text-ink-900 placeholder:text-ink-400/60 focus:border-brand-600 focus:outline-none"
        />
        <select
          name="reason"
          defaultValue={reason}
          aria-label="Filter by reason"
          className="rounded-md border border-ivory-400 bg-ivory-50 px-4 py-2.5 text-sm text-ink-900 focus:border-brand-600 focus:outline-none"
        >
          <option value="all">All reasons</option>
          {reasons.map((option) => (
            <option key={option.code} value={option.code}>
              {REFUND_REASON_LABEL[option.code] ?? option.code} ({option.count})
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

      {refunds.length > 0 && (
        <p className="mb-5 rounded-md border border-ivory-400 bg-ivory-50 px-4 py-3 text-sm text-ink-500">
          {total} refund{total === 1 ? "" : "s"} in this view, totalling{" "}
          <span className="text-ink-900">{formatPaise(amount)}</span>
        </p>
      )}

      {refunds.length === 0 ? (
        <div className="rounded-md border border-ivory-400 bg-ivory-50 p-10 text-center">
          <p className="text-sm text-ink-400">
            {status === REFUND_STATUS.PENDING && !q && reason === "all"
              ? "No refund is waiting on a decision."
              : "No refunds match this view."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {refunds.map((refund) => {
            const moves = availableMoves(
              REFUND_MOVES,
              refund.status,
              desk.permissions,
            );
            const order = refund.payment.order;

            return (
              <li
                key={refund.id}
                className="rounded-md border border-ivory-400 bg-ivory-50 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm text-ink-900">
                      {formatPaise(refund.amount)} ·{" "}
                      {REFUND_REASON_LABEL[refund.reason] ?? refund.reason}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-400">
                      <Link
                        href={`/admin/orders/${order.orderNumber}`}
                        className="underline-offset-4 hover:text-brand-600 hover:underline"
                      >
                        {order.orderNumber}
                      </Link>{" "}
                      · {order.customer.user.fullName} · raised{" "}
                      {formatDate(refund.requestedAt)}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-400">
                      Paid {formatPaise(refund.payment.amount)} by{" "}
                      {PAYMENT_METHOD_LABEL[
                        refund.payment.method as PaymentMethod
                      ] ?? refund.payment.method}
                      {refund.payment.gatewayRef
                        ? ` · ${refund.payment.gatewayRef}`
                        : ""}
                    </p>
                  </div>
                  <StatusBadge
                    label={refund.status}
                    tone={REFUND_STATUS_TONE[refund.status] ?? "neutral"}
                  />
                </div>

                {/*
                  A cash-on-delivery order whose payment never succeeded has
                  nothing to send back. Saying so on the row is the difference
                  between a desk that knows why a refund is stuck and one that
                  keeps retrying it.
                */}
                {refund.payment.status === "PENDING" && (
                  <p className="mt-3 text-sm text-warning">
                    This payment was never collected — it is a cash-on-delivery
                    order that was cancelled before delivery. There is nothing to
                    send back, so this refund should be rejected with that
                    explanation rather than paid.
                  </p>
                )}

                {order.cancelReason && (
                  <p className="mt-3 border-l-2 border-ivory-400 pl-3 text-sm text-ink-500">
                    Customer&rsquo;s reason: {order.cancelReason}
                  </p>
                )}

                {refund.reviewNote && (
                  <p className="mt-3 border-l-2 border-warning/40 pl-3 text-sm text-ink-500">
                    {refund.reviewNote}
                  </p>
                )}

                {refund.processedAt && (
                  <p className="mt-3 text-xs text-ink-400">
                    Refunded {formatDate(refund.processedAt)}
                  </p>
                )}

                <div className="mt-4">
                  <DecisionPanel
                    action={moveRefund}
                    idField="refundId"
                    id={refund.id}
                    moves={moves}
                    noteLabel="Note to the customer"
                    notePlaceholder="Sent to the customer as a notification when you investigate or reject."
                    closedMessage={
                      refund.status === REFUND_STATUS.PROCESSED
                        ? "Refunded. Nothing further to do."
                        : "This refund was rejected and the customer was told why."
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
