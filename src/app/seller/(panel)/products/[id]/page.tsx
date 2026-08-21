import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSeller } from "@/lib/seller/context";
import {
  getSellerProduct,
  listAssignableCategories,
} from "@/lib/seller/products";
import { PRODUCT_STATUS } from "@/lib/constants";
import { formatDate, formatPaise } from "@/lib/utils";
import { StatusBadge } from "@/components/commerce/status-badge";
import { ProductForm } from "@/components/seller/product-form";
import { ProductStatusActions } from "@/components/seller/product-status-actions";
import {
  PRODUCT_STATUS_LABEL,
  PRODUCT_STATUS_TONE,
} from "@/lib/seller/product-status";

export async function generateMetadata({
  params,
}: PageProps<"/seller/products/[id]">): Promise<Metadata> {
  const seller = await requireSeller();
  const { id } = await params;
  const product = await getSellerProduct(seller.sellerId, id);
  return { title: product ? product.name : "Product" };
}

/**
 * Product detail and edit — SRS §58, §59.
 *
 * `getSellerProduct` scopes on seller id, so another seller's product id in the
 * URL returns null and 404s rather than rendering someone else's catalogue.
 */
export default async function SellerProductPage({
  params,
}: PageProps<"/seller/products/[id]">) {
  const seller = await requireSeller();
  const { id } = await params;

  const [product, categories] = await Promise.all([
    getSellerProduct(seller.sellerId, id),
    listAssignableCategories(),
  ]);

  if (!product) notFound();

  const stock = product.inventory;

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/seller/products"
        className="mb-5 inline-block text-xs font-medium uppercase tracking-[0.14em] text-ink-400 transition-colors hover:text-brand-600"
      >
        ← Products
      </Link>

      <header className="mb-8">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl">{product.name}</h1>
          <StatusBadge
            label={PRODUCT_STATUS_LABEL[product.status] ?? product.status}
            tone={PRODUCT_STATUS_TONE[product.status] ?? "neutral"}
          />
        </div>
        <p className="text-sm text-ink-400">
          {product.sku} · {product.category.name} · updated{" "}
          {formatDate(product.updatedAt)}
        </p>

        {product.status === PRODUCT_STATUS.APPROVED && (
          <Link
            href={`/product/${product.slug}`}
            className="mt-2 inline-block text-xs font-medium uppercase tracking-[0.14em] text-brand-600 hover:underline"
          >
            View on the storefront →
          </Link>
        )}
      </header>

      {/* ---- Rejection feedback ---- */}
      {product.status === PRODUCT_STATUS.REJECTED &&
        product.rejectionReason && (
          <div className="mb-8 rounded-md border border-danger/30 bg-danger-soft p-5">
            <p className="mb-1.5 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-500">
              Why this was rejected
            </p>
            <p className="text-sm leading-relaxed text-ink-900">
              {product.rejectionReason}
            </p>
            <p className="mt-3 text-xs text-ink-500">
              Make the changes below and submit it again.
            </p>
          </div>
        )}

      {/* ---- Status actions ---- */}
      <section className="mb-10 rounded-md border border-ivory-400 bg-ivory-50 p-5">
        <ProductStatusActions productId={product.id} status={product.status} />
      </section>

      {/* ---- At a glance ---- */}
      <div className="mb-10 grid gap-3 sm:grid-cols-3">
        <Figure
          label="In stock"
          value={stock ? String(stock.stockQty) : "—"}
          hint={stock ? `${stock.reservedQty} reserved` : undefined}
        />
        <Figure label="Units sold" value={String(product.salesCount)} />
        <Figure
          label="Rating"
          value={
            product.ratingCount > 0
              ? `${(product.ratingAvg / 10).toFixed(1)} ★`
              : "No reviews"
          }
          hint={
            product.ratingCount > 0
              ? `${product.ratingCount} review${product.ratingCount === 1 ? "" : "s"}`
              : undefined
          }
        />
      </div>

      {/* ---- Images ---- */}
      <section className="mb-10">
        <h2 className="mb-4 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400">
          Images
        </h2>

        {product.images.length === 0 ? (
          <p className="rounded-md border border-ivory-400 bg-ivory-50 px-5 py-4 text-sm text-ink-400">
            No images yet. A product needs at least one before it can be
            submitted for approval.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-3">
            {product.images.map((image) => (
              <li key={image.id} className="relative">
                <span className="relative block aspect-square w-24 overflow-hidden rounded-md border border-ivory-400 bg-ivory-200">
                  <Image
                    src={image.url}
                    alt={image.alt}
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                </span>
                {image.isMain && (
                  <span className="mt-1 block text-center text-[0.625rem] uppercase tracking-[0.12em] text-ink-400">
                    Main
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---- Variants ---- */}
      {product.variants.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400">
            Variants
          </h2>
          <ul className="rounded-md border border-ivory-400 bg-ivory-50">
            {product.variants.map((variant) => (
              <li
                key={variant.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-ivory-300 px-5 py-3 last:border-b-0"
              >
                <div>
                  <p className="text-sm text-ink-900">
                    {variant.name}: {variant.value}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-400">{variant.sku}</p>
                </div>
                <p className="text-sm text-ink-500">
                  {variant.priceDeltaPaise === 0
                    ? "No price change"
                    : `${variant.priceDeltaPaise > 0 ? "+" : "−"}${formatPaise(Math.abs(variant.priceDeltaPaise))}`}
                  <span className="ml-3 text-ink-400">
                    {variant.stockQty} in stock
                  </span>
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---- Edit ---- */}
      <section>
        <h2 className="mb-1 font-display text-xl">Edit details</h2>
        <p className="mb-6 text-xs leading-relaxed text-ink-400">
          {product.status === PRODUCT_STATUS.APPROVED
            ? "This product is live. Saving changes sends it back for approval before they appear on the storefront."
            : "Changes are saved immediately."}
        </p>
        <ProductForm product={product} categories={categories} />
      </section>
    </div>
  );
}

function Figure({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-md border border-ivory-400 bg-ivory-50 p-4">
      <p className="text-xs text-ink-400">{label}</p>
      <p className="mt-1 font-display text-xl text-ink-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-400">{hint}</p>}
    </div>
  );
}
