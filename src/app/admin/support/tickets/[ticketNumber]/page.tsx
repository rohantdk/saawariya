import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireDesk } from "@/lib/admin/context";
import {
  assignableAgents,
  findTicket,
  ticketHistory,
} from "@/lib/support/tickets";
import { availableTicketMoves } from "@/lib/support/ticket-states";
import { moveTicket } from "@/app/actions/support-desk";
import {
  ROLES,
  TICKET_CATEGORY_LABEL,
  TICKET_STATUS,
  type OrderStatus,
} from "@/lib/constants";
import { ORDER_STATUS_TONE } from "@/lib/commerce/order-status";
import {
  AGENT_TICKET_STATUS_TONE,
  TICKET_PRIORITY_TONE,
} from "@/lib/status-tone";
import { formatDate, formatDateTime, formatPaise } from "@/lib/utils";
import { StatusBadge } from "@/components/commerce/status-badge";
import { DecisionPanel } from "@/components/ui/decision-panel";
import {
  AssignControl,
  PriorityControl,
  ReplyBox,
} from "@/components/support/ticket-actions";

export const metadata: Metadata = { title: "Ticket" };

/**
 * One ticket — SRS §134-137.
 *
 * The agent thread, which is the same conversation the customer sees **plus**
 * the internal notes. That difference is the whole meaning of
 * `TicketMessage.isInternalNote`, it is enforced in the query rather than in the
 * markup, and Phase 4 verified it from the other end: the note on
 * `TKT-2026-00002` is absent from the customer's thread.
 *
 * Internal notes are rendered visibly differently and labelled, because an agent
 * skim-reading a thread must never mistake a private note for something the
 * customer has already been told.
 */
