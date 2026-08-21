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
  surface = "light",
  id = "site-search",
}: {
  className?: string;
  /** Only pass this where the server already knows the query. */
  defaultValue?: string;
  /** "dark" is the wine header; "light" is any ivory surface. */
  surface?: "light" | "dark";
  /** Must be unique per rendered instance — the header draws two. */
  id?: string;
}) {
  const isDark = surface === "dark";

  return (
    <form
      action="/search"
      method="get"
      role="search"
      className={cn("group/search relative", className)}
    >
      <label htmlFor={id} className="sr-only">
        Search the catalogue
      </label>
      <input
        id={id}
        type="search"
        name="q"
        defaultValue={defaultValue}
        maxLength={120}
        placeholder="Search sarees, fabric, weavers…"
        className={cn(
          "h-10 w-full border py-2 pl-4 pr-11 text-sm transition-colors duration-300 focus:outline-none",
          isDark
            ? // Sits on wine: a translucent well rather than a white box, which
              // would punch a hole in the header.
              "border-cream/20 bg-cream/[0.06] text-cream placeholder:text-cream/45 hover:border-cream/35 focus:border-gold-400 focus:bg-cream/[0.1]"
            : "border-ivory-400 bg-ivory-50 text-ink-900 placeholder:text-ink-400/70 focus:border-brand-600",
        )}
      />
      <button
        type="submit"
        className={cn(
          "absolute right-0 top-0 flex h-10 w-10 items-center justify-center transition-colors",
          isDark
            ? "text-cream/60 hover:text-gold-300"
            : "text-ink-400 hover:text-brand-600",
        )}
      >
        <Search aria-hidden="true" className="h-4 w-4" />
        <span className="sr-only">Search</span>
      </button>
    </form>
  );
}
