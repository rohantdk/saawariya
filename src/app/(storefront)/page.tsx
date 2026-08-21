import Link from "next/link";
import Image from "next/image";
import { getCurrentUser } from "@/lib/auth/dal";
import { viewerTier } from "@/lib/catalogue/pricing";
import {
  getBanners,
  getBestSellers,
  getCategoryProductCounts,
  getCategoryTree,
  getFeaturedProducts,
  getNewArrivals,
} from "@/lib/catalogue/queries";
import { getCommerceSettings } from "@/lib/commerce/settings";
import { getCustomerContext } from "@/lib/commerce/context";
import { wishlistedIds } from "@/lib/commerce/wishlist";
import { CraftBand } from "@/components/storefront/craft-band";
import { HeroCarousel } from "@/components/storefront/hero-carousel";
import { ProductGrid } from "@/components/storefront/product-card";
import { EmptyState, SectionHeading } from "@/components/storefront/section";
import { WhySaawariya } from "@/components/storefront/why-saawariya";

/**
 * Homepage — SRS §146-155.
 *
 * Every band on this page is driven by a database row, not by a hardcoded
 * array: the hero comes from the HOME_HERO banners, the categories from the
 * category tree, and the product rails from `isFeatured`, `isNewArrival` and
 * — for best sellers — what has actually been delivered. Changing
 * merchandising in the admin panel changes this page, which is the point of
 * having the panel.
 *
 * The one band that is not a query is "Why Saawariya" (§152), and even that
 * takes its figures from platform settings and only claims things the platform
 * demonstrably does — see the note on the component.
 */
export default async function HomePage() {
  const [user, heroBanners, promoBanners, categories, counts] =
    await Promise.all([
      getCurrentUser(),
      getBanners("HOME_HERO"),
      getBanners("PROMO"),
      getCategoryTree(),
      getCategoryProductCounts(),
    ]);

  const tier = viewerTier(user);
  const [featured, newArrivals, bestSellers, settings, customer] =
    await Promise.all([
      getFeaturedProducts(8),
      getNewArrivals(4),
      getBestSellers(4),
      getCommerceSettings(),
      getCustomerContext(),
    ]);

  const wishlisted = customer
    ? await wishlistedIds(customer.customerId, [
        ...featured.map((p) => p.id),
        ...newArrivals.map((p) => p.id),
        ...bestSellers.map((p) => p.id),
      ])
    : null;

  const promo = promoBanners[0];

  return (
    <>
      <HeroCarousel slides={heroBanners} />

      {promo && (
        <div className="border-b border-ivory-400 bg-brand-900">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-5 py-3 text-center lg:px-8">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-gold-300">
              {promo.title}
            </p>
            {promo.subtitle && (
              <p className="text-xs text-cream/70">{promo.subtitle}</p>
            )}
            {promo.linkUrl && (
              <Link
                href={promo.linkUrl}
                className="text-xs uppercase tracking-[0.12em] text-cream underline underline-offset-4"
              >
                Shop now
              </Link>
            )}
          </div>
        </div>
      )}

      {/* ---- Categories ---- */}
      <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
        <SectionHeading
          eyebrow="Explore"
          title="Seven traditions, one catalogue"
          description="From Varanasi brocade to Bagru block print — every piece names the cluster it came from and the seller who made it."
          action={{ href: "/shop", label: "View all categories" }}
        />

        <div className="grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-3 lg:grid-cols-4">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/shop/${category.slug}`}
              className="group block"
            >
              <div className="relative aspect-square overflow-hidden bg-ivory-200">
                {category.imageUrl && (
                  <Image
                    src={category.imageUrl}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 22vw, 40vw"
                    className="object-cover transition-transform duration-500 ease-[var(--ease-out-soft)] group-hover:scale-[1.04]"
                  />
                )}
                {/* The mark stands in for a per-category icon, which the
                    catalogue does not carry — the category's own initial in
                    the brand's arch-mark treatment, not a stock icon that
                    means nothing. */}
                <span
                  aria-hidden="true"
                  className="absolute bottom-3 left-3 flex h-10 w-10 items-center justify-center rounded-full border border-gold-400 bg-ivory-50 font-display text-sm text-brand-700 shadow-card transition-colors group-hover:border-brand-600"
                >
                  {category.name.charAt(0)}
                </span>
              </div>
              <h3 className="mt-3 font-display text-base leading-snug text-ink-900 transition-colors group-hover:text-brand-600">
                {category.name}
              </h3>
              <p className="text-[0.6875rem] uppercase tracking-[0.1em] text-ink-400">
                {counts.get(category.slug) ?? 0} products
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* ---- Featured ---- */}
      <section className="border-t border-ivory-400 bg-ivory-50">
        <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
          <SectionHeading
            eyebrow="The Edit"
            title="Featured this season"
            description="Chosen by our merchandising team from the current catalogue."
            action={{ href: "/shop", label: "View all" }}
          />

          {featured.length > 0 ? (
            <ProductGrid
              products={featured}
              tier={tier}
              priorityCount={4}
              wishlisted={wishlisted}
            />
          ) : (
            <EmptyState
              title="Nothing featured right now"
              description="Our merchandising team has not selected featured pieces yet. The full catalogue is still open."
              action={{ href: "/shop", label: "Browse everything" }}
            />
          )}
        </div>
      </section>

      {/* ---- New arrivals ---- */}
      {newArrivals.length > 0 && (
        <section className="border-t border-ivory-400">
          <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
            <SectionHeading
              eyebrow="Just in"
              title="New arrivals"
              description="The most recent pieces to come off the loom and pass approval."
              action={{ href: "/shop?sort=newest", label: "See what's new" }}
            />
            <ProductGrid products={newArrivals} tier={tier} wishlisted={wishlisted} />
          </div>
        </section>
      )}

      {/* ---- Best sellers ---- */}
      {/* Ranked by units actually delivered, so this rail is empty until the
          platform has sold something rather than showing a hardcoded list. */}
      {bestSellers.length > 0 && (
        <section className="border-t border-ivory-400 bg-ivory-100">
          <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
            <SectionHeading
              eyebrow="Best sellers"
              title="What people are buying"
              description="Ranked by pieces actually delivered — not by what we would like to sell."
              action={{ href: "/shop?sort=popular", label: "Shop all" }}
            />
            <ProductGrid products={bestSellers} tier={tier} wishlisted={wishlisted} />
          </div>
        </section>
      )}

      {/* ---- The craft ---- */}
      {/* Sits between the merchandising rails and the proof points: it is the
          argument for the prices above it and the setup for the guarantees
          below it. */}
      <CraftBand />

      {/* ---- Why Saawariya ---- */}
      <WhySaawariya settings={settings} />
    </>
  );
}
