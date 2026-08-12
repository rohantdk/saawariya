import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireCustomer } from "@/lib/commerce/context";
import { TicketForm } from "@/components/commerce/ticket-form";

export const metadata: Metadata = { title: "New support request" };

/**
 * Raise a support request — SRS §132.
 *
 * The order dropdown is populated from this customer's real orders, and the
 * action re-checks ownership of whatever comes back, so an order number cannot
 * be attached to a ticket by typing someone else's.
 */
export default async function NewTicketPage(
  props: PageProps<"/account/support/new">,
) {
  const [customer, searchParams] = await Promise.all([
    requireCustomer("/account/support/new"),
    props.searchParams,
  ]);

  const orders = await prisma.order.findMany({
    where: { customerId: customer.customerId },
    orderBy: { placedAt: "desc" },
    take: 25,
    select: { orderNumber: true, placedAt: true, totalAmount: true },
  });

  // Deep-linked from an order page: /account/support/new?order=SAAW-2026-000001
  const preselected =
    typeof searchParams.order === "string" ? searchParams.order : null;

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/account/support"
        className="mb-6 inline-flex items-center gap-1 text-xs font-medium uppercase tracking-[0.14em] text-ink-400 transition-colors hover:text-brand-600"
      >
        <ChevronLeft aria-hidden="true" className="h-3.5 w-3.5" />
        Support
      </Link>

      <h1 className="font-display text-3xl sm:text-4xl">
        How can we help?
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-400">
        Tell us what has happened and we will come back to you. If it is about a
        specific order, choose it below — it saves us both a round trip.
      </p>

      <div className="mt-8 border border-ivory-400 bg-ivory-50 p-6">
        <TicketForm
          orders={orders.map((order) => ({
            orderNumber: order.orderNumber,
            placedAt: order.placedAt.toISOString(),
          }))}
          defaultOrderNumber={preselected}
        />
      </div>
    </div>
  );
}
