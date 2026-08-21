import type { Metadata } from "next";
import Link from "next/link";
import { requireDesk } from "@/lib/admin/context";
import { listReturns, returnCounts } from "@/lib/support/returns";
import { RETURN_STATUS, RETURN_STATUS_LABEL, ROLES } from "@/lib/constants";
import { RETURN_STATUS_TONE } from "@/lib/status-tone";
import { SUB_ORDER_STATUS_LABEL } from "@/lib/commerce/order-status";
import { formatDate, formatPaise } from "@/lib/utils";
import { StatusBadge } from "@/components/commerce/status-badge";
import { FilterTabs } from "@/components/ui/filter-tabs";

export const metadata: Metadata = { title: "Returns" };

const TABS = [
  { key: "open", label: "In progress" },
  { key: RETURN_STATUS.REQUESTED, label: "To decide" },
  { key: RETURN_STATUS.REFUNDED, label: "Completed" },
  { key: RETURN_STATUS.REJECTED, label: "Rejected" },
  { key: "all", label: "All" },
];

/**
 * The returns desk — SRS §111.
 *
 * Each row carries **two** statuses and that is the point: the return's own
 * state is the desk's decision, and the sub-order's is where the parcel
 * physically is. Approving a return does not move goods, so the two can and do
 * disagree — a return can be approved for days before anything comes back, and
 * completing it early would put units on a shelf that does not have them.
 */
export default async function ReturnsPage({
  searchParams,
}: PageProps<"/admin/support/returns">) {
  await requireDesk(ROLES.SUPPORT, "/admin/support/returns");
  const params = await searchParams;

  const status = typeof params.status === "string" ? params.status : "open";
  const q = typeof params.q === "string" ? params.q : "";
  const page = Number(params.page) || 1;

  const [{ returns, total, pageCount, page: current }, counts] =
    await Promise.all([listReturns({ status, q, page }), returnCounts()]);

  const keep = (extra: Record<string, string | number>) => {
    const search = new URLSearchParams();
    if (status) search.set("status", status);
    if (q) search.set("q", q);
    for (const [key, value] of Object.entries(extra)) {
      if (value === "") search.delete(key);
      else search.set(key, String(value));
    }
    const qs = search.toString();
    return qs ? `/admin/support/returns?${qs}` : "/admin/support/returns";
  };

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6">
        <p className="eyebrow mb-2">Returns</p>
        <h1 className="font-display text-3xl">Returns</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-400">
          Completing a return is the move that restocks the goods and raises the
          refund, so it is only offered once the parcel is actually back. The
          refund is raised pending — finance decides whether the money goes out.
        </p>
      </header>

      <FilterTabs
        tabs={TABS.map((tab) => ({ ...tab, count: counts[tab.key] ?? 0 }))}
        active={status}
        href={(key) => keep({ status: key, page: 1 })}
      />

      <form action="/admin/support/returns" className="mb-5 flex flex-wrap gap-2">
        <input type="hidden" name="status" value={status} />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Order, sub-order or reason"
          aria-label="Search returns"
          className="rounded-md w-full max-w-xs border border-ivory-400 bg-ivory-50 px-4 py-2.5 text-sm text-ink-900 placeholder:text-ink-400/60 focus:border-brand-600 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-md border border-ink-900/15 px-5 text-xs font-medium uppercase tracking-[0.12em] text-ink-900 transition-colors hover:bg-ivory-200"
        >
          Apply
        </button>
      </form>

      {returns.length === 0 ? (
        <div className="rounded-md border border-ivory-400 bg-ivory-50 p-10 text-center">
          <p className="text-sm text-ink-400">
            {status === "open" && !q
              ? "No return is in progress."
              : "No returns match this view."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {returns.map((request) => (
            <li
              key={request.id}
              className="rounded-md border border-ivory-400 bg-ivory-50 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <Link
                    href={`/admin/support/returns/${request.subOrder.subOrderNumber}`}
                    className="text-sm text-ink-900 underline-offset-4 hover:text-brand-600 hover:underline"
                  >
                    {request.subOrder.subOrderNumber}
                  </Link>
                  <p className="mt-0.5 text-xs text-ink-400">
                    {request.subOrder.order.customer.user.fullName} ·{" "}
                    {request.subOrder.seller.businessName} · requested{" "}
                    {formatDate(request.requestedAt)}
                  </p>
                  <p className="mt-1 text-sm text-ink-500">{request.reason}</p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1">
                  <p className="text-sm text-ink-900">
                    {formatPaise(request.subOrder.totalAmount)}
                  </p>
                  <StatusBadge
                    label={
                      RETURN_STATUS_LABEL[request.status] ?? request.status
                    }
                    tone={RETURN_STATUS_TONE[request.status] ?? "neutral"}
                  />
                </div>
              </div>

              <p className="mt-3 border-t border-ivory-300 pt-3 text-xs text-ink-400">
                The parcel is currently{" "}
                <span className="text-ink-900">
                  {SUB_ORDER_STATUS_LABEL[request.subOrder.status] ??
                    request.subOrder.status}
                </span>
              </p>
            </li>
          ))}
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
            Page {current} of {pageCount} · {total} return
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
