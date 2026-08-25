import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/dal";
import { viewerTier } from "@/lib/catalogue/pricing";
import {
  getBanners,
  getBestSellers,
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
import { Reveal } from "@/components/ui/reveal";

/**
 * Homepage — SRS §146-155.
 *
 * Every band on this page is driven by a database row, not by a hardcoded
 * array: the hero comes from the HOME_HERO banners, and the product rail
 * from `isFeatured`, `isNewArrival` and — for best sellers — what has
 * actually been delivered. Changing merchandising in the admin panel changes
 * this page, which is the point of having the panel.
 *
 * The categories band ("Seven traditions, one catalogue") was removed
 * 2026-08-24 at the client's request — see /shop's own category filters for
 * that browsing path instead.
 *
 * The one band that is not a query is "Why Saawariya" (§152), and even that
 * takes its figures from platform settings and only claims things the platform
 * demonstrably does — see the note on the component.
 */
export default async function HomePage() {
  const [user, heroBanners, promoBanners] = await Promise.all([
    getCurrentUser(),
    getBanners("HOME_HERO"),
    getBanners("PROMO"),
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

  // One merchandising rail, not three. Featured, new-arrival and best-seller
  // are still independent flags/derivations (kept for the admin panel and
  // /shop's own sort options), but with the catalogue at 5 SKUs the three
  // homepage sections were rendering the same handful of products three
  // times over. Merged here instead, in priority order, deduplicated by id.
  const spotlight = [...featured, ...newArrivals, ...bestSellers]
    .filter((product, index, all) => all.findIndex((p) => p.id === product.id) === index)
    .slice(0, 8);

  const wishlisted = customer
    ? await wishlistedIds(customer.customerId, spotlight.map((p) => p.id))
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

      {/* ---- The collection ---- */}
      {/* Was three separate rails (Featured / New arrivals / Best sellers) —
          merged into `spotlight` above. */}
      <section className="border-t border-ivory-400 bg-ivory-50">
        <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
          <Reveal>
            <SectionHeading
              eyebrow="The Edit"
              title="The collection"
              description="Every piece currently live, chosen by our merchandising team and ranked by what customers actually buy."
              action={{ href: "/shop", label: "View all" }}
            />
          </Reveal>

          {spotlight.length > 0 ? (
            <ProductGrid
              products={spotlight}
              tier={tier}
              priorityCount={4}
              wishlisted={wishlisted}
            />
          ) : (
            <EmptyState
              title="Nothing to show yet"
              description="The catalogue is still open — check back shortly."
              action={{ href: "/shop", label: "Browse everything" }}
            />
          )}
        </div>
      </section>

      {/* ---- The craft ---- */}
      {/* Sits between the merchandising rails and the proof points: it is the
          argument for the prices above it and the setup for the guarantees
          below it. */}
      <Reveal y={32}>
        <CraftBand />
      </Reveal>

      {/* ---- Why Saawariya ---- */}
      {/* Not wrapped in a <Reveal>: it stages its own heading and its six
          blocks internally, and fading the whole band in on top of that would
          run two animations over the same pixels. */}
      <WhySaawariya settings={settings} />
    </>
  );
}
