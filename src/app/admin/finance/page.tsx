import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  Banknote,
  Coins,
  Receipt,
  Undo2,
  Wallet,
} from "lucide-react";
import { requireDesk } from "@/lib/admin/context";
import { financeAttention, financeSummary } from "@/lib/finance/dashboard";
import {
  REFUND_REASON_LABEL,
  PAYMENT_METHOD_LABEL,
  ROLES,
  type PaymentMethod,
} from "@/lib/constants";
import { REFUND_STATUS_TONE, SETTLEMENT_STATUS_TONE } from "@/lib/status-tone";
import { formatDate, formatPaise } from "@/lib/utils";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusBadge } from "@/components/commerce/status-badge";

export const metadata: Metadata = { title: "Finance" };

/**
 * The finance dashboard — SRS §116-118.
 *
 * Split from the queues on purpose, the way each operations desk was in
 * Phase 7: a queue says how much work there is, a dashboard says what is
 * **wrong**. So the top row is not a scorecard — every figure on it is either
 * money the platform is holding that belongs to somebody else, or a transaction
 * that did not complete.
 *
 * "Awaiting payout" leads the row for that reason. It is the only number here
 * that another party is waiting on.
 */
export default async function FinanceDashboardPage() {
  await requireDesk(ROLES.FINANCE, "/admin/finance");

  const [summary, attention] = await Promise.all([
    financeSummary(),
    financeAttention(),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <p className="eyebrow mb-2">SRS §116 — Finance</p>
        <h1 className="font-display text-3xl">Finance</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-400">
          Payouts owed to sellers, refunds owed to customers, and what the
          platform actually collected. Every amount is held as integer paise and
          summed by the database, so nothing here can drift from the ledger it is
          reporting on.
        </p>
      </header>

      {/* ---- What somebody is waiting for ---- */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          href="/admin/finance/settlements?status=PENDING"
          icon={<Banknote className="h-4 w-4" />}
          value={formatPaise(summary.payouts.due)}
          label="Awaiting payout"
          hint={`${summary.payouts.dueCount} settlement${
            summary.payouts.dueCount === 1 ? "" : "s"
          } raised and not released`}
          tone={summary.payouts.dueCount > 0 ? "attention" : "default"}
        />
        <StatTile
          href="/admin/finance/refunds?status=PENDING"
          icon={<Undo2 className="h-4 w-4" />}
          value={formatPaise(summary.refunds.open)}
          label="Refunds to decide"
          hint={`${summary.refunds.openCount} awaiting a decision`}
          tone={summary.refunds.openCount > 0 ? "attention" : "default"}
        />
        <StatTile
          href="/admin/finance/refunds?status=APPROVED"
          icon={<Wallet className="h-4 w-4" />}
          value={formatPaise(summary.refunds.approved)}
          label="Approved, not yet sent"
          hint={`${summary.refunds.approvedCount} customer${
            summary.refunds.approvedCount === 1 ? "" : "s"
          } waiting on the money`}
          tone={summary.refunds.approvedCount > 0 ? "attention" : "default"}
        />
        <StatTile
          href="/admin/finance/settlements?status=UNDER_REVIEW"
          icon={<AlertTriangle className="h-4 w-4" />}
          value={formatPaise(summary.payouts.held)}
          label="Held or failed"
          hint={`${summary.payouts.heldCount} payout${
            summary.payouts.heldCount === 1 ? "" : "s"
          } stopped`}
          tone={summary.payouts.heldCount > 0 ? "attention" : "default"}
        />
      </div>

      {/* ---- What has happened ---- */}
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          href="/admin/finance/payments?status=SUCCESS"
          icon={<Receipt className="h-4 w-4" />}
          value={formatPaise(summary.collected.amount)}
          label="Collected"
          hint={`${summary.collected.count} successful payment${
            summary.collected.count === 1 ? "" : "s"
          }`}
        />
        <StatTile
          href="/admin/finance/reports"
          icon={<Coins className="h-4 w-4" />}
          value={formatPaise(summary.commission.earned)}
          label="Commission earned"
          hint={`${formatPaise(summary.commission.accruing)} more accruing on unreleased payouts`}
        />
        <StatTile
          href="/admin/finance/settlements?status=RELEASED"
          value={formatPaise(summary.payouts.released)}
          label="Paid out to sellers"
          hint={`${summary.payouts.releasedCount} released`}
        />
        <StatTile
          href="/admin/finance/payments?method=COD"
          value={formatPaise(summary.cod.amount)}
          label="Cash on delivery outstanding"
          hint={`${summary.cod.count} order${
            summary.cod.count === 1 ? "" : "s"
          } to collect on the doorstep`}
        />
      </div>

      {/*
        The two failures nothing else on the platform surfaces. A delivered
        parcel with no settlement row cannot appear in any queue — it is not in
        one — so a seller would simply never be paid and nobody would see it.
        Phase 5 found exactly that in the seed: seven delivered sub-orders and
        zero settlements.
      */}
      {(summary.unsettledDeliveries > 0 || summary.failedPayments > 0) && (
        <div className="mb-8 space-y-2">
          {summary.unsettledDeliveries > 0 && (
            <p className="border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
              {summary.unsettledDeliveries} delivered parcel
              {summary.unsettledDeliveries === 1 ? " has" : "s have"} no
              settlement raised at all. Those sellers are owed money that is not
              in any payout queue.
            </p>
          )}
          {summary.failedPayments > 0 && (
            <p className="border border-ivory-400 bg-ivory-50 px-4 py-3 text-sm text-ink-500">
              {summary.failedPayments} payment
              {summary.failedPayments === 1 ? "" : "s"} failed at the gateway.{" "}
              <Link
                href="/admin/finance/payments?status=FAILED"
                className="text-brand-600 underline-offset-4 hover:underline"
              >
                Review them
              </Link>
              .
            </p>
          )}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        {/* ---- Oldest unreleased payouts ---- */}
        {/* min-w-0: a grid item will not shrink below its content otherwise. */}
        <section className="min-w-0">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 className="font-display text-xl">Oldest payouts waiting</h2>
            <Link
              href="/admin/finance/settlements"
              className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500 transition-colors hover:text-brand-600"
            >
              All payouts
            </Link>
          </div>

          {attention.settlements.length === 0 ? (
            <p className="border border-ivory-400 bg-ivory-50 px-5 py-4 text-sm text-ink-400">
              Every raised payout has been released.
            </p>
          ) : (
            <ul className="space-y-2">
              {attention.settlements.map((settlement) => (
                <li
                  key={settlement.id}
                  className="border border-ivory-400 bg-ivory-50 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-ink-900">
                        {settlement.seller.businessName}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-400">
                        {settlement.subOrder.subOrderNumber} · raised{" "}
                        {formatDate(settlement.createdAt)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm text-ink-900">
                        {formatPaise(settlement.netAmount)}
                      </p>
                      <StatusBadge
                        label={settlement.status}
                        tone={
                          SETTLEMENT_STATUS_TONE[settlement.status] ?? "neutral"
                        }
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---- Oldest open refunds ---- */}
        <section className="min-w-0">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 className="font-display text-xl">Refunds waiting longest</h2>
            <Link
              href="/admin/finance/refunds"
              className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500 transition-colors hover:text-brand-600"
            >
              All refunds
            </Link>
          </div>

          {attention.refunds.length === 0 ? (
            <p className="border border-ivory-400 bg-ivory-50 px-5 py-4 text-sm text-ink-400">
              No refund is waiting on a decision or a payment.
            </p>
          ) : (
            <ul className="space-y-2">
              {attention.refunds.map((refund) => (
                <li
                  key={refund.id}
                  className="border border-ivory-400 bg-ivory-50 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-ink-900">
                        {refund.payment.order.customer.user.fullName}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-400">
                        {refund.payment.order.orderNumber} ·{" "}
                        {REFUND_REASON_LABEL[refund.reason] ?? refund.reason} ·{" "}
                        {PAYMENT_METHOD_LABEL[
                          refund.payment.method as PaymentMethod
                        ] ?? refund.payment.method}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-400">
                        Raised {formatDate(refund.requestedAt)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm text-ink-900">
                        {formatPaise(refund.amount)}
                      </p>
                      <StatusBadge
                        label={refund.status}
                        tone={REFUND_STATUS_TONE[refund.status] ?? "neutral"}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
