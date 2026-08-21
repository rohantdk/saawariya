import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { filterHref, type CatalogueFilters } from "@/lib/catalogue/filters";

/**
 * Numbered pagination. Server-rendered links, so a listing page is crawlable
 * and every page of results has its own URL — infinite scroll would put 34
 * products behind a scroll event and nothing behind a search engine.
 *
 * Long ranges collapse to first / neighbours / last with ellipses, so the
 * control stays one line however many pages there are.
 */
export function Pagination({
  pathname,
  filters,
  page,
  pageCount,
}: {
  pathname: string;
  filters: CatalogueFilters;
  page: number;
  pageCount: number;
}) {
  if (pageCount <= 1) return null;

  const hrefFor = (target: number) =>
    filterHref(pathname, { ...filters, page: target });

  return (
    <nav aria-label="Pagination" className="mt-12 flex items-center justify-center gap-1.5">
      <Step
        href={page > 1 ? hrefFor(page - 1) : null}
        label="Previous page"
        icon={<ChevronLeft aria-hidden="true" className="h-4 w-4" />}
      />

      {pageRange(page, pageCount).map((entry, index) =>
        entry === "gap" ? (
          <span
            key={`gap-${index}`}
            aria-hidden="true"
            className="px-1 text-xs text-ink-400"
          >
            …
          </span>
        ) : (
          <Link
            key={entry}
            href={hrefFor(entry)}
            aria-current={entry === page ? "page" : undefined}
            className={cn(
              "flex h-9 min-w-9 items-center justify-center border px-3 text-xs tabular-nums transition-colors",
              entry === page
                ? "border-brand-600 bg-brand-600 text-cream"
                : "border-ivory-400 text-ink-900 hover:border-ink-400",
            )}
          >
            {entry}
          </Link>
        ),
      )}

      <Step
        href={page < pageCount ? hrefFor(page + 1) : null}
        label="Next page"
        icon={<ChevronRight aria-hidden="true" className="h-4 w-4" />}
      />
    </nav>
  );
}

function Step({
  href,
  label,
  icon,
}: {
  href: string | null;
  label: string;
  icon: React.ReactNode;
}) {
  const className =
    "flex h-9 w-9 items-center justify-center border border-ivory-400 transition-colors";

  if (!href) {
    return (
      <span
        aria-disabled="true"
        className={cn(className, "cursor-not-allowed text-ivory-500")}
      >
        {icon}
        <span className="sr-only">{label}</span>
      </span>
    );
  }

  return (
    <Link href={href} className={cn(className, "text-ink-900 hover:border-ink-400")}>
      {icon}
      <span className="sr-only">{label}</span>
    </Link>
  );
}

/** First, last, current and its neighbours; gaps elsewhere. */
function pageRange(page: number, pageCount: number): (number | "gap")[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }

  const pages = new Set([1, pageCount, page, page - 1, page + 1]);
  const sorted = [...pages]
    .filter((p) => p >= 1 && p <= pageCount)
    .sort((a, b) => a - b);

  const result: (number | "gap")[] = [];
  let previous = 0;
  for (const current of sorted) {
    if (previous && current - previous > 1) result.push("gap");
    result.push(current);
    previous = current;
  }
  return result;
}
