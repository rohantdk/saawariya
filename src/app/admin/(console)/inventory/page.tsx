import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/context";
import { inventorySummary, listInventory } from "@/lib/admin/inventory";
import { productFilterOptions } from "@/lib/admin/products";
import {
  PRODUCT_STATUS_LABEL,
  PRODUCT_STATUS_TONE,
} from "@/lib/seller/product-status";
import { INVENTORY_STATUS, PRODUCT_STATUS } from "@/lib/constants";
import { INVENTORY_STATUS_TONE } from "@/lib/status-tone";
import { formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/commerce/status-badge";
import { Select } from "@/components/ui/field";

export const metadata: Metadata = { title: "Inventory" };

const TABS = [
  { key: "alerts", label: "Needs attention" },
  { key: INVENTORY_STATUS.OUT_OF_STOCK, label: "Out of stock" },
  { key: INVENTORY_STATUS.LOW_STOCK, label: "Low" },
  { key: INVENTORY_STATUS.IN_STOCK, label: "In stock" },
  { key: "all", label: "All" },
];

/**
 * Marketplace-wide stock — SRS §77.
 *
 * Read-only, and the page says so. Stock levels belong to the seller who holds
 * the goods; the platform watches them and acts through the seller, not through
 * their ledger. See `src/lib/admin/inventory.ts` for the full reasoning.
 */
export default async function AdminInventoryPage({
  searchParams,
}: PageProps<"/admin/inventory">) {
  await requireAdmin("/admin/inventory");
  const params = await searchParams;

  const status = typeof params.status === "string" ? params.status : "alerts";
  const sellerId = typeof params.sellerId === "string" ? params.sellerId : "";
  const q = typeof params.q === "string" ? params.q : "";
  const page = Number(params.page) || 1;

  const [{ items, total, pageCount, page: current }, summary, options] =
    await Promise.all([
      listInventory({ status, sellerId, q, page }),
      inventorySummary(),
      productFilterOptions(),
    ]);

  const keep = (extra: Record<string, string | number>) => {
    const search = new URLSearchParams();
    if (status) search.set("status", status);
    if (sellerId) search.set("sellerId", sellerId);
    if (q) search.set("q", q);
    for (const [key, value] of Object.entries(extra)) {
      if (value === "") search.delete(key);
      else search.set(key, String(value));
    }
    const qs = search.toString();
    return qs ? `/admin/inventory?${qs}` : "/admin/inventory";
  };

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <p className="eyebrow mb-2">SRS §77 — Inventory monitoring</p>
        <h1 className="font-display text-3xl">Inventory</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-400">
          Read-only. Stock is a statement about goods a seller physically holds,
          so only they can adjust it — the ledger records movements that
          happened. What the platform can do about a shortage it does from the
          seller and product screens.
        </p>
      </header>

      <dl className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          [
            "Live and unbuyable",
            String(summary.liveOutOfStock),
            "approved products at zero stock",
          ],
          [
            "Low stock",
            String(summary.counts[INVENTORY_STATUS.LOW_STOCK] ?? 0),
            "at or below their own threshold",
          ],
          [
            "Units on hand",
            summary.unitsOnHand.toLocaleString("en-IN"),
            "across every seller",
          ],
          [
            "Units reserved",
            summary.unitsReserved.toLocaleString("en-IN"),
            "held by live orders",
          ],
        ].map(([label, value, hint]) => (
          <div
            key={label}
            className="border border-ivory-400 bg-ivory-50 px-5 py-4"
          >
            <dt className="text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400">
              {label}
            </dt>
            <dd className="mt-1.5 font-display text-2xl text-ink-900">
              {value}
            </dd>
            <dd className="mt-0.5 text-xs text-ink-400">{hint}</dd>
          </div>
        ))}
      </dl>

      <nav aria-label="Filter by stock status" className="mb-5">
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
                    {summary.counts[tab.key] ?? 0}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <form
        action="/admin/inventory"
        className="mb-6 flex flex-wrap items-center gap-2"
      >
        <input type="hidden" name="status" value={status} />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Product, SKU or seller"
          aria-label="Search inventory"
          className="min-w-0 flex-1 border border-ivory-400 bg-ivory-50 px-4 py-2.5 text-sm text-ink-900 placeholder:text-ink-400/60 focus:border-brand-600 focus:outline-none sm:max-w-xs"
        />
        <Select
          name="sellerId"
          defaultValue={sellerId}
          aria-label="Filter by seller"
          className="w-full py-2.5 sm:w-52"
        >
          <option value="">All sellers</option>
          {options.sellers.map((seller) => (
            <option key={seller.id} value={seller.id}>
              {seller.businessName}
            </option>
          ))}
        </Select>
        <button
          type="submit"
          className="h-11 shrink-0 border border-ink-900/15 px-5 text-xs font-medium uppercase tracking-[0.12em] text-ink-900 transition-colors hover:bg-ivory-200"
        >
          Filter
        </button>
      </form>

      {items.length === 0 ? (
        <div className="border border-ivory-400 bg-ivory-50 p-10 text-center">
          <p className="text-sm text-ink-400">
            {status === "alerts" && !q && !sellerId
              ? "Nothing is low or out of stock."
              : "No stock records match these filters."}
          </p>
        </div>
      ) : (
        <ul className="border border-ivory-400 bg-ivory-50">
          {items.map((item) => {
            const live = item.product.status === PRODUCT_STATUS.APPROVED;
            const unbuyable = live && item.stockQty === 0;

            return (
              <li
                key={item.id}
                className="flex flex-wrap items-center gap-4 border-b border-ivory-300 px-5 py-4 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/admin/products/${item.product.id}`}
                    className="truncate text-sm text-ink-900 underline-offset-4 hover:text-brand-600 hover:underline"
                  >
                    {item.product.name}
                  </Link>
                  <p className="mt-0.5 text-xs text-ink-400">
                    {item.product.sku} · {item.product.category.name} ·{" "}
                    <Link
                      href={`/admin/sellers/${item.product.seller.id}`}
                      className="underline-offset-4 hover:text-brand-600 hover:underline"
                    >
                      {item.product.seller.businessName}
                    </Link>
                  </p>
                  {unbuyable && (
                    <p className="mt-1 text-xs text-danger">
                      Live on the storefront and cannot be bought.
                    </p>
                  )}
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-sm text-ink-900">
                    {item.stockQty}{" "}
                    <span className="text-xs text-ink-400">on hand</span>
                  </p>
                  <p className="mt-0.5 text-xs text-ink-400">
                    {item.reservedQty} reserved · alerts below{" "}
                    {item.lowStockThreshold}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-400">
                    updated {formatDate(item.updatedAt)}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  <StatusBadge
                    label={item.status.replace(/_/g, " ")}
                    tone={INVENTORY_STATUS_TONE[item.status] ?? "neutral"}
                  />
                  <StatusBadge
                    label={
                      PRODUCT_STATUS_LABEL[item.product.status] ??
                      item.product.status
                    }
                    tone={PRODUCT_STATUS_TONE[item.product.status] ?? "neutral"}
                  />
                </div>
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
            Page {current} of {pageCount} · {total} product
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
