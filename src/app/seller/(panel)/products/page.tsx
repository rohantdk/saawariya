import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { requireSeller } from "@/lib/seller/context";
import {
  listSellerProducts,
  sellerProductCounts,
} from "@/lib/seller/products";
import { PRODUCT_STATUS } from "@/lib/constants";
import { formatPaise, formatRating } from "@/lib/utils";
import { StatusBadge } from "@/components/commerce/status-badge";
import { ButtonLink } from "@/components/ui/button";
import {
  PRODUCT_STATUS_LABEL,
  PRODUCT_STATUS_TONE,
} from "@/lib/seller/product-status";

export const metadata: Metadata = { title: "Products" };

const TABS = [
  { key: "all", label: "All" },
  { key: PRODUCT_STATUS.APPROVED, label: "Live" },
  { key: PRODUCT_STATUS.PENDING, label: "In review" },
  { key: PRODUCT_STATUS.DRAFT, label: "Drafts" },
  { key: PRODUCT_STATUS.REJECTED, label: "Rejected" },
  { key: PRODUCT_STATUS.HIDDEN, label: "Hidden" },
];

/**
 * Seller catalogue — SRS §58, §59.
 *
 * Filters and paging are links carrying query strings, not client state — the
 * same decision as the Phase 3 shop filters. It works without JavaScript, every
 * view is bookmarkable, and there is no client state that can drift out of step
 * with the URL.
 */
export default async function SellerProductsPage({
  searchParams,
}: PageProps<"/seller/products">) {
  const seller = await requireSeller("/seller/products");
  const params = await searchParams;

  const status = typeof params.status === "string" ? params.status : "all";
  const q = typeof params.q === "string" ? params.q : "";
  const page = Number(params.page) || 1;

  const [{ products, total, pageCount }, counts] = await Promise.all([
    listSellerProducts(seller.sellerId, { status, q, page }),
    sellerProductCounts(seller.sellerId),
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
    return qs ? `/seller/products?${qs}` : "/seller/products";
  };

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">Catalogue</p>
          <h1 className="font-display text-3xl">Products</h1>
        </div>
        <ButtonLink href="/seller/products/new">Add a product</ButtonLink>
      </header>

      {/* ---- Status tabs ---- */}
      <nav aria-label="Filter by status" className="mb-5">
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

      {/* ---- Search ---- */}
      <form action="/seller/products" className="mb-6 flex gap-2">
        {status !== "all" && (
          <input type="hidden" name="status" value={status} />
        )}
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search by name, SKU or collection"
          aria-label="Search your products"
          className="w-full max-w-sm border border-ivory-400 bg-ivory-50 px-4 py-2.5 text-sm text-ink-900 placeholder:text-ink-400/60 focus:border-brand-600 focus:outline-none"
        />
        <button
          type="submit"
          className="border border-ink-900/15 px-5 text-xs font-medium uppercase tracking-[0.12em] text-ink-900 transition-colors hover:bg-ivory-200"
        >
          Search
        </button>
      </form>

      {/* ---- List ---- */}
      {products.length === 0 ? (
        <div className="rounded-md border border-ivory-400 bg-ivory-50 p-10 text-center">
          <p className="text-sm text-ink-400">
            {q
              ? `No products match “${q}”.`
              : status === "all"
                ? "You have not listed a product yet."
                : `Nothing in ${(PRODUCT_STATUS_LABEL[status] ?? status).toLowerCase()}.`}
          </p>
          {status === "all" && !q && (
            <ButtonLink href="/seller/products/new" className="mt-5">
              Add your first product
            </ButtonLink>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {products.map((product) => {
            const image = product.images[0];
            const stock = product.inventory;

            return (
              <li key={product.id}>
                <Link
                  href={`/seller/products/${product.id}`}
                  className="flex flex-wrap items-center gap-4 rounded-md border border-ivory-400 bg-ivory-50 p-4 transition-colors hover:border-ink-400"
                >
                  <span className="relative aspect-square w-16 shrink-0 overflow-hidden bg-ivory-200">
                    {image && (
                      <Image
                        src={image.url}
                        alt=""
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink-900">
                      {product.name}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-400">
                      {product.sku} · {product.category.name}
                    </p>
                    <p className="mt-1 text-xs text-ink-500">
                      {formatPaise(product.priceEffective)}
                      {product.priceOffer && (
                        <span className="ml-1.5 text-ink-400 line-through">
                          {formatPaise(product.priceRetail)}
                        </span>
                      )}
                      {product.ratingCount > 0 && (
                        <span className="ml-2 text-ink-400">
                          ★ {formatRating(product.ratingAvg)} (
                          {product.ratingCount})
                        </span>
                      )}
                    </p>
                    {product.status === PRODUCT_STATUS.REJECTED &&
                      product.rejectionReason && (
                        <p className="mt-1 text-xs text-danger">
                          {product.rejectionReason}
                        </p>
                      )}
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <StatusBadge
                      label={
                        PRODUCT_STATUS_LABEL[product.status] ?? product.status
                      }
                      tone={PRODUCT_STATUS_TONE[product.status] ?? "neutral"}
                    />
                    <span
                      className={`text-xs ${
                        !stock || stock.stockQty === 0
                          ? "text-danger"
                          : "text-ink-400"
                      }`}
                    >
                      {stock ? `${stock.stockQty} in stock` : "No stock record"}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {/* ---- Paging ---- */}
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
            Page {page} of {pageCount} · {total} product
            {total === 1 ? "" : "s"}
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