export default async function TicketDetailPage({
  params,
}: PageProps<"/admin/support/tickets/[ticketNumber]">) {
  const desk = await requireDesk(ROLES.SUPPORT, "/admin/support/tickets");
  const { ticketNumber } = await params;

  const ticket = await findTicket(ticketNumber);
  if (!ticket) notFound();

  const [agents, history] = await Promise.all([
    assignableAgents(),
    ticketHistory(ticket.raisedBy.id, ticket.id),
  ]);

  const moves = availableTicketMoves(ticket.status, desk.permissions);

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/admin/support/tickets"
        className="mb-4 inline-block text-xs font-medium uppercase tracking-[0.14em] text-ink-500 transition-colors hover:text-brand-600"
      >
        ← All tickets
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow mb-2">
            {ticket.ticketNumber} ·{" "}
            {TICKET_CATEGORY_LABEL[ticket.category] ?? ticket.category}
          </p>
          <h1 className="font-display text-3xl">{ticket.subject}</h1>
          <p className="mt-2 text-sm text-ink-400">
            Raised by {ticket.raisedBy.fullName} (
            {ticket.raisedBy.roleCode.toLowerCase()}) ·{" "}
            {ticket.raisedBy.email}
            {ticket.raisedBy.mobile ? ` · ${ticket.raisedBy.mobile}` : ""} ·{" "}
            {formatDateTime(ticket.createdAt)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <StatusBadge
            label={ticket.priority}
            tone={TICKET_PRIORITY_TONE[ticket.priority] ?? "neutral"}
          />
          <StatusBadge
            label={ticket.status}
            tone={AGENT_TICKET_STATUS_TONE[ticket.status] ?? "neutral"}
          />
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_18rem]">
        <div className="min-w-0">
          {/* ---- The conversation ---- */}
          <section className="mb-8">
            <h2 className="mb-4 font-display text-xl">Conversation</h2>

            <ul className="space-y-3">
              {ticket.messages.map((message) => {
                const fromRequester = message.author.id === ticket.raisedBy.id;

                return (
                  <li
                    key={message.id}
                    className={
                      message.isInternalNote
                        ? "rounded-md border border-warning/40 bg-warning-soft p-4"
                        : fromRequester
                          ? "rounded-md border border-ivory-400 bg-ivory-50 p-4"
                          : "rounded-md border border-brand-600/25 bg-brand-50 p-4"
                    }
                  >
                    <p className="mb-1.5 flex flex-wrap items-center gap-2 text-xs text-ink-400">
                      <span className="text-ink-900">
                        {message.author.fullName}
                      </span>
                      <span>{formatDateTime(message.createdAt)}</span>
                      {message.isInternalNote && (
                        <span className="font-medium uppercase tracking-[0.1em] text-warning">
                          Internal note — the customer cannot see this
                        </span>
                      )}
                    </p>
                    <p className="whitespace-pre-line text-sm leading-relaxed text-ink-900">
                      {message.body}
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* ---- Reply ---- */}
          <section className="mb-8">
            <h2 className="mb-4 font-display text-xl">Reply</h2>
            <ReplyBox
              ticketId={ticket.id}
              closed={ticket.status === TICKET_STATUS.CLOSED}
            />
          </section>

          {/* ---- Status ---- */}
          <section>
            <h2 className="mb-4 font-display text-xl">Where this goes next</h2>
            <div className="rounded-md border border-ivory-400 bg-ivory-50 p-5">
              <DecisionPanel
                action={moveTicket}
                idField="ticketId"
                id={ticket.id}
                moves={moves.map((move) => ({
                  to: move.to,
                  label: move.label,
                  // Resolving is the one move that demands words — the note is
                  // written into the thread and sent to the customer, and a
                  // resolution with none is a screen telling somebody their
                  // problem is over without saying what happened.
                  requiresNote: move.to === TICKET_STATUS.RESOLVED,
                  primary: move.primary,
                }))}
                noteField="resolutionNote"
                noteLabel="What was done"
                notePlaceholder="Posted to the thread and sent to the customer when you resolve."
                closedMessage="This ticket is closed. Nothing further happens to it."
              />
            </div>
          </section>
        </div>

        {/* ---- Context sidebar ---- */}
        <aside className="space-y-6 lg:min-w-0">
          <div className="space-y-5 rounded-md border border-ivory-400 bg-ivory-50 p-5">
            <AssignControl
              ticketId={ticket.id}
              assigneeId={ticket.assignee?.id ?? null}
              agents={agents}
            />
            <PriorityControl ticketId={ticket.id} priority={ticket.priority} />
          </div>

          {ticket.order && (
            <div className="rounded-md border border-ivory-400 bg-ivory-50 p-5">
              <h2 className="mb-3 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400">
                The order they mean
              </h2>
              <Link
                href={`/admin/orders/${ticket.order.orderNumber}`}
                className="text-sm text-ink-900 underline-offset-4 hover:text-brand-600 hover:underline"
              >
                {ticket.order.orderNumber}
              </Link>
              <p className="mt-1 text-xs text-ink-400">
                {formatPaise(ticket.order.totalAmount)} ·{" "}
                {formatDate(ticket.order.placedAt)}
              </p>
              <div className="mt-2">
                <StatusBadge
                  label={ticket.order.status}
                  tone={
                    ORDER_STATUS_TONE[ticket.order.status as OrderStatus] ??
                    "neutral"
                  }
                />
              </div>
            </div>
          )}

          {history.length > 0 && (
            <div className="rounded-md border border-ivory-400 bg-ivory-50 p-5">
              <h2 className="mb-3 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400">
                Their other tickets
              </h2>
              <ul className="space-y-2">
                {history.map((other) => (
                  <li key={other.ticketNumber}>
                    <Link
                      href={`/admin/support/tickets/${other.ticketNumber}`}
                      className="text-sm text-ink-900 underline-offset-4 hover:text-brand-600 hover:underline"
                    >
                      {other.subject}
                    </Link>
                    <p className="text-xs text-ink-400">
                      {other.ticketNumber} · {other.status.toLowerCase()} ·{" "}
                      {formatDate(other.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {ticket.resolutionNote && (
            <div className="rounded-md border border-success/30 bg-success-soft p-5">
              <h2 className="mb-2 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-success">
                Resolution
              </h2>
              <p className="text-sm leading-relaxed text-ink-900">
                {ticket.resolutionNote}
              </p>
              {ticket.resolvedAt && (
                <p className="mt-2 text-xs text-ink-400">
                  {formatDateTime(ticket.resolvedAt)}
                </p>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
