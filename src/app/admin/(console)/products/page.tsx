import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/context";
import {
  listProducts,
  productCounts,
  productFilterOptions,
} from "@/lib/admin/products";
import {
  PRODUCT_STATUS_LABEL,
  PRODUCT_STATUS_TONE,
} from "@/lib/seller/product-status";
import { PRODUCT_STATUS, SELLER_VERIFICATION } from "@/lib/constants";
import { formatPaise } from "@/lib/utils";
import { StatusBadge } from "@/components/commerce/status-badge";
import { Select } from "@/components/ui/field";

export const metadata: Metadata = { title: "Products" };

const TABS = [
  { key: PRODUCT_STATUS.PENDING, label: "Awaiting approval" },
  { key: "all", label: "All" },
  { key: PRODUCT_STATUS.APPROVED, label: "Live" },
  { key: PRODUCT_STATUS.REJECTED, label: "Rejected" },
  { key: PRODUCT_STATUS.HIDDEN, label: "Hidden" },
  { key: PRODUCT_STATUS.DRAFT, label: "Drafts" },
];

/**
 * The product approval queue — SRS §75.
 *
 * "Awaiting approval" is the first tab, not "All": this screen is a queue
 * before it is a catalogue browser, and the default view should be the work.
 * The seller and category filters are plain `<select>`s inside a GET form, so
 * the whole filter state stays in the URL exactly as on the storefront.
 */
export default async function AdminProductsPage({
  searchParams,
}: PageProps<"/admin/products">) {
  await requireAdmin("/admin/products");
  const params = await searchParams;

  const status =
    typeof params.status === "string" ? params.status : PRODUCT_STATUS.PENDING;
  const sellerId = typeof params.sellerId === "string" ? params.sellerId : "";
  const categoryId =
    typeof params.categoryId === "string" ? params.categoryId : "";
  const q = typeof params.q === "string" ? params.q : "";
  const page = Number(params.page) || 1;

  const [{ products, total, pageCount, page: current }, counts, options] =
    await Promise.all([
      listProducts({ status, sellerId, categoryId, q, page }),
      productCounts(),
      productFilterOptions(),
    ]);

  const keep = (extra: Record<string, string | number>) => {
    const search = new URLSearchParams();
    if (status) search.set("status", status);
    if (sellerId) search.set("sellerId", sellerId);
    if (categoryId) search.set("categoryId", categoryId);
    if (q) search.set("q", q);
    for (const [key, value] of Object.entries(extra)) {
      if (value === "") search.delete(key);
      else search.set(key, String(value));
    }
    const qs = search.toString();
    return qs ? `/admin/products?${qs}` : "/admin/products";
  };

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <p className="eyebrow mb-2">Product approval</p>
        <h1 className="font-display text-3xl">Products</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-400">
          Approving a listing publishes it, provided its seller is verified.
          Rejecting sends it back with the reason attached.
        </p>
      </header>

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

      <form
        action="/admin/products"
        className="mb-6 flex flex-wrap items-center gap-2"
      >
        <input type="hidden" name="status" value={status} />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Name, SKU, collection or seller"
          aria-label="Search products"
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
        <Select
          name="categoryId"
          defaultValue={categoryId}
          aria-label="Filter by category"
          className="w-full py-2.5 sm:w-56"
        >
          <option value="">All categories</option>
          {options.categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.label}
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

      {products.length === 0 ? (
        <div className="rounded-md border border-ivory-400 bg-ivory-50 p-10 text-center">
          <p className="text-sm text-ink-400">
            {status === PRODUCT_STATUS.PENDING && !q && !sellerId && !categoryId
              ? "The approval queue is empty. Nothing is waiting on you."
              : "No products match these filters."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {products.map((product) => {
            const image = product.images[0];
            const sellerUnverified =
              product.seller.verificationStatus !== SELLER_VERIFICATION.APPROVED;

            return (
              <li key={product.id}>
                <Link
                  href={`/admin/products/${product.id}`}
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
                      {product.sku} · {product.category.name} ·{" "}
                      {product.seller.businessName}
                    </p>
                    <p className="mt-1 text-xs text-ink-500">
                      {formatPaise(product.priceEffective)}
                      {product.priceOffer && (
                        <span className="ml-1.5 text-ink-400 line-through">
                          {formatPaise(product.priceRetail)}
                        </span>
                      )}
                      {product.inventory && (
                        <span className="ml-2 text-ink-400">
                          {product.inventory.stockQty} in stock
                        </span>
                      )}
                    </p>
                    {product.rejectionReason &&
                      product.status === PRODUCT_STATUS.REJECTED && (
                        <p className="mt-1 text-xs text-danger">
                          {product.rejectionReason}
                        </p>
                      )}
                    {sellerUnverified && (
                      <p className="mt-1 text-xs text-warning">
                        Seller is not verified — this cannot appear on the
                        storefront yet.
                      </p>
                    )}
                  </div>

                  <StatusBadge
                    label={PRODUCT_STATUS_LABEL[product.status] ?? product.status}
                    tone={PRODUCT_STATUS_TONE[product.status] ?? "neutral"}
                  />
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
