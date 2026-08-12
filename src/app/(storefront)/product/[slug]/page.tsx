import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/dal";
import { formatPaise } from "@/lib/utils";
import { viewerTier } from "@/lib/catalogue/pricing";
import { getCustomerContext } from "@/lib/commerce/context";
import { getCommerceSettings } from "@/lib/commerce/settings";
import { isWishlisted } from "@/lib/commerce/wishlist";
import {
  getProductBySlug,
  getProductReviews,
  getRelatedProducts,
} from "@/lib/catalogue/queries";
import { SELLER_VERIFICATION } from "@/lib/constants";
import { Breadcrumbs } from "@/components/storefront/breadcrumbs";
import { ProductBuyPanel } from "@/components/storefront/product-buy-panel";
import { ProductGallery } from "@/components/storefront/product-gallery";
import { ProductGrid } from "@/components/storefront/product-card";
import { RatingStars } from "@/components/storefront/rating-stars";
import { ReviewList } from "@/components/storefront/review-list";
import { SectionHeading } from "@/components/storefront/section";

export async function generateMetadata(
  props: PageProps<"/product/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Product not found" };

  return {
    title: product.name,
    // The seeded descriptions are a full paragraph; a meta description that
    // runs past ~160 characters is truncated by search engines anyway.
    description: product.description.slice(0, 155),
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: {
      title: product.name,
      description: product.description.slice(0, 155),
      images: product.images[0] ? [{ url: product.images[0].url }] : undefined,
    },
  };
}

/**
 * Product detail — SRS §159.
 *
 * getProductBySlug applies PUBLIC_PRODUCT_WHERE, so a pending, draft or
 * rejected product 404s here even if someone knows its slug. That matters:
 * seven such products exist in the catalogue and their slugs are guessable
 * from their names.
 */
