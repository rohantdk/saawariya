import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/context";
import { listSellers, sellerCounts } from "@/lib/admin/sellers";
import { REQUIRED_DOCS } from "@/lib/seller/profile";
import {
  SELLER_BUSINESS_TYPE_LABEL,
  SELLER_VERIFICATION,
  SELLER_VERIFICATION_LABEL,
} from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/commerce/status-badge";
import { SELLER_STATUS_TONE } from "@/lib/status-tone";

export const metadata: Metadata = { title: "Sellers" };

const TABS = [
  { key: "all", label: "All" },
  { key: SELLER_VERIFICATION.PENDING, label: "Awaiting review" },
  { key: SELLER_VERIFICATION.UNDER_REVIEW, label: "Under review" },
  { key: SELLER_VERIFICATION.APPROVED, label: "Verified" },
  { key: SELLER_VERIFICATION.REJECTED, label: "Rejected" },
  { key: SELLER_VERIFICATION.SUSPENDED, label: "Suspended" },
];

/**
 * The seller verification queue — SRS §55, §74.
 *
 * Filters and paging are links carrying a query string, not client state, for
 * the same reasons as the Phase 3 shop filters and the Phase 5 seller
 * catalogue: it works without JavaScript, every view is bookmarkable, and there
 * is no client state that can drift out of step with the URL.
 */
export default async function AdminSellersPage({
  searchParams,
}: PageProps<"/admin/sellers">) {
  await requireAdmin("/admin/sellers");
  const params = await searchParams;

  const status = typeof params.status === "string" ? params.status : "all";
  const q = typeof params.q === "string" ? params.q : "";
  const page = Number(params.page) || 1;

  const [{ sellers, total, pageCount }, counts] = await Promise.all([
    listSellers({ status, q, page }),
    sellerCounts(),
  ]);

  const keep = (extra: Record<string, string | number>) => {
    const search = new URLSearchParams();
    if (status !== "all") search.set("status", status);
    if (q) search.set("q", q);
    for (const [key, value] of Object.entries(extra)) {
      if (value === "" || value === "all") search.delete(key);
      else search.set(key, String(value));
    }
    const qs = search.toString();
    return qs ? `/admin/sellers?${qs}` : "/admin/sellers";
  };

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <p className="eyebrow mb-2">Seller management</p>
        <h1 className="font-display text-3xl">Sellers</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-400">
          Verification decides whether a seller can trade at all: an approved
          seller&rsquo;s live products appear on the storefront, and suspending
          one withdraws them.
        </p>
      </header>

      <nav aria-label="Filter by verification status" className="mb-5">
        <ul className="flex flex-wrap gap-1 border-b border-ivory-400">
          {TABS.map((tab) => {
            const isActive = status === tab.key;
            return (
              <li key={tab.key}>
                <Link
                  href={keep({ status: tab.key, page: 1 })}
                  aria-current={isActive ? "page" : undefined}
                  className={`-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm transition-colors ${
                    isActive
                      ? "border-brand-600 text-brand-600"
                      : "border-transparent text-ink-500 hover:text-ink-900"
                  }`}
                >
                  {tab.label}
                  <span className="text-xs text-ink-400">
                    {counts[tab.key] ?? 0}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <form action="/admin/sellers" className="mb-6 flex gap-2">
        {status !== "all" && (
          <input type="hidden" name="status" value={status} />
        )}
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search by business, owner, GSTIN or email"
          aria-label="Search sellers"
          className="rounded-md w-full max-w-sm border border-ivory-400 bg-ivory-50 px-4 py-2.5 text-sm text-ink-900 placeholder:text-ink-400/60 focus:border-brand-600 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-md border border-ink-900/15 px-5 text-xs font-medium uppercase tracking-[0.12em] text-ink-900 transition-colors hover:bg-ivory-200"
        >
          Search
        </button>
      </form>

      {sellers.length === 0 ? (
        <div className="rounded-md border border-ivory-400 bg-ivory-50 p-10 text-center">
          <p className="text-sm text-ink-400">
            {q
              ? `No sellers match “${q}”.`
              : "Nothing in this queue right now."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {sellers.map((seller) => {
            const approvedDocs = REQUIRED_DOCS.filter(
              (docType) =>
                seller.documents.find((d) => d.docType === docType)?.status ===
                "APPROVED",
            ).length;

            return (
              <li key={seller.id}>
                <Link
                  href={`/admin/sellers/${seller.id}`}
                  className="flex flex-wrap items-start gap-4 rounded-md border border-ivory-400 bg-ivory-50 p-4 transition-colors hover:border-ink-400"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink-900">
                      {seller.businessName}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-400">
                      {seller.ownerName} ·{" "}
                      {SELLER_BUSINESS_TYPE_LABEL[seller.businessType] ??
                        seller.businessType}
                      {seller.city && ` · ${seller.city}, ${seller.state}`}
                    </p>
                    <p className="mt-1 text-xs text-ink-500">
                      {seller.user.email} · {seller._count.products} product
                      {seller._count.products === 1 ? "" : "s"} ·{" "}
                      {seller._count.subOrders} order
                      {seller._count.subOrders === 1 ? "" : "s"} ·{" "}
                      {seller.commissionPercent}% commission
                    </p>
                    {seller.verificationNote && (
                      <p className="mt-1 text-xs leading-relaxed text-ink-400">
                        {seller.verificationNote}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <StatusBadge
                      label={
                        SELLER_VERIFICATION_LABEL[seller.verificationStatus] ??
                        seller.verificationStatus
                      }
                      tone={
                        SELLER_STATUS_TONE[seller.verificationStatus] ??
                        "neutral"
                      }
                    />
                    <span
                      className={`text-xs ${
                        approvedDocs === REQUIRED_DOCS.length
                          ? "text-ink-400"
                          : "text-warning"
                      }`}
                    >
                      KYC {approvedDocs}/{REQUIRED_DOCS.length}
                    </span>
                    <span className="text-xs text-ink-400">
                      Applied {formatDate(seller.createdAt)}
                    </span>
                  </div>
                </Link>
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
          {page > 1 ? (
            <Link
              href={keep({ page: page - 1 })}
              className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500 transition-colors hover:text-brand-600"
            >
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <p className="text-xs text-ink-400">
            Page {page} of {pageCount} · {total} seller{total === 1 ? "" : "s"}
          </p>
          {page < pageCount ? (
            <Link
              href={keep({ page: page + 1 })}
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
