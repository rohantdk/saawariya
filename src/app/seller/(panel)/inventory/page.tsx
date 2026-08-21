import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { requireSeller } from "@/lib/seller/context";
import {
  listSellerInventory,
  sellerInventoryCounts,
} from "@/lib/seller/inventory";
import { availableQty } from "@/lib/inventory-status";
import { INVENTORY_STATUS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/commerce/status-badge";
import { StockAdjustForm } from "@/components/seller/stock-adjust-form";
import type { Tone } from "@/lib/commerce/order-status";

export const metadata: Metadata = { title: "Inventory" };

const STOCK_TONE: Record<string, Tone> = {
  IN_STOCK: "success",
  LOW_STOCK: "warning",
  OUT_OF_STOCK: "danger",
  DISCONTINUED: "neutral",
};

const STOCK_LABEL: Record<string, string> = {
  IN_STOCK: "In stock",
  LOW_STOCK: "Low stock",
  OUT_OF_STOCK: "Out of stock",
  DISCONTINUED: "Discontinued",
};

/**
 * Stock management — SRS §60, §97, §98.
 *
 * Shows three numbers per product, not one, because they mean different things
 * and a seller acting on the wrong one oversells: what is on the shelf
 * (`stockQty`), what is already promised to paid orders (`reservedQty`), and
 * what a shopper can still buy (the difference). The storefront enforces the
 * third, so hiding it here would make the panel and the shop appear to disagree.
 */
export default async function SellerInventoryPage({
  searchParams,
}: PageProps<"/seller/inventory">) {
  const seller = await requireSeller("/seller/inventory");
  const params = await searchParams;

  const filter =
    params.filter === "low" ||
    params.filter === "out" ||
    params.filter === "reserved"
      ? params.filter
      : "all";
  const q = typeof params.q === "string" ? params.q : "";
  const page = Number(params.page) || 1;

  const [{ items, total, pageCount }, counts] = await Promise.all([
    listSellerInventory(seller.sellerId, { filter, q, page }),
    sellerInventoryCounts(seller.sellerId),
  ]);

  const tabs = [
    { key: "all", label: "All products", count: counts.all },
    { key: "low", label: "Low stock", count: counts.low },
    { key: "out", label: "Out of stock", count: counts.out },
    { key: "reserved", label: "Has reservations", count: counts.reserved },
  ];

  const href = (extra: Record<string, string | number>) => {
    const search = new URLSearchParams();
    if (filter !== "all") search.set("filter", filter);
    if (q) search.set("q", q);
    for (const [key, value] of Object.entries(extra)) {
      if (value === "" || value === "all") search.delete(key);
      else search.set(key, String(value));
    }
    const qs = search.toString();
    return qs ? `/seller/inventory?${qs}` : "/seller/inventory";
  };

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <p className="eyebrow mb-2">Inventory</p>
        <h1 className="font-display text-3xl">Inventory</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-400">
          Every change is written to a stock ledger, so a balance can always be
          explained. Stock reserved for orders already placed cannot be removed.
        </p>
      </header>

      <nav aria-label="Filter inventory" className="mb-6">
        <ul className="flex flex-wrap gap-1 border-b border-ivory-400">
          {tabs.map((tab) => {
            const isActive = filter === tab.key;
            return (
              <li key={tab.key}>
                <Link
                  href={href({ filter: tab.key, page: 1 })}
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

      <form action="/seller/inventory" className="mb-6 flex gap-2">
        {filter !== "all" && (
          <input type="hidden" name="filter" value={filter} />
        )}
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search by name or SKU"
          aria-label="Search your inventory"
          className="w-full max-w-sm border border-ivory-400 bg-ivory-50 px-4 py-2.5 text-sm text-ink-900 placeholder:text-ink-400/60 focus:border-brand-600 focus:outline-none"
        />
        <button
          type="submit"
          className="border border-ink-900/15 px-5 text-xs font-medium uppercase tracking-[0.12em] text-ink-900 transition-colors hover:bg-ivory-200"
        >
          Search
        </button>
      </form>

      {items.length === 0 ? (
        <div className="rounded-md border border-ivory-400 bg-ivory-50 p-10 text-center">
          <p className="text-sm text-ink-400">
            {q
              ? `Nothing matches “${q}”.`
              : filter === "all"
                ? "You have no products to stock yet."
                : "Nothing in this view — which is good news."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const available = availableQty(item);
            const image = item.product.images[0];

            return (
              <li
                key={item.id}
                className="rounded-md border border-ivory-400 bg-ivory-50 p-4"
              >
                <div className="flex flex-wrap items-start gap-4">
                  <span className="relative aspect-square w-14 shrink-0 overflow-hidden bg-ivory-200">
                    {image && (
                      <Image
                        src={image.url}
                        alt=""
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/seller/products/${item.product.id}`}
                      className="block truncate text-sm text-ink-900 transition-colors hover:text-brand-600"
                    >
                      {item.product.name}
                    </Link>
                    <p className="mt-0.5 text-xs text-ink-400">
                      {item.product.sku} · updated {formatDate(item.updatedAt)}
                    </p>

                    <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs">
                      <div className="flex gap-1.5">
                        <dt className="text-ink-400">On hand</dt>
                        <dd className="text-ink-900">{item.stockQty}</dd>
                      </div>
                      <div className="flex gap-1.5">
                        <dt className="text-ink-400">Reserved</dt>
                        <dd
                          className={
                            item.reservedQty > 0 ? "text-warning" : "text-ink-900"
                          }
                        >
                          {item.reservedQty}
                        </dd>
                      </div>
                      <div className="flex gap-1.5">
                        <dt className="text-ink-400">Available to buy</dt>
                        <dd
                          className={
                            available === 0 ? "text-danger" : "text-ink-900"
                          }
                        >
                          {available}
                        </dd>
                      </div>
                      <div className="flex gap-1.5">
                        <dt className="text-ink-400">Alert below</dt>
                        <dd className="text-ink-900">
                          {item.lowStockThreshold}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <StatusBadge
                    label={STOCK_LABEL[item.status] ?? item.status}
                    tone={STOCK_TONE[item.status] ?? "neutral"}
                  />
                </div>

                {item.status !== INVENTORY_STATUS.DISCONTINUED && (
                  <div className="mt-4 border-t border-ivory-300 pt-4">
                    <StockAdjustForm
                      productId={item.product.id}
                      stockQty={item.stockQty}
                    />
                  </div>
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
          {page > 1 ? (
            <Link
              href={href({ page: page - 1 })}
              className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500 transition-colors hover:text-brand-600"
            >
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <p className="text-xs text-ink-400">
            Page {page} of {pageCount} · {total} product
            {total === 1 ? "" : "s"}
          </p>
          {page < pageCount ? (
            <Link
              href={href({ page: page + 1 })}
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
