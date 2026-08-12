import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getCurrentUser } from "@/lib/auth/dal";
import { viewerTier } from "@/lib/catalogue/pricing";
import { parseFilters } from "@/lib/catalogue/filters";
import {
  getBanners,
  getFacetCounts,
  listProducts,
} from "@/lib/catalogue/queries";
import { Breadcrumbs } from "@/components/storefront/breadcrumbs";
import { CatalogueView } from "@/components/storefront/catalogue-view";

export const metadata: Metadata = {
  title: "Shop all",
  description:
    "The full Saawariya catalogue — handwoven sarees, suits, lehengas, dupattas and fabric by the metre from verified Indian textile sellers.",
};

/** The unscoped catalogue — SRS §157. */
export default async function ShopPage(props: PageProps<"/shop">) {
  const [searchParams, user] = await Promise.all([
    props.searchParams,
    getCurrentUser(),
  ]);

  const filters = parseFilters(searchParams);
  const [listing, counts, categoryBanners] = await Promise.all([
    listProducts(filters),
    getFacetCounts(filters),
    getBanners("CATEGORY_TOP"),
  ]);

  const banner = categoryBanners[0];

  return (
    <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
      <Breadcrumbs trail={[{ href: "/", label: "Home" }, { label: "Shop" }]} />

      <div className="mb-10 max-w-2xl">
        <p className="eyebrow mb-3">The catalogue</p>
        <h1 className="font-display text-4xl leading-tight">All products</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-400">
          Everything currently listed by our verified sellers, across all seven
          categories. Filter by fabric, technique, occasion or price.
        </p>
      </div>

      {banner && (
        <Link
          href={banner.linkUrl ?? "/shop"}
          className="group mb-10 grid overflow-hidden border border-ivory-400 bg-ivory-50 sm:grid-cols-[14rem_1fr]"
        >
          <div className="relative aspect-[2/1] bg-ivory-200 sm:aspect-auto">
            <Image
              src={banner.imageUrl}
              alt=""
              fill
              sizes="14rem"
              className="object-cover"
            />
          </div>
          <div className="flex flex-col justify-center p-6">
            <h2 className="font-display text-xl transition-colors group-hover:text-brand-600">
              {banner.title}
            </h2>
            {banner.subtitle && (
              <p className="mt-1.5 text-sm text-ink-400">{banner.subtitle}</p>
            )}
          </div>
        </Link>
      )}

      <CatalogueView
        pathname="/shop"
        filters={filters}
        listing={listing}
        counts={counts}
        tier={viewerTier(user)}
        emptyTitle="The catalogue is empty"
        emptyDescription="No products are currently approved for sale. Please check back shortly."
      />
    </div>
  );
}
