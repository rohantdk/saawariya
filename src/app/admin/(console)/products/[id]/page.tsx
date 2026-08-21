import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/context";
import { getProductForReview } from "@/lib/admin/products";
import {
  PRODUCT_STATUS_LABEL,
  PRODUCT_STATUS_TONE,
} from "@/lib/seller/product-status";
import {
  PRODUCT_STATUS,
  SELLER_VERIFICATION,
  SELLER_VERIFICATION_LABEL,
} from "@/lib/constants";
import { INVENTORY_STATUS_TONE, SELLER_STATUS_TONE } from "@/lib/status-tone";
import { cn, formatDate, formatPaise, formatRating } from "@/lib/utils";
import { StatusBadge } from "@/components/commerce/status-badge";
import { ProductDecision } from "@/components/admin/product-actions";

export const metadata: Metadata = { title: "Product review" };

/**
 * One product, as an approver sees it — SRS §75.
 *
 * Everything a decision rests on is above the fold: the images, the textile
 * attributes the storefront filters on, both price tiers, the MOQ, and who is
 * selling it. The public product page is linked rather than embedded — an
 * approved product should be checked where a customer will see it, and a
 * pending one deliberately 404s there, which is itself worth being able to
 * confirm.
 */
export default async function AdminProductReviewPage({
  params,
}: PageProps<"/admin/products/[id]">) {
  await requireAdmin("/admin/products");
  const { id } = await params;

  const product = await getProductForReview(id);
  if (!product) notFound();

  const sellerUnverified =
    product.seller.verificationStatus !== SELLER_VERIFICATION.APPROVED;
  const isLive = product.status === PRODUCT_STATUS.APPROVED;

  const attributes: [string, string | null][] = [
    ["Category", product.category.parent
      ? `${product.category.parent.name} › ${product.category.name}`
      : product.category.name],
    ["Fabric", product.fabric],
    ["Pattern", product.pattern],
    ["Occasion", product.occasion],
    ["Work", product.workType],
    ["Colour", product.color],
    ["Brand", product.brand],
    ["Collection", product.collection],
    ["Weight", product.weightGrams ? `${product.weightGrams} g` : null],
  ];

  const pricing: [string, string][] = [
    ["Retail", formatPaise(product.priceRetail)],
    [
      "Wholesale",
      product.priceWholesale ? formatPaise(product.priceWholesale) : "—",
    ],
    ["Offer", product.priceOffer ? formatPaise(product.priceOffer) : "—"],
    ["Effective", formatPaise(product.priceEffective)],
    [
      "Order quantity",
      `${product.minOrderQty} – ${product.maxOrderQty}`,
    ],
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/admin/products"
        className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500 transition-colors hover:text-brand-600"
      >
        ← Approval queue
      </Link>

      <header className="mb-8 mt-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl">{product.name}</h1>
          <StatusBadge
            label={PRODUCT_STATUS_LABEL[product.status] ?? product.status}
            tone={PRODUCT_STATUS_TONE[product.status] ?? "neutral"}
          />
        </div>
        <p className="mt-2 text-sm text-ink-400">
          {product.sku} ·{" "}
          <Link
            href={`/admin/sellers/${product.seller.id}`}
            className="text-ink-500 underline-offset-4 hover:text-brand-600 hover:underline"
          >
            {product.seller.businessName}
          </Link>{" "}
          · submitted {formatDate(product.createdAt)} · updated{" "}
          {formatDate(product.updatedAt)}
        </p>
      </header>

      {/* ---- Decision ---- */}
      <section className="mb-8 border border-ivory-400 bg-ivory-50 p-5">
        <p className="mb-4 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400">
          Approval decision
        </p>
        <ProductDecision productId={product.id} status={product.status} />

        {product.rejectionReason && (
          <p className="mt-4 border-t border-ivory-300 pt-4 text-xs leading-relaxed text-danger">
            <span className="font-medium uppercase tracking-[0.14em]">
              Current feedback —{" "}
            </span>
            {product.rejectionReason}
          </p>
        )}

        {product.approvedAt && (
          <p className="mt-4 border-t border-ivory-300 pt-4 text-xs text-ink-400">
            Approved {formatDate(product.approvedAt)}
            {product.approvedBy && ` by ${product.approvedBy.fullName}`}
          </p>
        )}

        {sellerUnverified && (
          <p className="mt-4 border-t border-ivory-300 pt-4 text-xs leading-relaxed text-warning">
            {product.seller.businessName} is{" "}
            {(
              SELLER_VERIFICATION_LABEL[product.seller.verificationStatus] ??
              product.seller.verificationStatus
            ).toLowerCase()}
            . The storefront filters on seller verification as well as product
            status, so approving this listing will not put it on sale until the
            seller is verified.
          </p>
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-[1fr_18rem]">
        <div className="min-w-0 space-y-8">
          {/* ---- Imagery ---- */}
          <section>
            <h2 className="mb-3 font-display text-xl">
              Images{" "}
              <span className="font-sans text-sm text-ink-400">
                ({product.images.length})
              </span>
            </h2>
            {product.images.length === 0 ? (
              <div className="border border-danger/30 bg-danger-soft p-6 text-center text-sm text-danger">
                This listing has no photographs and cannot be approved.
              </div>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {product.images.map((image) => (
                  <li key={image.id} className="relative">
                    <span className="relative block aspect-square overflow-hidden bg-ivory-200">
                      <Image
                        src={image.url}
                        alt={image.alt}
                        fill
                        sizes="(min-width: 640px) 160px, 45vw"
                        className="object-cover"
                      />
                    </span>
                    {image.isMain && (
                      <span className="absolute left-1.5 top-1.5 bg-ink-900/80 px-1.5 py-0.5 text-[0.625rem] uppercase tracking-[0.1em] text-ivory-50">
                        Main
                      </span>
                    )}
                    {image.kind !== "FRONT" && (
                      <span className="absolute bottom-1.5 left-1.5 bg-ivory-50/90 px-1.5 py-0.5 text-[0.625rem] uppercase tracking-[0.1em] text-ink-900">
                        {image.kind.toLowerCase()}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {/*
              The reverse-side check.

              Advisory rather than blocking, and deliberately so: the seeded
              catalogue predates the requirement, and a hard gate would put
              every already-approved listing into breach the moment it was next
              edited. It states the position, names what is missing, and leaves
              the decision with the reviewer — which is what the rest of this
              screen does too.
            */}
            {product.images.length > 0 && (
              <p
                className={cn(
                  "mt-3 border px-4 py-3 text-sm",
                  product.images.some((image) => image.kind === "REVERSE")
                    ? "border-success/30 bg-success-soft text-success"
                    : "border-warning/30 bg-warning-soft text-warning",
                )}
              >
                {product.images.some((image) => image.kind === "REVERSE")
                  ? "Reverse-side photograph supplied — the back of the cloth can be assessed."
                  : "No reverse-side photograph. Ask the seller for one before approving: the back of the cloth is where float length and finishing are visible."}
              </p>
            )}
          </section>

          {/* ---- Description ---- */}
          <section>
            <h2 className="mb-3 font-display text-xl">Description</h2>
            <p className="whitespace-pre-line border border-ivory-400 bg-ivory-50 p-5 text-sm leading-relaxed text-ink-900">
              {product.description}
            </p>
          </section>

          {/* ---- Attributes ---- */}
          <section>
            <h2 className="mb-3 font-display text-xl">Textile details</h2>
            <dl className="border border-ivory-400 bg-ivory-50">
              {attributes.map(([label, value]) => (
                <div
                  key={label}
                  className="flex flex-wrap gap-x-6 gap-y-1 border-b border-ivory-300 px-5 py-3 last:border-b-0"
                >
                  <dt className="w-32 shrink-0 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400">
                    {label}
                  </dt>
                  <dd className="min-w-0 flex-1 text-sm text-ink-900">
                    {value ?? <span className="text-ink-400">Not given</span>}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          {/* ---- Variants ---- */}
          {product.variants.length > 0 && (
            <section>
              <h2 className="mb-3 font-display text-xl">Variants</h2>
              <ul className="border border-ivory-400 bg-ivory-50">
                {product.variants.map((variant) => (
                  <li
                    key={variant.id}
                    className="flex flex-wrap items-center gap-3 border-b border-ivory-300 px-5 py-3 last:border-b-0"
                  >
                    <span className="min-w-0 flex-1 text-sm text-ink-900">
                      {variant.name}: {variant.value}
                    </span>
                    <span className="text-xs text-ink-400">{variant.sku}</span>
                    <span className="text-xs text-ink-500">
                      {variant.priceDeltaPaise === 0
                        ? "No price change"
                        : `${variant.priceDeltaPaise > 0 ? "+" : "−"}${formatPaise(
                            Math.abs(variant.priceDeltaPaise),
                          )}`}
                    </span>
                    <span className="text-xs text-ink-400">
                      {variant.stockQty} in stock
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* ---- Sidebar ---- */}
        <aside className="space-y-6">
          <section className="border border-ivory-400 bg-ivory-50 p-5">
            <p className="mb-4 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400">
              Pricing
            </p>
            <dl className="space-y-3 text-sm">
              {pricing.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="text-ink-400">{label}</dt>
                  <dd className="text-ink-900">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="border border-ivory-400 bg-ivory-50 p-5">
            <p className="mb-4 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400">
              Stock &amp; performance
            </p>
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-ink-400">Inventory</dt>
                <dd>
                  {product.inventory ? (
                    <StatusBadge
                      label={product.inventory.status.replace(/_/g, " ")}
                      tone={
                        INVENTORY_STATUS_TONE[product.inventory.status] ??
                        "neutral"
                      }
                    />
                  ) : (
                    <span className="text-ink-400">No record</span>
                  )}
                </dd>
              </div>
              {product.inventory && (
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-400">On hand</dt>
                  <dd className="text-ink-900">
                    {product.inventory.stockQty} ({product.inventory.reservedQty}{" "}
                    reserved)
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-ink-400">Units sold</dt>
                <dd className="text-ink-900">{product.salesCount}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-400">Rating</dt>
                <dd className="text-ink-900">
                  {product.ratingCount > 0
                    ? `${formatRating(product.ratingAvg)} ★ (${product.ratingCount})`
                    : "No reviews"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-400">On orders</dt>
                <dd className="text-ink-900">{product._count.orderItems}</dd>
              </div>
            </dl>
          </section>

          <section className="border border-ivory-400 bg-ivory-50 p-5">
            <p className="mb-4 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400">
              Seller
            </p>
            <p className="text-sm text-ink-900">
              {product.seller.businessName}
            </p>
            <p className="mt-0.5 text-xs text-ink-400">
              {product.seller.user.email}
            </p>
            <div className="mt-3">
              <StatusBadge
                label={
                  SELLER_VERIFICATION_LABEL[
                    product.seller.verificationStatus
                  ] ?? product.seller.verificationStatus
                }
                tone={
                  SELLER_STATUS_TONE[product.seller.verificationStatus] ??
                  "neutral"
                }
              />
            </div>
            <Link
              href={`/admin/sellers/${product.seller.id}`}
              className="mt-4 inline-block text-xs font-medium uppercase tracking-[0.14em] text-ink-500 transition-colors hover:text-brand-600"
            >
              Seller record →
            </Link>
          </section>

          {isLive && (
            <Link
              href={`/product/${product.slug}`}
              className="block border border-ivory-400 bg-ivory-50 p-5 text-xs font-medium uppercase tracking-[0.14em] text-ink-500 transition-colors hover:border-ink-400 hover:text-brand-600"
            >
              View on the storefront →
            </Link>
          )}
        </aside>
      </div>
    </div>
  );
}
