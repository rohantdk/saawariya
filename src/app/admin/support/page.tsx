import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Clock, Inbox, Undo2 } from "lucide-react";
import { requireDesk } from "@/lib/admin/context";
import { supportAttention, supportSummary } from "@/lib/support/dashboard";
import { ROLES, TICKET_CATEGORY_LABEL } from "@/lib/constants";
import { AGENT_TICKET_STATUS_TONE, TICKET_PRIORITY_TONE } from "@/lib/status-tone";
import { formatDate, formatPaise } from "@/lib/utils";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusBadge } from "@/components/commerce/status-badge";

export const metadata: Metadata = { title: "Support" };

/**
 * The support dashboard — SRS §130, §131.
 *
 * "Unanswered" is the figure worth having, and it is deliberately **not** a
 * status count. A ticket somebody marked in-progress and then never wrote to is
 * exactly what a status-only queue hides, and it is precisely the one the
 * customer notices. It is computed by asking whether every visible message on
 * the thread came from the person who raised it.
 */
export default async function SupportDashboardPage() {
  await requireDesk(ROLES.SUPPORT, "/admin/support");

  const [summary, attention] = await Promise.all([
    supportSummary(),
    supportAttention(),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <p className="eyebrow mb-2">Customer support</p>
        <h1 className="font-display text-3xl">Support</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-400">
          Tickets are raised by shoppers and by sellers — a settlement query and a
          delivery complaint need different answers, so every row says who is
          asking. Returns sit here too: the desk decides them, and completing one
          is what puts the stock back and raises the refund.
        </p>
      </header>

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          href="/admin/support/tickets?status=open"
          icon={<Inbox className="h-4 w-4" />}
          value={summary.open}
          label="Open tickets"
          hint={`${summary.unassigned} not assigned to anyone`}
          tone={summary.unassigned > 0 ? "attention" : "default"}
        />
        <StatTile
          href="/admin/support/tickets?status=open"
          icon={<Clock className="h-4 w-4" />}
          value={summary.unanswered}
          label="Waiting on a first reply"
          hint="Nobody from the desk has written yet"
          tone={summary.unanswered > 0 ? "attention" : "default"}
        />
        <StatTile
          href="/admin/support/tickets?status=open&priority=CRITICAL"
          icon={<AlertTriangle className="h-4 w-4" />}
          value={summary.critical}
          label="High or critical"
          hint={`${summary.ageing} open for more than a day`}
          tone={summary.critical > 0 ? "attention" : "default"}
        />
        <StatTile
          href="/admin/support/returns"
          icon={<Undo2 className="h-4 w-4" />}
          value={summary.returns}
          label="Returns to decide"
          hint={`${summary.resolvedToday} tickets resolved in the last day`}
          tone={summary.returns > 0 ? "attention" : "default"}
        />
      </div>

      {/* min-w-0 on each cell — see the Phase 6 note about grid items. */}
      <div className="grid gap-8 lg:grid-cols-2">
        <section className="min-w-0">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 className="font-display text-xl">Next in the queue</h2>
            <Link
              href="/admin/support/tickets"
              className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500 transition-colors hover:text-brand-600"
            >
              All tickets
            </Link>
          </div>

          {attention.tickets.length === 0 ? (
            <p className="rounded-md border border-ivory-400 bg-ivory-50 px-5 py-4 text-sm text-ink-400">
              Nothing open. Every ticket has been resolved or closed.
            </p>
          ) : (
            <ul className="space-y-2">
              {attention.tickets.map((ticket) => (
                <li
                  key={ticket.id}
                  className="rounded-md border border-ivory-400 bg-ivory-50 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/admin/support/tickets/${ticket.ticketNumber}`}
                        className="text-sm text-ink-900 underline-offset-4 hover:text-brand-600 hover:underline"
                      >
                        {ticket.subject}
                      </Link>
                      <p className="mt-0.5 text-xs text-ink-400">
                        {ticket.ticketNumber} · {ticket.raisedBy.fullName} (
                        {ticket.raisedBy.roleCode.toLowerCase()}) ·{" "}
                        {formatDate(ticket.createdAt)}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-400">
                        {ticket.assignee
                          ? `With ${ticket.assignee.fullName}`
                          : "Nobody has picked this up"}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <StatusBadge
                        label={ticket.priority}
                        tone={TICKET_PRIORITY_TONE[ticket.priority] ?? "neutral"}
                      />
                      <StatusBadge
                        label={ticket.status}
                        tone={
                          AGENT_TICKET_STATUS_TONE[ticket.status] ?? "neutral"
                        }
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="min-w-0 space-y-8">
          <div>
            <div className="mb-3 flex items-baseline justify-between gap-4">
              <h2 className="font-display text-xl">Returns to decide</h2>
              <Link
                href="/admin/support/returns"
                className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500 transition-colors hover:text-brand-600"
              >
                All returns
              </Link>
            </div>

            {attention.returns.length === 0 ? (
              <p className="rounded-md border border-ivory-400 bg-ivory-50 px-5 py-4 text-sm text-ink-400">
                No return is waiting on a decision.
              </p>
            ) : (
              <ul className="space-y-2">
                {attention.returns.map((request) => (
                  <li
                    key={request.id}
                    className="rounded-md border border-ivory-400 bg-ivory-50 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          href={`/admin/support/returns/${request.subOrder.subOrderNumber}`}
                          className="text-sm text-ink-900 underline-offset-4 hover:text-brand-600 hover:underline"
                        >
                          {request.subOrder.subOrderNumber}
                        </Link>
                        <p className="mt-0.5 text-xs text-ink-400">
                          {request.subOrder.order.customer.user.fullName} ·{" "}
                          {request.reason}
                        </p>
                        <p className="mt-0.5 text-xs text-ink-400">
                          Requested {formatDate(request.requestedAt)}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm text-ink-900">
                        {formatPaise(request.subOrder.totalAmount)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h2 className="mb-3 font-display text-xl">What people write in about</h2>
            <p className="mb-3 text-sm text-ink-400">
              Six delivery complaints in a week is a logistics problem, not a
              support one — the shape of the queue says more than its length.
            </p>

            {attention.byCategory.length === 0 ? (
              <p className="rounded-md border border-ivory-400 bg-ivory-50 px-5 py-4 text-sm text-ink-400">
                No open tickets.
              </p>
            ) : (
              <ul className="rounded-md border border-ivory-400 bg-ivory-50">
                {attention.byCategory.map((row) => (
                  <li
                    key={row.category}
                    className="flex items-center justify-between gap-4 border-b border-ivory-300 px-4 py-3 last:border-b-0"
                  >
                    <span className="min-w-0 text-sm text-ink-900">
                      {TICKET_CATEGORY_LABEL[row.category] ?? row.category}
                    </span>
                    <span className="shrink-0 text-sm text-ink-500">
                      {row.count}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
