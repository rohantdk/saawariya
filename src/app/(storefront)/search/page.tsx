import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/dal";
import { viewerTier } from "@/lib/catalogue/pricing";
import { parseFilters } from "@/lib/catalogue/filters";
import { getFacetCounts, listProducts } from "@/lib/catalogue/queries";
import { Breadcrumbs } from "@/components/storefront/breadcrumbs";
import { CatalogueView } from "@/components/storefront/catalogue-view";
import { EmptyState } from "@/components/storefront/section";

export const metadata: Metadata = {
  title: "Search",
  // A search results page has nothing stable to index, and indexing one
  // creates a page per query string.
  robots: { index: false, follow: true },
};

/**
 * Search results — SRS §39, §160.
 *
 * Matches product name, fabric, collection and seller business name, so
 * "chanderi" finds the fabric, "Vivaah Bridal" finds the collection and
 * "Meenakshi" finds a weaver's whole catalogue. The same filters and sorting as
 * a category listing apply on top, because narrowing a broad search is the
 * common next step.
 */
export default async function SearchPage(props: PageProps<"/search">) {
  const [searchParams, user] = await Promise.all([
    props.searchParams,
    getCurrentUser(),
  ]);

  const filters = parseFilters(searchParams);

  if (!filters.q) {
    return (
      <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
        <Breadcrumbs trail={[{ href: "/", label: "Home" }, { label: "Search" }]} />
        <EmptyState
          title="What are you looking for?"
          description="Search by product name, fabric, collection or the name of a seller — try “Banarasi”, “Chanderi” or “Vivaah Bridal”."
          action={{ href: "/shop", label: "Browse the full catalogue" }}
        />
      </div>
    );
  }

  const [listing, counts] = await Promise.all([
    listProducts(filters),
    getFacetCounts(filters),
  ]);

  // Keeping `q` in the pathname-relative hrefs is handled by filterHref, which
  // re-serialises the whole filter object including the query.
  return (
    <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
      <Breadcrumbs trail={[{ href: "/", label: "Home" }, { label: "Search" }]} />

      <div className="mb-10 max-w-2xl">
        <p className="eyebrow mb-3">Search</p>
        <h1 className="font-display text-4xl leading-tight">
          Results for “{filters.q}”
        </h1>
        <p className="mt-3 text-sm text-ink-400">
          {listing.total} {listing.total === 1 ? "product" : "products"} matched
          across names, fabrics, collections and sellers.
        </p>
      </div>

      <CatalogueView
        pathname="/search"
        filters={filters}
        listing={listing}
        counts={counts}
        tier={viewerTier(user)}
        emptyTitle={`Nothing matched “${filters.q}”`}
        emptyDescription="Try a shorter term, a fabric name such as “silk” or “cotton”, or browse the categories instead."
      />
    </div>
  );
}
