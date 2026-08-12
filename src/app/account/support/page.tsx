import type { Metadata } from "next";
import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { requireCustomer } from "@/lib/commerce/context";
import { getCommerceSettings } from "@/lib/commerce/settings";
import { TICKET_CATEGORY_LABEL } from "@/lib/constants";
import { StatusBadge } from "@/components/commerce/status-badge";
import { TICKET_STATUS_TONE, ticketStatusLabel } from "@/lib/commerce/support";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Support" };

/**
 * The customer's support requests — SRS §49, §132.
 */
export default async function SupportPage() {
  const customer = await requireCustomer("/account/support");

  const [tickets, settings] = await Promise.all([
    prisma.supportTicket.findMany({
      where: { raisedById: customer.userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        ticketNumber: true,
        subject: true,
        category: true,
        status: true,
        createdAt: true,
        _count: { select: { messages: { where: { isInternalNote: false } } } },
      },
    }),
    getCommerceSettings(),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl">Support</h1>
          <p className="mt-2 text-sm text-ink-400">
            {tickets.length === 0
              ? "Raise a request and our team will get back to you."
              : `${tickets.length} request${tickets.length === 1 ? "" : "s"}.`}
          </p>
        </div>

        <ButtonLink href="/account/support/new">New request</ButtonLink>
      </div>

      {tickets.length === 0 ? (
        <div className="mt-8 border border-ivory-400 bg-ivory-50 p-10 text-center">
          <span
            aria-hidden="true"
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-ivory-200 text-ink-400"
          >
            <LifeBuoy className="h-5 w-5" />
          </span>
          <p className="text-sm text-ink-400">
            No support requests yet. Most answers are in our{" "}
            <Link
              href="/page/faq"
              className="text-brand-600 underline underline-offset-2"
            >
              FAQ
            </Link>
            .
          </p>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <Link
                href={`/account/support/${ticket.ticketNumber}`}
                className="block border border-ivory-400 bg-ivory-50 p-4 transition-colors hover:border-ink-400"
              >
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <div className="min-w-0">
                    <p className="text-sm text-ink-900">{ticket.subject}</p>
                    <p className="mt-1 text-xs text-ink-400">
                      {ticket.ticketNumber} ·{" "}
                      {TICKET_CATEGORY_LABEL[ticket.category] ??
                        ticket.category}{" "}
                      · {formatDate(ticket.createdAt)} ·{" "}
                      {ticket._count.messages} message
                      {ticket._count.messages === 1 ? "" : "s"}
                    </p>
                  </div>

                  <StatusBadge
                    label={ticketStatusLabel(ticket.status)}
                    tone={TICKET_STATUS_TONE[ticket.status] ?? "neutral"}
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-8 border-t border-ivory-400 pt-6 text-xs leading-relaxed text-ink-400">
        You can also reach us at {settings.supportEmail} or{" "}
        {settings.supportPhone}, Monday to Saturday, 10am–7pm IST.
      </p>
    </div>
  );
}
