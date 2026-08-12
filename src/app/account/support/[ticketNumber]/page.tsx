import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatDate, formatDateTime } from "@/lib/utils";
import { requireCustomer } from "@/lib/commerce/context";
import { TICKET_CATEGORY_LABEL } from "@/lib/constants";
import {
  TICKET_STATUS_TONE,
  isTicketOpen,
  ticketStatusLabel,
} from "@/lib/commerce/support";
import { StatusBadge } from "@/components/commerce/status-badge";
import { TicketThread } from "@/components/commerce/ticket-thread";

export async function generateMetadata(
  props: PageProps<"/account/support/[ticketNumber]">,
): Promise<Metadata> {
  const { ticketNumber } = await props.params;
  return { title: `Support ${ticketNumber}` };
}

/**
 * One support conversation — SRS §135, §137.
 *
 * The message query filters `isInternalNote: false`. That filter lives here, in
 * the query, not in the rendering: internal notes are how agents talk to each
 * other about a customer, and the only safe way to keep them out of a customer
 * view is never to load them. A component-level check would be one careless
 * refactor away from a leak.
 */
export default async function TicketPage(
  props: PageProps<"/account/support/[ticketNumber]">,
) {
  const [{ ticketNumber }, customer] = await Promise.all([
    props.params,
    requireCustomer(),
  ]);

  const ticket = await prisma.supportTicket.findFirst({
    // raisedById in the where — a ticket number in a URL is guessable.
    where: { ticketNumber, raisedById: customer.userId },
    select: {
      id: true,
      ticketNumber: true,
      subject: true,
      category: true,
      status: true,
      priority: true,
      createdAt: true,
      resolvedAt: true,
      closedAt: true,
      resolutionNote: true,
      relatedOrderId: true,
      assignee: { select: { fullName: true } },
      messages: {
        where: { isInternalNote: false },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          body: true,
          createdAt: true,
          authorId: true,
          author: { select: { fullName: true, roleCode: true } },
        },
      },
    },
  });

  if (!ticket) notFound();

  const relatedOrder = ticket.relatedOrderId
    ? await prisma.order.findUnique({
        where: { id: ticket.relatedOrderId },
        select: { orderNumber: true },
      })
    : null;

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/account/support"
        className="mb-6 inline-flex items-center gap-1 text-xs font-medium uppercase tracking-[0.14em] text-ink-400 transition-colors hover:text-brand-600"
      >
        <ChevronLeft aria-hidden="true" className="h-3.5 w-3.5" />
        Support
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl sm:text-3xl">
            {ticket.subject}
          </h1>
          <p className="mt-1.5 text-xs text-ink-400">
            {ticket.ticketNumber} ·{" "}
            {TICKET_CATEGORY_LABEL[ticket.category] ?? ticket.category} · raised{" "}
            {formatDate(ticket.createdAt)}
            {relatedOrder && (
              <>
                {" · "}
                <Link
                  href={`/account/orders/${relatedOrder.orderNumber}`}
                  className="text-brand-600 underline underline-offset-2"
                >
                  {relatedOrder.orderNumber}
                </Link>
              </>
            )}
          </p>
        </div>

        <StatusBadge
          label={ticketStatusLabel(ticket.status)}
          tone={TICKET_STATUS_TONE[ticket.status] ?? "neutral"}
        />
      </header>

      {ticket.assignee && (
        <p className="mt-4 text-sm text-ink-400">
          Handled by {ticket.assignee.fullName}.
        </p>
      )}

      {ticket.resolutionNote && (
        <div className="mt-5 border border-success/30 bg-success-soft p-4 text-sm leading-relaxed text-success">
          <p className="mb-1 font-medium">Resolution</p>
          {ticket.resolutionNote}
          {ticket.resolvedAt && (
            <p className="mt-2 text-xs opacity-80">
              {formatDateTime(ticket.resolvedAt)}
            </p>
          )}
        </div>
      )}

      <TicketThread
        ticketNumber={ticket.ticketNumber}
        currentUserId={customer.userId}
        messages={ticket.messages.map((message) => ({
          id: message.id,
          body: message.body,
          createdAt: message.createdAt.toISOString(),
          isMine: message.authorId === customer.userId,
          authorName: message.author.fullName,
        }))}
        canReply={isTicketOpen(ticket.status)}
        isClosed={!isTicketOpen(ticket.status)}
      />
    </div>
  );
}
