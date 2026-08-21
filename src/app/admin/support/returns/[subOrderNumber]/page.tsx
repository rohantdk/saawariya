import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireDesk } from "@/lib/admin/context";
import { findReturn, returnDecisions } from "@/lib/support/returns";
import { decideReturn } from "@/app/actions/support-desk";
import {
  PAYMENT_STATUS,
  RETURN_STATUS,
  RETURN_STATUS_LABEL,
  ROLES,
  SUB_ORDER_STATUS,
} from "@/lib/constants";
import { RETURN_STATUS_TONE } from "@/lib/status-tone";
import { SUB_ORDER_STATUS_LABEL } from "@/lib/commerce/order-status";
import { formatDateTime, formatPaise } from "@/lib/utils";
import { StatusBadge } from "@/components/commerce/status-badge";
import { DecisionPanel } from "@/components/ui/decision-panel";

export const metadata: Metadata = { title: "Return" };

/**
 * One return — SRS §111.
 *
 * The page states the consequence of each decision before it is taken, because
 * completing a return is the single most side-effectful button on the support
 * desk: it moves the sub-order to `RETURNED`, which puts the units back on the
 * shelf through the stock ledger, recomputes the parent order, notifies the
 * customer, and raises a refund for finance. All of that happens in one
 * transaction — `performSubOrderTransition` has owned the restock since Phase 7
 * and this desk rides along as its side effect rather than repeating it.
 */
export default async function ReturnDetailPage({
  params,
}: PageProps<"/admin/support/returns/[subOrderNumber]">) {
  await requireDesk(ROLES.SUPPORT, "/admin/support/returns");
  const { subOrderNumber } = await params;

  const request = await findReturn(subOrderNumber);
  if (!request) notFound();

  const moves = returnDecisions(request);
  const { subOrder } = request;
  const payment = subOrder.order.payments.find(
    (candidate) => candidate.status === PAYMENT_STATUS.SUCCESS,
  );

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/admin/support/returns"
        className="mb-4 inline-block text-xs font-medium uppercase tracking-[0.14em] text-ink-500 transition-colors hover:text-brand-600"
      >
        ← All returns
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow mb-2">Return</p>
          <h1 className="font-display text-3xl">{subOrder.subOrderNumber}</h1>
          <p className="mt-2 text-sm text-ink-400">
            {subOrder.order.customer.user.fullName} ·{" "}
            {subOrder.order.customer.user.email} ·{" "}
            <Link
              href={`/admin/orders/${subOrder.order.orderNumber}`}
              className="underline-offset-4 hover:text-brand-600 hover:underline"
            >
              {subOrder.order.orderNumber}
            </Link>
          </p>
        </div>
        <StatusBadge
          label={RETURN_STATUS_LABEL[request.status] ?? request.status}
          tone={RETURN_STATUS_TONE[request.status] ?? "neutral"}
        />
      </header>

      <section className="mb-6 rounded-md border border-ivory-400 bg-ivory-50 p-5">
        <h2 className="mb-2 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400">
          Why they want to return it
        </h2>
        <p className="text-sm text-ink-900">{request.reason}</p>
        {request.detail && (
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-500">
            {request.detail}
          </p>
        )}
        <p className="mt-3 text-xs text-ink-400">
          Requested {formatDateTime(request.requestedAt)}
          {subOrder.deliveredAt
            ? ` · delivered ${formatDateTime(subOrder.deliveredAt)}`
            : ""}
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-3 font-display text-xl">What is coming back</h2>
        <ul className="rounded-md border border-ivory-400 bg-ivory-50">
          {subOrder.items.map((item) => (
            <li
              key={item.productSku}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-ivory-300 px-4 py-3 last:border-b-0"
            >
              <span className="min-w-0 text-sm text-ink-900">
                {item.productName}
                <span className="block text-xs text-ink-400">
                  {item.productSku} · {item.quantity} unit
                  {item.quantity === 1 ? "" : "s"}
                </span>
              </span>
              <span className="shrink-0 text-sm text-ink-500">
                {formatPaise(item.lineTotal)}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-ink-500">
          Sold by {subOrder.seller.businessName} ·{" "}
          <span className="text-ink-900">
            {formatPaise(subOrder.totalAmount)}
          </span>{" "}
          would be refunded
        </p>
      </section>

      <section className="mb-6 rounded-md border border-ivory-400 bg-ivory-50 p-5">
        <h2 className="mb-2 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400">
          Where the parcel is
        </h2>
        <p className="text-sm text-ink-900">
          {SUB_ORDER_STATUS_LABEL[subOrder.status] ?? subOrder.status}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-ink-400">
          {subOrder.status === SUB_ORDER_STATUS.RETURN_REQUESTED
            ? "Completing the return from here moves the parcel to returned, puts the units back on the shelf with a ledger entry, and raises a refund for finance to release."
            : "The parcel is no longer in the return flow, so completing this record will not move stock — the pipeline already did."}
        </p>
      </section>

      {request.reviewNote && (
        <p className="mb-6 border-l-2 border-warning/40 pl-3 text-sm text-ink-500">
          {request.reviewNote}
        </p>
      )}

      <section>
        <h2 className="mb-3 font-display text-xl">Decision</h2>

        {/*
          Saying whether there is money to give back, before the button is
          pressed. A cash-on-delivery order that was never collected has no
          payment to refund, and a desk that does not know that will keep
          chasing finance for a refund nobody owes.
        */}
        {request.status === RETURN_STATUS.RECEIVED && !payment && (
          <p className="mb-3 text-sm text-warning">
            No payment was ever collected on this order, so completing the
            return will restock the goods but raise no refund — there is nothing
            to send back.
          </p>
        )}

        <div className="rounded-md border border-ivory-400 bg-ivory-50 p-5">
          <DecisionPanel
            action={decideReturn}
            idField="returnId"
            id={request.id}
            moves={moves}
            noteLabel="Note to the customer"
            notePlaceholder="Sent to the customer as a notification. Required when you reject."
            closedMessage={
              request.status === RETURN_STATUS.REFUNDED
                ? `Completed${request.resolvedAt ? ` on ${formatDateTime(request.resolvedAt)}` : ""}. The refund is on the finance queue.`
                : `This return was ${RETURN_STATUS_LABEL[request.status]?.toLowerCase() ?? request.status} and the customer was told why.`
            }
          />
        </div>
      </section>
    </div>
  );
}
