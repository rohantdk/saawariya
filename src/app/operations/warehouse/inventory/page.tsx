import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { requireOperations } from "@/lib/operations/context";
import {
  listWarehouseInventory,
  warehouseInventoryCounts,
  type WarehouseInventoryFilter,
} from "@/lib/operations/warehouse";
import { StatusBadge } from "@/components/commerce/status-badge";
import { availableQty } from "@/lib/inventory-status";
import { INVENTORY_STATUS, ROLES } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Warehouse stock" };

const TABS: { key: WarehouseInventoryFilter; label: string; count: keyof Awaited<ReturnType<typeof warehouseInventoryCounts>> }[] =
  [
    { key: "alerts", label: "Needs attention", count: "alerts" },
    { key: "low", label: "Low", count: "low" },
    { key: "out", label: "Out of stock", count: "out" },
    { key: "reserved", label: "Holding orders", count: "reserved" },
    { key: "all", label: "Everything", count: "all" },
  ];

const TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  [INVENTORY_STATUS.IN_STOCK]: "success",
  [INVENTORY_STATUS.LOW_STOCK]: "warning",
  [INVENTORY_STATUS.OUT_OF_STOCK]: "danger",
  [INVENTORY_STATUS.DISCONTINUED]: "neutral",
};

/**
 * Stock across every seller — SRS §98.
 *
 * Read-only, like the admin console's inventory screen and for the same reason:
 * `stockQty` states what is physically on a shelf, and a screen that lets
 * someone type a different number produces a figure with nothing behind it.
 * The warehouse's one write is a shortage or damage report against the parcel
 * it is picking, which lives on that parcel's page and leaves a ledger row.
 *
 * "Needs attention" is the default view. A warehouse opening a stock screen is
 * asking what is about to run out, not for an alphabetical catalogue.
 */
export default async function WarehouseInventoryPage({
  searchParams,
}: PageProps<"/operations/warehouse/inventory">) {
  await requireOperations(ROLES.WAREHOUSE, "/operations/warehouse/inventory");
  const params = await searchParams;

  const filter = (
    TABS.some((tab) => tab.key === params.filter) ? params.filter : "alerts"
  ) as WarehouseInventoryFilter;
  const q = typeof params.q === "string" ? params.q : "";
  const page = Number(params.page) || 1;

  const [{ items, total, pageCount, page: current }, counts] = await Promise.all(
    [listWarehouseInventory({ filter, q, page }), warehouseInventoryCounts()],
  );

  const href = (extra: Record<string, string | number>) => {
    const search = new URLSearchParams();
    if (filter !== "alerts") search.set("filter", filter);
    if (q) search.set("q", q);
    for (const [key, value] of Object.entries(extra)) {
      if (value === "") search.delete(key);
      else search.set(key, String(value));
    }
    const qs = search.toString();
    return qs ? `/operations/warehouse/inventory?${qs}` : "/operations/warehouse/inventory";
  };

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <p className="eyebrow mb-2">Stock</p>
        <h1 className="font-display text-3xl">Stock</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-400">
          Every seller&rsquo;s goods, as held in the Saawariya warehouse. Free
          stock is what is on the shelf less what live orders are already
          holding — it is the number the storefront sells against.
        </p>
      </header>

      <nav aria-label="Filter stock" className="mb-5">
        <ul className="flex flex-wrap gap-1 border-b border-ivory-400">
          {TABS.map((tab) => {
            const isActive = filter === tab.key;
            return (
              <li key={tab.key}>
                <Link
                  href={href({ filter: tab.key, page: "" })}
                  aria-current={isActive ? "page" : undefined}
                  className={`-mb-px inline-flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm transition-colors ${
                    isActive
                      ? "border-brand-600 text-brand-600"
                      : "border-transparent text-ink-500 hover:text-ink-900"
                  }`}
                >
                  {tab.label}
                  <span className="text-xs text-ink-400">
                    {counts[tab.count]}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <form action="/operations/warehouse/inventory" className="mb-6 flex gap-2">
        {filter !== "alerts" && (
          <input type="hidden" name="filter" value={filter} />
        )}
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Product, SKU or seller"
          aria-label="Search stock"
          className="rounded-md w-full max-w-md border border-ivory-400 bg-ivory-50 px-4 py-2.5 text-sm text-ink-900 placeholder:text-ink-400/60 focus:border-brand-600 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-md border border-ink-900/15 px-5 text-xs font-medium uppercase tracking-[0.12em] text-ink-900 transition-colors hover:bg-ivory-200"
        >
          Search
        </button>
      </form>

      {items.length === 0 ? (
        <div className="rounded-md border border-ivory-400 bg-ivory-50 p-10 text-center">
          <p className="text-sm text-ink-400">
            {q ? `No stock matches “${q}”.` : "Nothing in this view."}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center gap-4 rounded-md border border-ivory-400 bg-ivory-50 p-3"
            >
              {item.product.images[0] && (
                <Image
                  src={item.product.images[0].url}
                  alt=""
                  width={48}
                  height={48}
                  className="h-12 w-12 shrink-0 object-cover"
                />
              )}

              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink-900">{item.product.name}</p>
                <p className="mt-0.5 text-xs text-ink-400">
                  {item.product.sku} · {item.product.seller.businessName} ·
                  updated {formatDateTime(item.updatedAt)}
                </p>
              </div>

              <div className="flex min-w-0 shrink-0 items-center gap-5 text-right">
                <div className="min-w-0">
                  <p className="font-display text-lg text-ink-900">
                    {item.stockQty}
                  </p>
                  <p className="text-[0.6875rem] text-ink-400">on shelf</p>
                </div>
                <div className="min-w-0">
                  <p className="font-display text-lg text-ink-900">
                    {item.reservedQty}
                  </p>
                  <p className="text-[0.6875rem] text-ink-400">reserved</p>
                </div>
                <div className="min-w-0">
                  <p className="font-display text-lg text-ink-900">
                    {availableQty(item)}
                  </p>
                  <p className="text-[0.6875rem] text-ink-400">free</p>
                </div>
                <StatusBadge
                  label={item.status.replace(/_/g, " ").toLowerCase()}
                  tone={TONE[item.status] ?? "neutral"}
                />
              </div>
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
            Page {current} of {pageCount} · {total} product
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
