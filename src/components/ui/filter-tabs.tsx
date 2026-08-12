import Link from "next/link";

/**
 * The status tab strip above a queue.
 *
 * Links, not client state — the same rule the storefront filters have followed
 * since Phase 3. Each tab is an `<a>` to the same page with a different query
 * string, so the view is bookmarkable, prefetched, works without JavaScript, and
 * there is no client filter state that can desync from the URL.
 *
 * The console screens built in Phase 6 each carry their own copy of this markup;
 * this component exists because Phase 8 adds eight more queues, and eight more
 * copies is how the tabs end up a different height in the finance panel than in
 * the support one. The older pages were left alone deliberately — they work, and
 * rewriting shipped screens to share markup is churn, not a fix.
 */
export function FilterTabs({
  tabs,
  active,
  href,
  ariaLabel = "Filter by status",
}: {
  tabs: { key: string; label: string; count?: number }[];
  active: string;
  href: (key: string) => string;
  ariaLabel?: string;
}) {
  return (
    <nav aria-label={ariaLabel} className="mb-5">
      <ul className="flex flex-wrap gap-1 border-b border-ivory-400">
        {tabs.map((tab) => {
          const isActive = active === tab.key;
          return (
            <li key={tab.key}>
              <Link
                href={href(tab.key)}
                aria-current={isActive ? "page" : undefined}
                className={`-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm transition-colors ${
                  isActive
                    ? "border-brand-600 text-brand-600"
                    : "border-transparent text-ink-500 hover:text-ink-900"
                }`}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span className="text-xs text-ink-400">{tab.count}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
