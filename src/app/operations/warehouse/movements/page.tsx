import type { Metadata } from "next";
import Link from "next/link";
import { requireOperations } from "@/lib/operations/context";
import {
  listStockMovements,
  stockMovementReasons,
} from "@/lib/operations/warehouse";
import { STOCK_REASON_LABEL } from "@/lib/seller/inventory";
import { ROLES } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Stock ledger" };

/**
 * The stock ledger — SRS §97.
 *
 * Append-only by construction: nothing anywhere in the codebase updates or
 * deletes a `StockMovement`, so every row here corresponds to something that
 * actually happened. That is what makes it usable as the answer to "where did
 * those units go", which is the question a shortage raises and the reason this
 * screen exists rather than a stock-edit form.
 *
 * A zero in the quantity column is not a bug. A cancellation releases a hold
 * without moving any goods, so its row records the release and moves nothing —
 * the alternative, writing no row at all, would make a reservation drop
 * untraceable.
 */
export default async function StockLedgerPage({
  searchParams,
}: PageProps<"/operations/warehouse/movements">) {
  await requireOperations(ROLES.WAREHOUSE, "/operations/warehouse/movements");
  const params = await searchParams;

  const reason = typeof params.reason === "string" ? params.reason : "all";
  const q = typeof params.q === "string" ? params.q : "";
  const page = Number(params.page) || 1;

  const [{ movements, total, pageCount, page: current }, reasons] =
    await Promise.all([
      listStockMovements({ reason, q, page }),
      stockMovementReasons(),
    ]);

  const href = (extra: Record<string, string | number>) => {
    const search = new URLSearchParams();
    if (reason !== "all") search.set("reason", reason);
    if (q) search.set("q", q);
    for (const [key, value] of Object.entries(extra)) {
      if (value === "" || value === "all") search.delete(key);
      else search.set(key, String(value));
    }
    const qs = search.toString();
    return qs
      ? `/operations/warehouse/movements?${qs}`
      : "/operations/warehouse/movements";
  };

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <p className="eyebrow mb-2">SRS §97 — Stock movement</p>
        <h1 className="font-display text-3xl">Stock ledger</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-400">
          Every change to every stock figure, newest first. Nothing here can be
          edited or removed — a ledger someone can rewrite is not a ledger.
        </p>
      </header>

      <nav aria-label="Filter by reason" className="mb-5">
        <ul className="flex flex-wrap gap-1 border-b border-ivory-400">
          {[{ reason: "all", count: total }, ...reasons].map((option) => {
            const isActive = reason === option.reason;
            return (
              <li key={option.reason}>
                <Link
                  href={href({ reason: option.reason, page: "" })}
                  aria-current={isActive ? "page" : undefined}
                  className={`-mb-px inline-flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm transition-colors ${
                    isActive
                      ? "border-brand-600 text-brand-600"
                      : "border-transparent text-ink-500 hover:text-ink-900"
                  }`}
                >
                  {option.reason === "all"
                    ? "All"
                    : (STOCK_REASON_LABEL[option.reason] ?? option.reason)}
                  <span className="text-xs text-ink-400">{option.count}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <form action="/operations/warehouse/movements" className="mb-6 flex gap-2">
        {reason !== "all" && (
          <input type="hidden" name="reason" value={reason} />
        )}
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Product or SKU"
          aria-label="Search the ledger"
          className="w-full max-w-md border border-ivory-400 bg-ivory-50 px-4 py-2.5 text-sm text-ink-900 placeholder:text-ink-400/60 focus:border-brand-600 focus:outline-none"
        />
        <button
          type="submit"
          className="border border-ink-900/15 px-5 text-xs font-medium uppercase tracking-[0.12em] text-ink-900 transition-colors hover:bg-ivory-200"
        >
          Search
        </button>
      </form>

      {movements.length === 0 ? (
        <div className="border border-ivory-400 bg-ivory-50 p-10 text-center">
          <p className="text-sm text-ink-400">Nothing in this view.</p>
        </div>
      ) : (
        <ul className="divide-y divide-ivory-300 border border-ivory-400 bg-ivory-50">
          {movements.map((movement) => (
            <li key={movement.id} className="flex flex-wrap gap-4 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink-900">
                  {movement.inventory.product.name}
                </p>
                <p className="mt-0.5 text-xs text-ink-400">
                  {movement.inventory.product.sku} ·{" "}
                  {movement.inventory.product.seller.businessName}
                </p>
                {movement.note && (
                  <p className="mt-1 text-xs leading-relaxed text-ink-500">
                    {movement.note}
                  </p>
                )}
              </div>

              <div className="shrink-0 text-right">
                <p
                  className={`font-display text-lg ${
                    movement.changeQty > 0
                      ? "text-success"
                      : movement.changeQty < 0
                        ? "text-danger"
                        : "text-ink-400"
                  }`}
                >
                  {movement.changeQty > 0 ? "+" : ""}
                  {movement.changeQty}
                </p>
                <p className="text-[0.6875rem] uppercase tracking-[0.1em] text-ink-400">
                  {STOCK_REASON_LABEL[movement.reason] ?? movement.reason}
                </p>
                <p className="mt-0.5 text-[0.6875rem] text-ink-400">
                  {formatDateTime(movement.createdAt)}
                </p>
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
            Page {current} of {pageCount} · {total} movement
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
