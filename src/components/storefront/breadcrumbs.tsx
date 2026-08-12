import Link from "next/link";
import { ChevronRight } from "lucide-react";

/**
 * Breadcrumb trail. The last crumb is the current page and is not a link, and
 * the list carries schema.org BreadcrumbList microdata so the hierarchy is
 * legible to crawlers as well as to people — SRS §159 (SEO).
 */
export function Breadcrumbs({
  trail,
}: {
  trail: { href?: string; label: string }[];
}) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6">
      <ol
        itemScope
        itemType="https://schema.org/BreadcrumbList"
        className="flex flex-wrap items-center gap-1.5 text-xs text-ink-400"
      >
        {trail.map((crumb, index) => (
          <li
            key={`${crumb.label}-${index}`}
            itemProp="itemListElement"
            itemScope
            itemType="https://schema.org/ListItem"
            className="flex items-center gap-1.5"
          >
            {crumb.href ? (
              <Link
                href={crumb.href}
                itemProp="item"
                className="transition-colors hover:text-brand-600"
              >
                <span itemProp="name">{crumb.label}</span>
              </Link>
            ) : (
              <span itemProp="name" className="text-ink-900" aria-current="page">
                {crumb.label}
              </span>
            )}
            <meta itemProp="position" content={String(index + 1)} />
            {index < trail.length - 1 && (
              <ChevronRight aria-hidden="true" className="h-3 w-3 text-ivory-500" />
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
