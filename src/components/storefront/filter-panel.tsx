import Link from "next/link";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { COLOUR_FAMILIES, PRICE_BANDS } from "@/lib/constants";
import {
  AVAILABILITY_OPTIONS,
  FACET_GROUPS,
  MULTI_KEYS,
  activeFilterCount,
  clearFilters,
  filterHref,
  filterValueLabel,
  toggleFilter,
  type CatalogueFilters,
  type MultiKey,
} from "@/lib/catalogue/filters";
import type { FacetCounts } from "@/lib/catalogue/queries";

/**
 * Listing filters — SRS §157.
 *
 * Deliberately a Server Component. Every control is an ordinary link to the
 * same page with a different query string, so filtering works with JavaScript
 * disabled, each state is bookmarkable, the browser Back button does the
 * obvious thing, and Next prefetches the result of the filter the pointer is
 * hovering. There is no client-side filter state to get out of sync with the
 * URL because there is no client-side filter state.
 *
 * Options that would return nothing are rendered but disabled rather than
 * hidden — a filter list that reshuffles itself on every click is harder to use
 * than one where the same options stay in the same place.
 */
export function FilterPanel({
  pathname,
  filters,
  counts,
}: {
  pathname: string;
  filters: CatalogueFilters;
  counts: FacetCounts;
}) {
  const active = activeFilterCount(filters);

  return (
    <div className="space-y-7">
      <div className="flex items-center justify-between">
        <h2 className="text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-ink-900">
          Filter
        </h2>
        {active > 0 && (
          <Link
            href={filterHref(pathname, clearFilters(filters))}
            className="text-[0.6875rem] uppercase tracking-[0.1em] text-brand-600 hover:text-brand-700"
          >
            Clear all ({active})
          </Link>
        )}
      </div>

      <ColourFacet pathname={pathname} filters={filters} counts={counts} />

      {FACET_GROUPS.map((group) =>
        // Fabric is the facet people actually shop by — "I want Chanderi" — so
        // it gets chips that can be scanned in one pass. Pattern, occasion and
        // work are narrowing filters applied after that decision and stay as
        // rows, which suit longer lists and read faster top to bottom.
        group.key === "fabric" ? (
          <ChipFacet
            key={group.key}
            label={group.label}
            filterKey={group.key}
            options={group.values.map((value) => ({ value, label: value }))}
            pathname={pathname}
            filters={filters}
            counts={counts}
          />
        ) : (
          <FacetGroup
            key={group.key}
            label={group.label}
            filterKey={group.key}
            options={group.values.map((value) => ({ value, label: value }))}
            pathname={pathname}
            filters={filters}
            counts={counts}
          />
        ),
      )}

      <FacetGroup
        label="Price"
        filterKey="price"
        options={PRICE_BANDS.map((band) => ({
          value: band.slug,
          label: band.label,
        }))}
        pathname={pathname}
        filters={filters}
        counts={counts}
      />

      <FacetGroup
        label="Availability"
        filterKey="availability"
        options={AVAILABILITY_OPTIONS.map((option) => ({
          value: option.slug,
          label: option.label,
        }))}
        pathname={pathname}
        filters={filters}
        counts={counts}
      />
    </div>
  );
}

