import Link from "next/link";
import Image from "next/image";
import { cn, formatRating } from "@/lib/utils";
import { type PriceTier } from "@/lib/constants";
import { availabilityOf } from "@/lib/catalogue/availability";
import { resolvePrice } from "@/lib/catalogue/pricing";
import { Price } from "@/components/storefront/price";
import { RatingStars } from "@/components/storefront/rating-stars";
import { WishlistButton } from "@/components/storefront/wishlist-button";
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
  wishlisted,
}: {
  product: ProductCardData;
  tier: PriceTier;
  priority?: boolean;
  /**
   * `undefined` — the caller has not wired up wishlist state, so no heart is
   * shown. `null` — no customer is signed in. `Set` — the saved product ids
   * for the signed-in customer.
   */
  wishlisted?: Set<string> | null;
}) {
  const price = resolvePrice(product, tier);
  const image = product.images[0];
  const rating = product.ratingAvg / 10;

  const availability = availabilityOf(product);
  // Only a listing that cannot be bought at all is dimmed. A made-to-order
  // piece with an empty shelf is still for sale, so greying it out would be a
  // lie told in CSS.
  const isUnavailable = !availability.isPurchasable;

  return (
    <article className="group relative">
      {/* A sibling of the card <Link>, not a descendant — an anchor cannot
          contain another anchor, and this button has to stay clickable on its
          own without navigating to the product. */}
      {wishlisted !== undefined && (
        <WishlistButton
          productId={product.id}
          initialSaved={wishlisted ? wishlisted.has(product.id) : null}
          signInHref={`/login?next=${encodeURIComponent("/account/wishlist")}`}
        />
      )}

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
                isUnavailable && "opacity-60",
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
            {availability.state === "MADE_TO_ORDER" && (
              <Badge tone="loom">On the loom</Badge>
            )}
            {availability.state === "LOW_STOCK" && (
              <Badge tone="warning">Low stock</Badge>
            )}
            {(availability.state === "SOLD_OUT" ||
              availability.state === "DISCONTINUED") && (
              <Badge tone="muted">{availability.label}</Badge>
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
  tone: "brand" | "ink" | "muted" | "warning" | "loom";
}) {
  const tones = {
    brand: "bg-brand-600 text-cream",
    ink: "bg-scrim text-cream",
    muted: "bg-ivory-50 text-ink-900",
    warning: "bg-warning-soft text-warning",
    // Gold, not the warning amber: being woven to order is a mark of the piece,
    // not a problem with it.
    loom: "bg-gold-400 text-brand-950",
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
  wishlisted,
  className,
}: {
  products: ProductCardData[];
  tier: PriceTier;
  /** How many images to mark priority — only ever the above-the-fold row. */
  priorityCount?: number;
  wishlisted?: Set<string> | null;
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
          wishlisted={wishlisted}
        />
      ))}
    </div>
  );
}
