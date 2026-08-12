import type { PriceTier } from "@/lib/constants";
import {
  PAGE_SIZE,
  activeFilterCount,
  clearFilters,
  filterHref,
  hasActiveFilters,
  type CatalogueFilters,
} from "@/lib/catalogue/filters";
import type { FacetCounts, ProductListing } from "@/lib/catalogue/queries";
import {
  ActiveFilterChips,
  FilterPanel,
} from "@/components/storefront/filter-panel";
import { FilterDrawer } from "@/components/storefront/filter-drawer";
import { Pagination } from "@/components/storefront/pagination";
import { ProductGrid } from "@/components/storefront/product-card";
import { SortMenu } from "@/components/storefront/sort-menu";
import { EmptyState } from "@/components/storefront/section";

/**
 * The listing body shared by /shop, every category page and /search.
 *
 * One component rather than four near-copies: the filter sidebar, the result
 * count, the sort control, the grid and the pagination have to agree about the
 * same filter state, and the surest way to keep them agreeing is for there to
 * be only one of each.
 */
export function CatalogueView({
  pathname,
  filters,
  listing,
  counts,
  tier,
  emptyTitle,
  emptyDescription,
}: {
  pathname: string;
  filters: CatalogueFilters;
  listing: ProductListing;
  counts: FacetCounts;
  tier: PriceTier;
  emptyTitle: string;
  emptyDescription: string;
}) {
  const { items, total, page, pageCount } = listing;
  const active = activeFilterCount(filters);

  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="grid gap-10 lg:grid-cols-[15rem_1fr] lg:gap-12">
      <aside className="hidden lg:block">
        <FilterPanel pathname={pathname} filters={filters} counts={counts} />
      </aside>

      <div>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-ink-400">
            {total === 0 ? (
              "No products"
            ) : (
              <>
                Showing{" "}
                <span className="tabular-nums text-ink-900">
                  {from}–{to}
                </span>{" "}
                of <span className="tabular-nums text-ink-900">{total}</span>{" "}
                {total === 1 ? "product" : "products"}
              </>
            )}
          </p>

          <div className="flex items-center gap-2">
            {/* The panel passed as children is still rendered on the server —
                only the sheet's open/closed state is client-side. */}
            <FilterDrawer activeCount={active} location={filterHref(pathname, filters)}>
              <FilterPanel
                pathname={pathname}
                filters={filters}
                counts={counts}
              />
            </FilterDrawer>
            <SortMenu pathname={pathname} filters={filters} />
          </div>
        </div>

        <ActiveFilterChips pathname={pathname} filters={filters} />

        {items.length > 0 ? (
          <>
            <ProductGrid products={items} tier={tier} priorityCount={4} />
            <Pagination
              pathname={pathname}
              filters={filters}
              page={page}
              pageCount={pageCount}
            />
          </>
        ) : (
          <EmptyState
            title={hasActiveFilters(filters) ? "No matches" : emptyTitle}
            description={
              hasActiveFilters(filters)
                ? "No products match every filter you have selected. Try removing one."
                : emptyDescription
            }
            action={
              hasActiveFilters(filters)
                ? {
                    href: filterHref(pathname, clearFilters(filters)),
                    label: "Clear filters",
                  }
                : { href: "/shop", label: "Browse the full catalogue" }
            }
          />
        )}
      </div>
    </div>
  );
}