export default async function ProductPage(props: PageProps<"/product/[slug]">) {
  const [{ slug }, customer, settings] = await Promise.all([
    props.params,
    getCustomerContext(),
    getCommerceSettings(),
  ]);

  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const [{ reviews, breakdown }, related, wishlisted] = await Promise.all([
    getProductReviews(product.id),
    getRelatedProducts(product),
    customer ? isWishlisted(customer.customerId, product.id) : Promise.resolve(false),
  ]);

  // Staff browsing the storefront are not customers and have no bag; they see
  // retail pricing and a sign-in prompt, which is the honest state.
  const tier = customer?.tier ?? viewerTier(await getCurrentUser());
  const parent = product.category.parent;

  const specifications = [
    { label: "Fabric", value: product.fabric },
    { label: "Pattern", value: product.pattern },
    { label: "Work", value: product.workType },
    { label: "Colour", value: product.color },
    { label: "Occasion", value: product.occasion },
    {
      label: "Weight",
      value: product.weightGrams ? `${product.weightGrams} g` : null,
    },
    { label: "Collection", value: product.collection },
    { label: "SKU", value: product.sku },
  ].filter((row): row is { label: string; value: string } => Boolean(row.value));

  return (
    <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
      <Breadcrumbs
        trail={[
          { href: "/", label: "Home" },
          { href: "/shop", label: "Shop" },
          ...(parent
            ? [{ href: `/shop/${parent.slug}`, label: parent.name }]
            : []),
          {
            href: parent
              ? `/shop/${parent.slug}/${product.category.slug}`
              : `/shop/${product.category.slug}`,
            label: product.category.name,
          },
          { label: product.name },
        ]}
      />

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
        <ProductGallery images={product.images} productName={product.name} />

        <div>
          <p className="eyebrow mb-3">{product.category.name}</p>
          <h1 className="font-display text-3xl leading-tight sm:text-4xl">
            {product.name}
          </h1>

          {product.ratingCount > 0 && (
            <a
              href="#reviews"
              className="mt-3 inline-flex items-center gap-2 text-sm text-ink-400 hover:text-brand-600"
            >
              <RatingStars value={breakdown.average} />
              {breakdown.average.toFixed(1)} · {breakdown.total}{" "}
              {breakdown.total === 1 ? "review" : "reviews"}
            </a>
          )}

          <div className="mt-6">
            <ProductBuyPanel
              productId={product.id}
              product={product}
              variants={product.variants}
              tier={tier}
              inventory={product.inventory}
              canPurchase={customer !== null}
              signInHref={`/login?next=${encodeURIComponent(`/product/${product.slug}`)}`}
              isWishlisted={wishlisted}
            />
          </div>

          {/* ---- Seller ---- */}
          <section className="mt-8 border border-ivory-400 bg-ivory-50 p-5">
            <h2 className="mb-3 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400">
              Sold by
            </h2>
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-medium text-ivory-50"
              >
                {product.seller.businessName.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm text-ink-900">
                  {product.seller.businessName}
                  {product.seller.verificationStatus ===
                    SELLER_VERIFICATION.APPROVED && (
                    <span className="inline-flex items-center gap-1 text-xs text-success">
                      <BadgeCheck aria-hidden="true" className="h-3.5 w-3.5" />
                      Verified seller
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-ink-400">
                  {titleCase(product.seller.businessType)}
                  {product.seller.city &&
                    ` · ${product.seller.city}, ${product.seller.state}`}
                </p>
                {product.seller.description && (
                  <p className="mt-2.5 text-xs leading-relaxed text-ink-400">
                    {product.seller.description}
                  </p>
                )}
              </div>
            </div>
            <p className="mt-4 border-t border-ivory-300 pt-3 text-xs leading-relaxed text-ink-400">
              Saawariya is a marketplace. This item is sold by the seller named
              above, who is the seller of record on your invoice.
            </p>
          </section>

          {/* ---- Delivery & returns ---- */}
          <dl className="mt-6 grid gap-3 text-xs text-ink-400 sm:grid-cols-2">
            <div className="border border-ivory-400 p-4">
              <dt className="mb-1 font-medium text-ink-900">Delivery</dt>
              <dd className="leading-relaxed">
                Dispatched within {settings.dispatchDays} working days. Free
                shipping above{" "}
                {formatPaise(settings.freeShippingThresholdPaise)}.{" "}
                <Link
                  href="/page/shipping-policy"
                  className="text-brand-600 underline underline-offset-2"
                >
                  Shipping policy
                </Link>
              </dd>
            </div>
            <div className="border border-ivory-400 p-4">
              <dt className="mb-1 font-medium text-ink-900">Returns</dt>
              <dd className="leading-relaxed">
                {settings.returnWindowDays} days from delivery, unused and
                tagged. Cut fabric is non-returnable.{" "}
                <Link
                  href="/page/return-policy"
                  className="text-brand-600 underline underline-offset-2"
                >
                  Return policy
                </Link>
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* ---- Description & specification ---- */}
      <div className="mt-16 grid gap-10 border-t border-ivory-400 pt-12 lg:grid-cols-2 lg:gap-14">
        <div>
          <h2 className="mb-4 font-display text-2xl">About this piece</h2>
          <p className="text-sm leading-relaxed text-ink-500">
            {product.description}
          </p>
          <p className="mt-4 text-xs leading-relaxed text-ink-400">
            Handmade cloth is not uniform — block prints shift between
            impressions and natural dyes vary between lots.
            {settings.pricesIncludeGst &&
              ` Prices include GST at ${settings.gstPercent}%.`}
          </p>
        </div>

        <div>
          <h2 className="mb-4 font-display text-2xl">Specification</h2>
          <dl className="divide-y divide-ivory-400 border-y border-ivory-400">
            {specifications.map((row) => (
              <div key={row.label} className="flex gap-4 py-2.5 text-sm">
                <dt className="w-32 shrink-0 text-ink-400">{row.label}</dt>
                <dd className="text-ink-900">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* ---- Reviews ---- */}
      <section
        id="reviews"
        className="mt-16 scroll-mt-32 border-t border-ivory-400 pt-12"
      >
        <SectionHeading eyebrow="What buyers say" title="Reviews" />
        <ReviewList reviews={reviews} breakdown={breakdown} />
      </section>

      {/* ---- Related ---- */}
      {related.length > 0 && (
        <section className="mt-16 border-t border-ivory-400 pt-12">
          <SectionHeading
            eyebrow="You may also like"
            title="Related pieces"
            action={{
              href: parent
                ? `/shop/${parent.slug}/${product.category.slug}`
                : `/shop/${product.category.slug}`,
              label: `All ${product.category.name}`,
            }}
          />
          <ProductGrid products={related} tier={tier} />
        </section>
      )}
    </div>
  );
}

/** MANUFACTURER -> Manufacturer. */
function titleCase(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}