function FacetGroup({
  label,
  filterKey,
  options,
  pathname,
  filters,
  counts,
}: {
  label: string;
  filterKey: MultiKey;
  options: { value: string; label: string }[];
  pathname: string;
  filters: CatalogueFilters;
  counts: FacetCounts;
}) {
  const selected = filters[filterKey];
  const available = options.filter(
    (option) =>
      (counts[filterKey][option.value] ?? 0) > 0 ||
      selected.includes(option.value),
  );

  // A facet with nothing behind it in this scope is noise, not a filter.
  if (available.length === 0) return null;

  return (
    <fieldset className="border-t border-ivory-400 pt-5">
      <legend className="mb-3 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400">
        {label}
      </legend>
      <ul className="space-y-1.5">
        {available.map((option) => {
          const isChecked = selected.includes(option.value);
          const count = counts[filterKey][option.value] ?? 0;

          return (
            <li key={option.value}>
              <Link
                href={filterHref(
                  pathname,
                  toggleFilter(filters, filterKey, option.value),
                )}
                aria-pressed={isChecked}
                className="group flex items-center gap-2.5 py-0.5 text-sm"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center border transition-colors",
                    isChecked
                      ? "border-brand-600 bg-brand-600 text-cream"
                      : "border-ivory-500 group-hover:border-ink-400",
                  )}
                >
                  {isChecked && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
                <span
                  className={cn(
                    "flex-1",
                    isChecked ? "text-ink-900" : "text-ink-500 group-hover:text-ink-900",
                  )}
                >
                  {option.label}
                </span>
                <span className="text-xs tabular-nums text-ink-400">{count}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

/**
 * Colour, as labelled swatch chips.
 *
 * The swatches used to be bare 32px dots with the colour name only in a title
 * attribute. That is unusable for anyone who cannot distinguish two of them —
 * "Cream & Natural" and "White" are four percent apart in luminance — and a
 * title tooltip never appears on touch at all. The name is now on the chip, and
 * the dot is what it should have been from the start: a hint beside a label,
 * not the label itself.
 */
function ColourFacet({
  pathname,
  filters,
  counts,
}: {
  pathname: string;
  filters: CatalogueFilters;
  counts: FacetCounts;
}) {
  const available = COLOUR_FAMILIES.filter(
    (family) =>
      (counts.colour[family.slug] ?? 0) > 0 ||
      filters.colour.includes(family.slug),
  );

  if (available.length === 0) return null;

  return (
    <fieldset className="border-t border-ivory-400 pt-5">
      <legend className="mb-3 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400">
        Colour
      </legend>
      <ul className="flex flex-wrap gap-1.5">
        {available.map((family) => {
          const isChecked = filters.colour.includes(family.slug);
          const count = counts.colour[family.slug] ?? 0;

          return (
            <li key={family.slug}>
              <Link
                href={filterHref(
                  pathname,
                  toggleFilter(filters, "colour", family.slug),
                )}
                aria-pressed={isChecked}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border py-1 pl-1.5 pr-3 text-xs transition-colors",
                  isChecked
                    ? "border-brand-600 bg-brand-50 text-ink-900"
                    : "border-ivory-400 text-ink-500 hover:border-ink-400 hover:text-ink-900",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-4 w-4 shrink-0 rounded-full border",
                    // Multicolour has no single hex that is honest, so it gets
                    // a spectrum rather than a stand-in colour.
                    family.slug === "multi"
                      ? "border-ink-900/15 bg-[conic-gradient(#9E302F,#c8a96a,#3d6f53,#33507f,#cf7b9b,#9E302F)]"
                      : "border-ink-900/15",
                  )}
                  style={
                    family.slug === "multi"
                      ? undefined
                      : { backgroundColor: family.swatch }
                  }
                />
                {family.label}
                <span className="tabular-nums text-ink-400">{count}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

/** A facet rendered as pill chips rather than a checkbox list. */
function ChipFacet({
  label,
  filterKey,
  options,
  pathname,
  filters,
  counts,
}: {
  label: string;
  filterKey: MultiKey;
  options: { value: string; label: string }[];
  pathname: string;
  filters: CatalogueFilters;
  counts: FacetCounts;
}) {
  const selected = filters[filterKey];
  const available = options.filter(
    (option) =>
      (counts[filterKey][option.value] ?? 0) > 0 ||
      selected.includes(option.value),
  );

  if (available.length === 0) return null;

  return (
    <fieldset className="border-t border-ivory-400 pt-5">
      <legend className="mb-3 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400">
        {label}
      </legend>
      <ul className="flex flex-wrap gap-1.5">
        {available.map((option) => {
          const isChecked = selected.includes(option.value);
          const count = counts[filterKey][option.value] ?? 0;

          return (
            <li key={option.value}>
              <Link
                href={filterHref(
                  pathname,
                  toggleFilter(filters, filterKey, option.value),
                )}
                aria-pressed={isChecked}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition-colors",
                  isChecked
                    ? "border-brand-600 bg-brand-50 text-ink-900"
                    : "border-ivory-400 text-ink-500 hover:border-ink-400 hover:text-ink-900",
                )}
              >
                {option.label}
                <span className="tabular-nums text-ink-400">{count}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

/** Removable chips above the grid, mirroring what the sidebar has selected. */
export function ActiveFilterChips({
  pathname,
  filters,
}: {
  pathname: string;
  filters: CatalogueFilters;
}) {
  const chips = MULTI_KEYS.flatMap((key) =>
    filters[key].map((value) => ({ key, value })),
  );

  if (chips.length === 0) return null;

  return (
    <ul className="mb-5 flex flex-wrap items-center gap-2">
      {chips.map(({ key, value }) => (
        <li key={`${key}:${value}`}>
          <Link
            href={filterHref(pathname, toggleFilter(filters, key, value))}
            className="inline-flex items-center gap-1.5 rounded-md border border-ivory-400 bg-ivory-50 py-1 pl-3 pr-2 text-xs text-ink-900 transition-colors hover:border-ink-400"
          >
            {filterValueLabel(key, value)}
            <X aria-hidden="true" className="h-3 w-3 text-ink-400" />
            <span className="sr-only">Remove filter</span>
          </Link>
        </li>
      ))}
      <li>
        <Link
          href={filterHref(pathname, clearFilters(filters))}
          className="px-1 text-xs text-brand-600 underline underline-offset-2 hover:text-brand-700"
        >
          Clear all
        </Link>
      </li>
    </ul>
  );
}
