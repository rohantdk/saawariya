import type { Metadata } from "next";
import Link from "next/link";
import { requireDesk } from "@/lib/admin/context";
import {
  listPayments,
  paymentCounts,
  paymentMethodOptions,
} from "@/lib/finance/payments";
import {
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS,
  ROLES,
  type PaymentMethod,
} from "@/lib/constants";
import { formatDateTime, formatPaise } from "@/lib/utils";
import { StatusBadge } from "@/components/commerce/status-badge";
import { FilterTabs } from "@/components/ui/filter-tabs";
import type { Tone } from "@/lib/commerce/order-status";

export const metadata: Metadata = { title: "Transactions" };

/**
 * Payment status tones.
 *
 * `PENDING` is a warning here and neutral on a review queue, which is exactly
 * why `StatusBadge` takes the tone rather than deriving it from the word: an
 * unpaid payment is a problem, an unmoderated review is Tuesday.
 */
const PAYMENT_STATUS_TONE: Record<string, Tone> = {
  PENDING: "warning",
  SUCCESS: "success",
  FAILED: "danger",
  CANCELLED: "neutral",
  REFUNDED: "info",
};

const TABS = [
  { key: "all", label: "All" },
  { key: PAYMENT_STATUS.SUCCESS, label: "Successful" },
  { key: PAYMENT_STATUS.PENDING, label: "Pending" },
  { key: PAYMENT_STATUS.FAILED, label: "Failed" },
  { key: PAYMENT_STATUS.REFUNDED, label: "Refunded" },
  { key: PAYMENT_STATUS.CANCELLED, label: "Cancelled" },
];

/**
 * The transaction log — SRS §118.
 *
 * **Read-only, and deliberately so.** `PAYMENT_VIEW` is the only payment
 * permission that exists in the whole matrix; there is no "edit payment"
 * anywhere, because a payment row records what a gateway did and a screen that
 * let someone change it would be recording a fiction. The two things finance can
 * actually do about money — release a payout, decide a refund — are their own
 * models with their own state machines, and each row here links to them.
 *
 * Same argument Phase 6 made for admin inventory being read-only, restated
 * because "Mark as paid" is the single most tempting button to add to this page.
 */
export default async function PaymentsPage({
  searchParams,
}: PageProps<"/admin/finance/payments">) {
  await requireDesk(ROLES.FINANCE, "/admin/finance/payments");
  const params = await searchParams;

  const status = typeof params.status === "string" ? params.status : "all";
  const method = typeof params.method === "string" ? params.method : "all";
  const q = typeof params.q === "string" ? params.q : "";
  const page = Number(params.page) || 1;

  const [{ payments, total, pageCount, page: current, amount }, counts, methods] =
    await Promise.all([
      listPayments({ status, method, q, page }),
      paymentCounts({ method, q }),
      paymentMethodOptions(),
    ]);

  const keep = (extra: Record<string, string | number>) => {
    const search = new URLSearchParams();
    if (status && status !== "all") search.set("status", status);
    if (method && method !== "all") search.set("method", method);
    if (q) search.set("q", q);
    for (const [key, value] of Object.entries(extra)) {
      if (value === "" || value === "all") search.delete(key);
      else search.set(key, String(value));
    }
    const qs = search.toString();
    return qs ? `/admin/finance/payments?${qs}` : "/admin/finance/payments";
  };

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <p className="eyebrow mb-2">SRS §118 — Payment transactions</p>
        <h1 className="font-display text-3xl">Transactions</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-400">
          A record of what was charged, not a place to change it — there is no
          edit here, by design. This build has no payment gateway and the
          checkout says so on the page, so online payments carry a{" "}
          <code className="text-xs">SIM-</code> reference rather than a
          fabricated bank id.
        </p>
      </header>

      <FilterTabs
        tabs={TABS.map((tab) => ({ ...tab, count: counts[tab.key] ?? 0 }))}
        active={status}
        href={(key) => keep({ status: key, page: 1 })}
      />

      <form
        action="/admin/finance/payments"
        className="mb-5 flex flex-wrap gap-2"
      >
        <input type="hidden" name="status" value={status} />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Order number, reference or customer"
          aria-label="Search transactions"
          className="w-full max-w-xs border border-ivory-400 bg-ivory-50 px-4 py-2.5 text-sm text-ink-900 placeholder:text-ink-400/60 focus:border-brand-600 focus:outline-none"
        />
        <select
          name="method"
          defaultValue={method}
          aria-label="Filter by method"
          className="border border-ivory-400 bg-ivory-50 px-4 py-2.5 text-sm text-ink-900 focus:border-brand-600 focus:outline-none"
        >
          <option value="all">All methods</option>
          {methods.map((option) => (
            <option key={option.code} value={option.code}>
              {PAYMENT_METHOD_LABEL[option.code]} ({option.count})
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="border border-ink-900/15 px-5 text-xs font-medium uppercase tracking-[0.12em] text-ink-900 transition-colors hover:bg-ivory-200"
        >
          Apply
        </button>
      </form>

      {payments.length > 0 && (
        <p className="mb-5 border border-ivory-400 bg-ivory-50 px-4 py-3 text-sm text-ink-500">
          {total} transaction{total === 1 ? "" : "s"} in this view, totalling{" "}
          <span className="text-ink-900">{formatPaise(amount)}</span>
        </p>
      )}

      {payments.length === 0 ? (
        <div className="border border-ivory-400 bg-ivory-50 p-10 text-center">
          <p className="text-sm text-ink-400">
            No transactions match this view.
          </p>
        </div>
      ) : (
        /* The table scrolls inside its own container rather than the page —
           see the Phase 6 note on horizontal overflow at 375px. */
        <div className="overflow-x-auto border border-ivory-400 bg-ivory-50">
          <table className="w-full min-w-[46rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-ivory-400 text-left text-xs uppercase tracking-[0.1em] text-ink-400">
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Method</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Reference</th>
                <th className="px-4 py-3 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr
                  key={payment.id}
                  className="border-b border-ivory-300 last:border-b-0"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/orders/${payment.order.orderNumber}`}
                      className="text-ink-900 underline-offset-4 hover:text-brand-600 hover:underline"
                    >
                      {payment.order.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-500">
                    {payment.order.customer.user.fullName}
                  </td>
                  <td className="px-4 py-3 text-ink-500">
                    {PAYMENT_METHOD_LABEL[payment.method as PaymentMethod] ??
                      payment.method}
                  </td>
                  <td className="px-4 py-3 text-right text-ink-900">
                    {formatPaise(payment.amount)}
                    {payment.refunds.length > 0 && (
                      <span className="block text-xs text-ink-400">
                        &minus;
                        {formatPaise(
                          payment.refunds
                            .filter((refund) =>
                              ["APPROVED", "PROCESSED"].includes(refund.status),
                            )
                            .reduce((sum, refund) => sum + refund.amount, 0),
                        )}{" "}
                        refunded
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      label={payment.status}
                      tone={PAYMENT_STATUS_TONE[payment.status] ?? "neutral"}
                    />
                    {payment.failureReason && (
                      <span className="mt-1 block text-xs text-danger">
                        {payment.failureReason}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-400">
                    {payment.gatewayRef ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-400">
                    {formatDateTime(payment.paidAt ?? payment.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
