import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Header search — SRS §160.
 *
 * A plain GET form to /search: no client JavaScript, no debounce, no
 * suggestion popover. Submitting produces a real, shareable URL and the results
 * page renders on the server.
 *
 * Note this is a Server Component, and deliberately so. It previously read the
 * current query with `useSearchParams()` to prefill itself, which forced a
 * `"use client"` boundary and, because that hook suspends, a Suspense boundary
 * around it — and that boundary did not resolve, leaving the mobile search box
 * mounted inside React's hidden container and invisible on small screens. The
 * results page already states what was searched for in its heading, so the
 * prefill was not worth a hook. Do not reintroduce one here.
 */
export function SearchBox({
  className,
  defaultValue,
}: {
  className?: string;
  /** Only pass this where the server already knows the query. */
  defaultValue?: string;
}) {
  return (
    <form
      action="/search"
      method="get"
      role="search"
      className={cn("relative", className)}
    >
      <label htmlFor="site-search" className="sr-only">
        Search the catalogue
      </label>
      <input
        id="site-search"
        type="search"
        name="q"
        defaultValue={defaultValue}
        maxLength={120}
        placeholder="Search sarees, fabric, weavers…"
        className="h-10 w-full border border-ivory-400 bg-ivory-50 py-2 pl-4 pr-11 text-sm text-ink-900 placeholder:text-ink-400/70 transition-colors focus:border-brand-600 focus:outline-none"
      />
      <button
        type="submit"
        className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center text-ink-400 transition-colors hover:text-brand-600"
      >
        <Search aria-hidden="true" className="h-4 w-4" />
        <span className="sr-only">Search</span>
      </button>
    </form>
  );
}
