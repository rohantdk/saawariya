"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Wordmark } from "@/components/brand/wordmark";
import { SearchBox } from "@/components/storefront/search-box";
import type { CategoryNode } from "@/lib/catalogue/queries";

/**
 * Small-screen navigation. The mega-menu's hover model has no equivalent on
 * touch, so categories become an accordion inside a drawer instead of trying to
 * make a hover panel work with taps.
 */
export function MobileNav({
  categories,
  utilityLinks,
}: {
  categories: CategoryNode[];
  utilityLinks: { href: string; label: string }[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const pathname = usePathname();

  // Close on navigation, adjusted during render rather than in an effect so
  // the drawer is already gone on the first paint of the new page.
  const [renderedPath, setRenderedPath] = useState(pathname);
  if (pathname !== renderedPath) {
    setRenderedPath(pathname);
    setIsOpen(false);
  }

  // A drawer that scrolls the page behind it reads as a bug.
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-expanded={isOpen}
        aria-controls="mobile-nav-drawer"
        // 44x44: this is the only way into navigation on a phone, so it gets
        // the full touch target rather than the 40px it had.
        className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center text-cream/85 transition-colors hover:text-gold-300 lg:hidden"
      >
        <Menu aria-hidden="true" className="h-5 w-5" />
        <span className="sr-only">Open menu</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="rounded-md absolute inset-0 bg-scrim/40"
            tabIndex={-1}
          >
            <span className="sr-only">Close menu</span>
          </button>

          <div
            id="mobile-nav-drawer"
            className="absolute inset-y-0 left-0 flex w-[min(22rem,88vw)] flex-col bg-ivory-50 shadow-lifted"
          >
            <div className="flex h-20 shrink-0 items-center justify-between border-b border-ivory-400 bg-brand-900 px-5">
              <Wordmark surface="dark" size={40} />
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex h-10 w-10 items-center justify-center text-cream/85 transition-colors hover:text-gold-300"
              >
                <X aria-hidden="true" className="h-5 w-5" />
                <span className="sr-only">Close menu</span>
              </button>
            </div>

            {/* A distinct id: the header already has both a desktop and a mobile
                search input in the document, and duplicate ids would break the
                label association for all three. */}
            <div className="border-b border-ivory-400 p-5">
              <SearchBox id="site-search-drawer" />
            </div>

            <nav
              aria-label="Product categories"
              className="flex-1 overflow-y-auto px-5 py-4"
            >
              <Link
                href="/shop"
                className="block py-2.5 text-sm font-medium text-ink-900"
              >
                All products
              </Link>

              <ul>
                {categories.map((category) => {
                  const isExpanded = expanded === category.slug;

                  return (
                    <li key={category.id} className="border-t border-ivory-300">
                      <div className="flex items-center justify-between">
                        <Link
                          href={`/shop/${category.slug}`}
                          className="flex-1 py-2.5 text-sm text-ink-900"
                        >
                          {category.name}
                        </Link>
                        <button
                          type="button"
                          aria-expanded={isExpanded}
                          onClick={() =>
                            setExpanded(isExpanded ? null : category.slug)
                          }
                          className="flex h-9 w-9 items-center justify-center text-ink-400"
                        >
                          <ChevronDown
                            aria-hidden="true"
                            className={cn(
                              "h-4 w-4 transition-transform duration-200",
                              isExpanded && "rotate-180",
                            )}
                          />
                          <span className="sr-only">
                            {isExpanded ? "Collapse" : "Expand"} {category.name}
                          </span>
                        </button>
                      </div>

                      {isExpanded && (
                        <ul className="pb-2 pl-4">
                          {category.children.map((child) => (
                            <li key={child.id}>
                              <Link
                                href={`/shop/${category.slug}/${child.slug}`}
                                className="block py-2 text-sm text-ink-400"
                              >
                                {child.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>

              <ul className="mt-4 border-t border-ivory-300 pt-4">
                {utilityLinks.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="block py-2 text-sm text-ink-400"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
