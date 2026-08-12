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
  getTestimonials,
} from "@/lib/catalogue/queries";
import { getCommerceSettings } from "@/lib/commerce/settings";
import { HeroCarousel } from "@/components/storefront/hero-carousel";
import { NewsletterForm } from "@/components/storefront/newsletter-form";
import { ProductGrid } from "@/components/storefront/product-card";
import { EmptyState, SectionHeading } from "@/components/storefront/section";
import { Testimonials } from "@/components/storefront/testimonials";
import { WhySaawariya } from "@/components/storefront/why-saawariya";

/**
 * Homepage — SRS §146-155.
 *
 * Every band on this page is driven by a database row, not by a hardcoded
 * array: the hero comes from the HOME_HERO banners, the categories from the
 * category tree, the product rails from `isFeatured`, `isNewArrival` and — for
 * best sellers — what has actually been delivered, the testimonials from
 * approved reviews, and the wholesale strip from the HOME_STRIP banner.
 * Changing merchandising in the admin panel changes this page, which is the
 * point of having the panel.
 *
 * The one band that is not a query is "Why Saawariya" (§152), and even that
 * takes its figures from platform settings and only claims things the platform
 * demonstrably does — see the note on the component.
 */
export default async function HomePage() {
  const [user, heroBanners, stripBanners, promoBanners, categories, counts] =
    await Promise.all([
      getCurrentUser(),
      getBanners("HOME_HERO"),
      getBanners("HOME_STRIP"),
      getBanners("PROMO"),
      getCategoryTree(),
      getCategoryProductCounts(),
    ]);

  const tier = viewerTier(user);
  const [featured, newArrivals, bestSellers, testimonials, settings] =
    await Promise.all([
      getFeaturedProducts(8),
      getNewArrivals(4),
      getBestSellers(4),
      getTestimonials(3),
      getCommerceSettings(),
    ]);

  const strip = stripBanners[0];
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
              <p className="text-xs text-ivory-100/70">{promo.subtitle}</p>
            )}
            {promo.linkUrl && (
              <Link
                href={promo.linkUrl}
                className="text-xs uppercase tracking-[0.12em] text-ivory-50 underline underline-offset-4"
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
          eyebrow="Shop by category"
          title="Seven traditions, one catalogue"
          description="From Varanasi brocade to Bagru block print — every piece names the cluster it came from and the seller who made it."
          align="center"
        />

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {categories.map((category, index) => (
            <Link
              key={category.id}
              href={`/shop/${category.slug}`}
              className={`group relative block overflow-hidden bg-ivory-200 ${
                // The first tile spans two columns on large screens, so the
                // grid of seven does not leave a visible hole at the end.
                index === 0 ? "lg:col-span-2 lg:row-span-1" : ""
              }`}
            >
              <div
                className={`relative ${index === 0 ? "aspect-[2/1.25]" : "aspect-[4/5]"}`}
              >
                {category.imageUrl && (
                  <Image
                    src={category.imageUrl}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 25vw, 50vw"
                    className="object-cover transition-transform duration-500 ease-[var(--ease-out-soft)] group-hover:scale-[1.04]"
                  />
                )}
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-ink-900/80 via-ink-900/15 to-transparent"
                />
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <h3 className="font-display text-lg text-ivory-50">
                    {category.name}
                  </h3>
                  <p className="text-[0.6875rem] uppercase tracking-[0.1em] text-ivory-100/70">
                    {counts.get(category.slug) ?? 0} products
                  </p>
                </div>
              </div>
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
            <ProductGrid products={featured} tier={tier} priorityCount={4} />
          ) : (
            <EmptyState
              title="Nothing featured right now"
              description="Our merchandising team has not selected featured pieces yet. The full catalogue is still open."
              action={{ href: "/shop", label: "Browse everything" }}
            />
          )}
        </div>
      </section>

      {/* ---- Wholesale strip ---- */}
      {strip && (
        <section className="border-t border-ivory-400">
          <div className="mx-auto grid max-w-7xl items-stretch gap-0 lg:grid-cols-2">
            <div className="relative min-h-[16rem] bg-ivory-200">
              <Image
                src={strip.imageUrl}
                alt=""
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover"
              />
            </div>
            <div className="flex flex-col justify-center bg-ink-900 px-8 py-14 lg:px-14">
              <p className="eyebrow mb-4">For businesses</p>
              <h2 className="font-display text-3xl leading-tight text-ivory-50 sm:text-4xl">
                {strip.title}
              </h2>
              {strip.subtitle && (
                <p className="mt-4 max-w-md text-sm leading-relaxed text-ivory-100/70">
                  {strip.subtitle}
                </p>
              )}
              <div>
                <Link
                  href={strip.linkUrl ?? "/wholesale"}
                  className="mt-8 inline-flex h-12 items-center bg-ivory-50 px-8 text-xs font-medium uppercase tracking-[0.16em] text-ink-900 transition-colors hover:bg-gold-300"
                >
                  Wholesale pricing
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

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
            <ProductGrid products={newArrivals} tier={tier} />
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
            <ProductGrid products={bestSellers} tier={tier} />
          </div>
        </section>
      )}

      {/* ---- Why Saawariya ---- */}
      <WhySaawariya settings={settings} />

      {/* ---- Testimonials ---- */}
      <Testimonials items={testimonials} />

      {/* ---- Newsletter ---- */}
      <section className="border-t border-ivory-400 bg-brand-900">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-5 py-16 text-center lg:px-8">
          <p className="inline-flex items-center gap-3 text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-gold-300">
            <span aria-hidden="true" className="h-px w-7 bg-gold-400" />
            Stay in touch
            <span aria-hidden="true" className="h-px w-7 bg-gold-400" />
          </p>
          <h2 className="max-w-xl font-display text-3xl leading-tight text-ivory-50">
            New weaves, restocks and the occasional note from the loom
          </h2>
          <p className="max-w-md text-sm leading-relaxed text-ivory-100/70">
            One email a month. No forwarding your address to anyone, ever.
          </p>
          <NewsletterForm />
        </div>
      </section>
    </>
  );
}
