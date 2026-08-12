import {
  COLOUR_FAMILIES,
  FABRICS,
  INVENTORY_STATUS,
  OCCASIONS,
  PATTERNS,
  PRICE_BANDS,
  WORK_TYPES,
} from "@/lib/constants";

/**
 * Listing filter state, parsed out of and written back into the URL.
 *
 * The URL is the only state — there is no client-side filter store. A filtered
 * listing is therefore shareable, bookmarkable and survives a reload, and the
 * server can render it without hydration. This module is pure so that both the
 * Server Component reading `searchParams` and the Client Component building the
 * next href use exactly the same rules.
 *
 * Every incoming value is checked against a known vocabulary before it reaches
 * a query. `?fabric=` is attacker-controlled like any other query string.
 */

export const PAGE_SIZE = 12;

export const SORT_OPTIONS = [
  { slug: "featured", label: "Featured" },
  { slug: "newest", label: "Newest first" },
  { slug: "price-asc", label: "Price: low to high" },
  { slug: "price-desc", label: "Price: high to low" },
  { slug: "rating", label: "Highest rated" },
  { slug: "popular", label: "Best selling" },
] as const;

export type SortSlug = (typeof SORT_OPTIONS)[number]["slug"];
export const DEFAULT_SORT: SortSlug = "featured";

/** Availability is presented as a filter over `Inventory.status`. */
export const AVAILABILITY_OPTIONS = [
  { slug: INVENTORY_STATUS.IN_STOCK, label: "In stock" },
  { slug: INVENTORY_STATUS.LOW_STOCK, label: "Low stock" },
] as const;

/**
 * The facet groups, in the order they appear in the sidebar. Declaring them as
 * data rather than as markup keeps the sidebar, the "clear all" control and the
 * active-filter chips from drifting apart as facets are added.
 */
export const FACET_GROUPS = [
  { key: "fabric", label: "Fabric", values: FABRICS },
  { key: "pattern", label: "Pattern", values: PATTERNS },
  { key: "occasion", label: "Occasion", values: OCCASIONS },
  { key: "workType", label: "Work", values: WORK_TYPES },
] as const;

export type FacetKey = (typeof FACET_GROUPS)[number]["key"];

/** Every filter key that can appear in the URL as a repeatable value. */
export const MULTI_KEYS = [
  "fabric",
  "pattern",
  "occasion",
  "workType",
  "colour",
  "price",
  "availability",
] as const;

export type MultiKey = (typeof MULTI_KEYS)[number];

export type CatalogueFilters = {
  fabric: string[];
  pattern: string[];
  occasion: string[];
  workType: string[];
  /** COLOUR_FAMILIES slugs. */
  colour: string[];
  /** PRICE_BANDS slugs. */
  price: string[];
  /** INVENTORY_STATUS values. */
  availability: string[];
  collection: string | null;
  q: string | null;
  sort: SortSlug;
  page: number;
};

export type RawSearchParams = Record<string, string | string[] | undefined>;

const VOCABULARIES: Record<MultiKey, readonly string[]> = {
  fabric: FABRICS,
  pattern: PATTERNS,
  occasion: OCCASIONS,
  workType: WORK_TYPES,
  colour: COLOUR_FAMILIES.map((c) => c.slug),
  price: PRICE_BANDS.map((b) => b.slug),
  availability: AVAILABILITY_OPTIONS.map((a) => a.slug),
};

function readMulti(raw: RawSearchParams, key: MultiKey): string[] {
  const value = raw[key];
  const candidates = Array.isArray(value) ? value : value ? [value] : [];
  const allowed = VOCABULARIES[key];
  // Unknown values are dropped rather than 404'd: a stale bookmark from before
  // a facet was renamed should still show a listing, just an unfiltered one.
  return [...new Set(candidates.filter((c) => allowed.includes(c)))];
}

function readSingle(raw: RawSearchParams, key: string): string | null {
  const value = raw[key];
  const first = Array.isArray(value) ? value[0] : value;
  const trimmed = first?.trim();
  return trimmed ? trimmed : null;
}

export function parseFilters(raw: RawSearchParams): CatalogueFilters {
  const sortCandidate = readSingle(raw, "sort");
  const sort = SORT_OPTIONS.some((o) => o.slug === sortCandidate)
    ? (sortCandidate as SortSlug)
    : DEFAULT_SORT;

  const pageCandidate = Number.parseInt(readSingle(raw, "page") ?? "1", 10);

  return {
    fabric: readMulti(raw, "fabric"),
    pattern: readMulti(raw, "pattern"),
    occasion: readMulti(raw, "occasion"),
    workType: readMulti(raw, "workType"),
    colour: readMulti(raw, "colour"),
    price: readMulti(raw, "price"),
    availability: readMulti(raw, "availability"),
    collection: readSingle(raw, "collection"),
    // Cap the query length — this string reaches a LIKE, and a 10KB one is not
    // a search, it is someone probing.
    q: readSingle(raw, "q")?.slice(0, 120) ?? null,
    sort,
    page: Number.isFinite(pageCandidate) && pageCandidate > 0 ? pageCandidate : 1,
  };
}

/** How many facet selections are active — drives the "Clear all" affordance. */
export function activeFilterCount(filters: CatalogueFilters): number {
  return MULTI_KEYS.reduce((total, key) => total + filters[key].length, 0);
}

export function hasActiveFilters(filters: CatalogueFilters): boolean {
  return activeFilterCount(filters) > 0;
}

/**
 * Serialise filters back to a query string.
 *
 * Keys are emitted in a fixed order and values sorted, so the same filter set
 * always produces the same URL — two routes to identical results should not
 * look like two different pages.
 */
export function buildQueryString(filters: CatalogueFilters): string {
  const params = new URLSearchParams();

  for (const key of MULTI_KEYS) {
    for (const value of [...filters[key]].sort()) params.append(key, value);
  }
  if (filters.collection) params.set("collection", filters.collection);
  if (filters.q) params.set("q", filters.q);
  if (filters.sort !== DEFAULT_SORT) params.set("sort", filters.sort);
  if (filters.page > 1) params.set("page", String(filters.page));

  return params.toString();
}

export function filterHref(
  pathname: string,
  filters: CatalogueFilters,
): string {
  const query = buildQueryString(filters);
  return query ? `${pathname}?${query}` : pathname;
}

/**
 * Add or remove one facet value. Any change to the filter set returns to page
 * one — staying on page 4 of a result set that now has two pages is the classic
 * way to land a user on an empty grid.
 */
export function toggleFilter(
  filters: CatalogueFilters,
  key: MultiKey,
  value: string,
): CatalogueFilters {
  const current = filters[key];
  const next = current.includes(value)
    ? current.filter((v) => v !== value)
    : [...current, value];

  return { ...filters, [key]: next, page: 1 };
}

export function clearFilters(filters: CatalogueFilters): CatalogueFilters {
  return {
    ...filters,
    fabric: [],
    pattern: [],
    occasion: [],
    workType: [],
    colour: [],
    price: [],
    availability: [],
    page: 1,
  };
}

/** Human label for an active-filter chip. */
export function filterValueLabel(key: MultiKey, value: string): string {
  if (key === "colour") {
    return COLOUR_FAMILIES.find((c) => c.slug === value)?.label ?? value;
  }
  if (key === "price") {
    return PRICE_BANDS.find((b) => b.slug === value)?.label ?? value;
  }
  if (key === "availability") {
    return AVAILABILITY_OPTIONS.find((a) => a.slug === value)?.label ?? value;
  }
  return value;
}
