import Link from "next/link";
import Image from "next/image";
import { cn, formatRating } from "@/lib/utils";
import { INVENTORY_STATUS, type PriceTier } from "@/lib/constants";
import { resolvePrice } from "@/lib/catalogue/pricing";
import { Price } from "@/components/storefront/price";
import { RatingStars } from "@/components/storefront/rating-stars";
import type { ProductCard as ProductCardData } from "@/lib/catalogue/queries";

/**
 * Catalogue product card — SRS §158.
 *
 * The image is cropped to a fixed 3:4 with object-cover, not letterboxed. The
 * catalogue is museum textile photography and the source files range from
 * 900×2648 sari scans to wide border bands; fitting them inside a box gives
 * every card a different amount of empty space and makes the best photographs
 * look like the worst. Cropping costs some of the frame and is the right trade.
 */
export function ProductCard({
  product,
  tier,
  priority = false,
}: {
  product: ProductCardData;
  tier: PriceTier;
  priority?: boolean;
}) {
  const price = resolvePrice(product, tier);
  const image = product.images[0];
  const rating = product.ratingAvg / 10;

  const isOutOfStock =
    product.inventory?.status === INVENTORY_STATUS.OUT_OF_STOCK ||
    product.inventory?.status === INVENTORY_STATUS.DISCONTINUED;
  const isLowStock = product.inventory?.status === INVENTORY_STATUS.LOW_STOCK;

  return (
    <article className="group">
      <Link href={`/product/${product.slug}`} className="block">
        <div className="relative aspect-[3/4] overflow-hidden bg-ivory-200">
          {image ? (
            <Image
              src={image.url}
              alt={image.alt}
              fill
              priority={priority}
              sizes="(min-width: 1280px) 20rem, (min-width: 768px) 33vw, 50vw"
              className={cn(
                "object-cover transition-transform duration-500 ease-[var(--ease-out-soft)] group-hover:scale-[1.03]",
                isOutOfStock && "opacity-60",
              )}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-ink-400">
              No image
            </div>
          )}

          <div className="absolute left-0 top-0 flex flex-col items-start gap-1 p-3">
            {price.discountPercent > 0 && (
              <Badge tone="brand">{price.discountPercent}% off</Badge>
            )}
            {product.isNewArrival && <Badge tone="ink">New</Badge>}
            {isOutOfStock && <Badge tone="muted">Sold out</Badge>}
            {isLowStock && !isOutOfStock && (
              <Badge tone="warning">Low stock</Badge>
            )}
          </div>
        </div>

        <div className="pt-3.5">
          <p className="text-[0.625rem] uppercase tracking-[0.12em] text-ink-400">
            {product.fabric ?? product.category.name}
          </p>

          <h3 className="mt-1 line-clamp-2 font-display text-[0.9375rem] leading-snug text-ink-900 transition-colors group-hover:text-brand-600">
            {product.name}
          </h3>

          {product.ratingCount > 0 && (
            <div className="mt-1.5 flex items-center gap-1.5">
              <RatingStars value={rating} />
              <span className="text-[0.6875rem] text-ink-400">
                {formatRating(product.ratingAvg)} ({product.ratingCount})
              </span>
            </div>
          )}

          <Price price={price} size="sm" className="mt-2" />
          {price.isTradePrice && (
            <p className="mt-0.5 text-[0.6875rem] text-ink-400">
              Trade price
              {price.minOrderQty > 1 && ` · min ${price.minOrderQty}`}
            </p>
          )}
        </div>
      </Link>

      {/* Seller attribution is a marketplace obligation, not decoration — the
          seller of record appears on the card, the product page and the
          invoice. Outside the card <Link> so it can be its own link later. */}
      <p className="mt-1.5 text-[0.6875rem] text-ink-400">
        <span className="sr-only">Sold by </span>
        {product.seller.businessName}
        {product.seller.city && ` · ${product.seller.city}`}
      </p>
    </article>
  );
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "brand" | "ink" | "muted" | "warning";
}) {
  const tones = {
    brand: "bg-brand-600 text-ivory-50",
    ink: "bg-ink-900 text-ivory-50",
    muted: "bg-ivory-50 text-ink-900",
    warning: "bg-warning-soft text-warning",
  };

  return (
    <span
      className={cn(
        "px-2 py-1 text-[0.625rem] font-medium uppercase tracking-[0.1em]",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

/** The grid every listing and product rail uses, so they stay in step. */
export function ProductGrid({
  products,
  tier,
  priorityCount = 0,
  className,
}: {
  products: ProductCardData[];
  tier: PriceTier;
  /** How many images to mark priority — only ever the above-the-fold row. */
  priorityCount?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-x-5 gap-y-9 md:grid-cols-3 xl:grid-cols-4",
        className,
      )}
    >
      {products.map((product, index) => (
        <ProductCard
          key={product.id}
          product={product}
          tier={tier}
          priority={index < priorityCount}
        />
      ))}
    </div>
  );
}
