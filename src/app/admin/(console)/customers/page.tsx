import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/context";
import { customerCounts, listCustomers } from "@/lib/admin/customers";
import { CUSTOMER_TYPE, USER_STATUS } from "@/lib/constants";
import { USER_STATUS_TONE } from "@/lib/status-tone";
import { formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/commerce/status-badge";

export const metadata: Metadata = { title: "Customers" };

/**
 * Customer directory — SRS §73.
 *
 * Wholesale is a tab rather than a role filter, because wholesale is a tier on
 * the same role — see docs/ROLES.md for why there are nine role codes and not
 * eleven.
 */
export default async function AdminCustomersPage({
  searchParams,
}: PageProps<"/admin/customers">) {
  await requireAdmin("/admin/customers");
  const params = await searchParams;

  const tier = typeof params.tier === "string" ? params.tier : "all";
  const status = typeof params.status === "string" ? params.status : "all";
  const q = typeof params.q === "string" ? params.q : "";
  const page = Number(params.page) || 1;

  const [{ customers, total, pageCount, page: current }, counts] =
    await Promise.all([
      listCustomers({ tier, status, q, page }),
      customerCounts(),
    ]);

  const TABS = [
    { tier: "all", status: "all", label: "All", count: counts.all },
    {
      tier: CUSTOMER_TYPE.RETAIL,
      status: "all",
      label: "Retail",
      count: counts.retail,
    },
    {
      tier: CUSTOMER_TYPE.WHOLESALE,
      status: "all",
      label: "Wholesale",
      count: counts.wholesale,
    },
    {
      tier: "all",
      status: USER_STATUS.SUSPENDED,
      label: "Suspended",
      count: counts.suspended,
    },
  ];

  const href = (next: { tier?: string; status?: string; page?: number }) => {
    const search = new URLSearchParams();
    const nextTier = next.tier ?? tier;
    const nextStatus = next.status ?? status;
    if (nextTier !== "all") search.set("tier", nextTier);
    if (nextStatus !== "all") search.set("status", nextStatus);
    if (q) search.set("q", q);
    if (next.page && next.page > 1) search.set("page", String(next.page));
    const qs = search.toString();
    return qs ? `/admin/customers?${qs}` : "/admin/customers";
  };

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <p className="eyebrow mb-2">SRS §73 — Customer management</p>
        <h1 className="font-display text-3xl">Customers</h1>
      </header>

      <nav aria-label="Filter customers" className="mb-5">
        <ul className="flex flex-wrap gap-1 border-b border-ivory-400">
          {TABS.map((tab) => {
            const isActive = tier === tab.tier && status === tab.status;
            return (
              <li key={tab.label}>
                <Link
                  href={href({ tier: tab.tier, status: tab.status, page: 1 })}
                  aria-current={isActive ? "page" : undefined}
                  className={`-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm transition-colors ${
                    isActive
                      ? "border-brand-600 text-brand-600"
                      : "border-transparent text-ink-500 hover:text-ink-900"
                  }`}
                >
                  {tab.label}
                  <span className="text-xs text-ink-400">{tab.count}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <form action="/admin/customers" className="mb-6 flex gap-2">
        {tier !== "all" && <input type="hidden" name="tier" value={tier} />}
        {status !== "all" && (
          <input type="hidden" name="status" value={status} />
        )}
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search by name, email or mobile"
          aria-label="Search customers"
          className="w-full max-w-sm border border-ivory-400 bg-ivory-50 px-4 py-2.5 text-sm text-ink-900 placeholder:text-ink-400/60 focus:border-brand-600 focus:outline-none"
        />
        <button
          type="submit"
          className="border border-ink-900/15 px-5 text-xs font-medium uppercase tracking-[0.12em] text-ink-900 transition-colors hover:bg-ivory-200"
        >
          Search
        </button>
      </form>

      {customers.length === 0 ? (
        <div className="border border-ivory-400 bg-ivory-50 p-10 text-center">
          <p className="text-sm text-ink-400">
            {q ? `No customers match “${q}”.` : "No customers in this view."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {customers.map((customer) => (
            <li key={customer.id}>
              <Link
                href={`/admin/customers/${customer.id}`}
                className="flex flex-wrap items-center gap-4 border border-ivory-400 bg-ivory-50 p-4 transition-colors hover:border-ink-400"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink-900">
                    {customer.user.fullName}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-400">
                    {customer.user.email}
                    {customer.user.mobile && ` · ${customer.user.mobile}`}
                  </p>
                  <p className="mt-1 text-xs text-ink-500">
                    {customer._count.orders} order
                    {customer._count.orders === 1 ? "" : "s"} · joined{" "}
                    {formatDate(customer.createdAt)}
                    {customer.user.lastLoginAt &&
                      ` · last seen ${formatDate(customer.user.lastLoginAt)}`}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  <StatusBadge
                    label={customer.user.status}
                    tone={USER_STATUS_TONE[customer.user.status] ?? "neutral"}
                  />
                  <span className="text-xs text-ink-400">
                    {customer.customerType === CUSTOMER_TYPE.WHOLESALE
                      ? `Wholesale${customer.gstNumber ? ` · ${customer.gstNumber}` : ""}`
                      : "Retail"}
                  </span>
                </div>
              </Link>
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
              href={href({ page: current - 1 })}
              className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500 transition-colors hover:text-brand-600"
            >
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <p className="text-xs text-ink-400">
            Page {current} of {pageCount} · {total} customer
            {total === 1 ? "" : "s"}
          </p>
          {current < pageCount ? (
            <Link
              href={href({ page: current + 1 })}
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
