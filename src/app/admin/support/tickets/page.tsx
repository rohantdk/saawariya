import type { Metadata } from "next";
import Link from "next/link";
import { requireDesk } from "@/lib/admin/context";
import {
  assignableAgents,
  listTickets,
  ticketCounts,
} from "@/lib/support/tickets";
import {
  ROLES,
  TICKET_CATEGORY_LABEL,
  TICKET_PRIORITY,
  TICKET_STATUS,
} from "@/lib/constants";
import {
  AGENT_TICKET_STATUS_TONE,
  TICKET_PRIORITY_TONE,
} from "@/lib/status-tone";
import { formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/commerce/status-badge";
import { FilterTabs } from "@/components/ui/filter-tabs";

export const metadata: Metadata = { title: "Tickets" };

const TABS = [
  { key: "open", label: "Open" },
  { key: TICKET_STATUS.WAITING_CUSTOMER, label: "Waiting on customer" },
  { key: TICKET_STATUS.RESOLVED, label: "Resolved" },
  { key: TICKET_STATUS.CLOSED, label: "Closed" },
  { key: "all", label: "All" },
];

/**
 * The helpdesk queue — SRS §133.
 *
 * Sorted critical first, then **oldest** — not newest. A queue ordered by
 * arrival descending is how the ticket nobody wanted to answer stays at the
 * bottom forever, which is the same reason the payout and refund queues are
 * ordered the way they are.
 *
 * Each row says who spoke last, because that single fact decides whether the
 * ticket needs the desk or is waiting on somebody else, and no status column
 * records it.
 */
export default async function TicketsPage({
  searchParams,
}: PageProps<"/admin/support/tickets">) {
  await requireDesk(ROLES.SUPPORT, "/admin/support/tickets");
  const params = await searchParams;

  const status = typeof params.status === "string" ? params.status : "open";
  const priority = typeof params.priority === "string" ? params.priority : "all";
  const assignee = typeof params.assignee === "string" ? params.assignee : "all";
  const q = typeof params.q === "string" ? params.q : "";
  const page = Number(params.page) || 1;

  const [{ tickets, total, pageCount, page: current }, counts, agents] =
    await Promise.all([
      listTickets({ status, priority, assignee, q, page }),
      ticketCounts({ priority, assignee, q }),
      assignableAgents(),
    ]);

  const keep = (extra: Record<string, string | number>) => {
    const search = new URLSearchParams();
    if (status) search.set("status", status);
    if (priority !== "all") search.set("priority", priority);
    if (assignee !== "all") search.set("assignee", assignee);
    if (q) search.set("q", q);
    for (const [key, value] of Object.entries(extra)) {
      if (value === "") search.delete(key);
      else search.set(key, String(value));
    }
    const qs = search.toString();
    return qs ? `/admin/support/tickets?${qs}` : "/admin/support/tickets";
  };

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6">
        <p className="eyebrow mb-2">SRS §133 — Ticket queue</p>
        <h1 className="font-display text-3xl">Tickets</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-400">
          Highest priority first, then whoever has waited longest.{" "}
          {counts.unassigned} of the open tickets have nobody on them.
        </p>
      </header>

      <FilterTabs
        tabs={TABS.map((tab) => ({ ...tab, count: counts[tab.key] ?? 0 }))}
        active={status}
        href={(key) => keep({ status: key, page: 1 })}
      />

      <form action="/admin/support/tickets" className="mb-5 flex flex-wrap gap-2">
        <input type="hidden" name="status" value={status} />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Ticket number, subject or person"
          aria-label="Search tickets"
          className="w-full max-w-xs border border-ivory-400 bg-ivory-50 px-4 py-2.5 text-sm text-ink-900 placeholder:text-ink-400/60 focus:border-brand-600 focus:outline-none"
        />
        <select
          name="priority"
          defaultValue={priority}
          aria-label="Filter by priority"
          className="border border-ivory-400 bg-ivory-50 px-4 py-2.5 text-sm text-ink-900 focus:border-brand-600 focus:outline-none"
        >
          <option value="all">Any priority</option>
          {Object.values(TICKET_PRIORITY).map((value) => (
            <option key={value} value={value}>
              {value.charAt(0) + value.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
        <select
          name="assignee"
          defaultValue={assignee}
          aria-label="Filter by assignee"
          className="border border-ivory-400 bg-ivory-50 px-4 py-2.5 text-sm text-ink-900 focus:border-brand-600 focus:outline-none"
        >
          <option value="all">Anyone</option>
          <option value="unassigned">Nobody yet</option>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.fullName}
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

      {tickets.length === 0 ? (
        <div className="border border-ivory-400 bg-ivory-50 p-10 text-center">
          <p className="text-sm text-ink-400">
            {status === "open" && !q
              ? "Nothing open. Every ticket has been resolved or closed."
              : "No tickets match this view."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {tickets.map((ticket) => {
            const last = ticket.messages[0];
            // The description is written as the first message by the requester,
            // so a thread whose last visible message is theirs is one the desk
            // has not answered. No status column carries that.
            const waitingOnUs =
              !last ||
              (!last.isInternalNote && last.author.id === ticket.raisedBy.id);

            return (
              <li
                key={ticket.id}
                className="border border-ivory-400 bg-ivory-50 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/support/tickets/${ticket.ticketNumber}`}
                      className="text-sm text-ink-900 underline-offset-4 hover:text-brand-600 hover:underline"
                    >
                      {ticket.subject}
                    </Link>
                    <p className="mt-0.5 text-xs text-ink-400">
                      {ticket.ticketNumber} ·{" "}
                      {TICKET_CATEGORY_LABEL[ticket.category] ??
                        ticket.category}{" "}
                      · {ticket.raisedBy.fullName} (
                      {ticket.raisedBy.roleCode.toLowerCase()})
                    </p>
                    <p className="mt-0.5 text-xs text-ink-400">
                      Raised {formatDate(ticket.createdAt)} ·{" "}
                      {ticket._count.messages} message
                      {ticket._count.messages === 1 ? "" : "s"} ·{" "}
                      {ticket.assignee
                        ? `with ${ticket.assignee.fullName}`
                        : "unassigned"}
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
                </div>

                {waitingOnUs && ticket.status !== TICKET_STATUS.CLOSED && (
                  <p className="mt-3 text-sm text-warning">
                    Nobody from the desk has replied to this yet.
                  </p>
                )}
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
            Page {current} of {pageCount} · {total} ticket
            {total === 1 ? "" : "s"}
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
