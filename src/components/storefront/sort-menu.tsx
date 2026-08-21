import Link from "next/link";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SORT_OPTIONS,
  filterHref,
  type CatalogueFilters,
} from "@/lib/catalogue/filters";

/**
 * Sort control.
 *
 * A native <details> disclosure holding links rather than a <select> wired to
 * router.push — it needs no client JavaScript, is keyboard operable for free,
 * and each option is a real URL that can be prefetched and shared. The panel
 * closes on navigation because the page re-renders.
 */
export function SortMenu({
  pathname,
  filters,
}: {
  pathname: string;
  filters: CatalogueFilters;
}) {
  const current =
    SORT_OPTIONS.find((option) => option.slug === filters.sort) ??
    SORT_OPTIONS[0];

  return (
    <details className="group relative">
      <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-md border border-ivory-400 bg-ivory-50 px-4 text-xs text-ink-900 transition-colors hover:border-ink-400 [&::-webkit-details-marker]:hidden">
        <span className="text-ink-400">Sort:</span>
        {current.label}
        <ChevronDown
          aria-hidden="true"
          className="h-3.5 w-3.5 text-ink-400 transition-transform group-open:rotate-180"
        />
      </summary>

      <ul className="absolute right-0 z-30 mt-1 w-56 rounded-md border border-ivory-400 bg-ivory-50 py-1 shadow-lifted">
        {SORT_OPTIONS.map((option) => {
          const isCurrent = option.slug === current.slug;

          return (
            <li key={option.slug}>
              <Link
                href={filterHref(pathname, {
                  ...filters,
                  sort: option.slug,
                  // Re-sorting reshuffles everything, so page 3 of the old
                  // order is meaningless in the new one.
                  page: 1,
                })}
                aria-current={isCurrent}
                className={cn(
                  "flex items-center justify-between gap-2 px-4 py-2 text-sm transition-colors",
                  isCurrent
                    ? "text-brand-600"
                    : "text-ink-500 hover:bg-ivory-200 hover:text-ink-900",
                )}
              >
                {option.label}
                {isCurrent && <Check aria-hidden="true" className="h-3.5 w-3.5" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
