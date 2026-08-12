"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CategoryNode } from "@/lib/catalogue/queries";

/**
 * Desktop category navigation — SRS §157.
 *
 * Opens on hover for pointer users and on Enter/Space for keyboard users, which
 * is why each trigger is a real <button> with aria-expanded rather than a link
 * that happens to reveal a panel on :hover. The top-level name is also reachable
 * as a link inside the panel ("All Sarees"), so a keyboard user is never forced
 * through a menu to get to the category page itself.
 */
export function MegaMenu({ categories }: { categories: CategoryNode[] }) {
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const pathname = usePathname();
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navRef = useRef<HTMLDivElement>(null);

  // Navigating away must dismiss the panel; without this it stays open over the
  // page you just moved to. Adjusted during render rather than in an effect —
  // React re-renders before painting, so the panel never flashes on the new
  // page, and an effect here would be a cascading render.
  const [renderedPath, setRenderedPath] = useState(pathname);
  if (pathname !== renderedPath) {
    setRenderedPath(pathname);
    setOpenSlug(null);
  }

  useEffect(() => {
    if (!openSlug) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenSlug(null);
    }
    function onPointerDown(event: MouseEvent) {
      if (!navRef.current?.contains(event.target as Node)) setOpenSlug(null);
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [openSlug]);

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  function open(slug: string) {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpenSlug(slug);
  }

  // A short grace period on leave: the pointer has to cross a gap between the
  // trigger and the panel, and closing instantly makes the menu feel broken.
  function scheduleClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpenSlug(null), 140);
  }

  return (
    <div ref={navRef} className="relative" onMouseLeave={scheduleClose}>
      <nav aria-label="Product categories">
        <ul className="flex items-center justify-center gap-1">
          <li>
            <Link
              href="/shop"
              className={cn(
                "inline-flex h-11 items-center px-3 text-[0.6875rem] font-medium uppercase tracking-[0.14em] transition-colors",
                pathname === "/shop"
                  ? "text-brand-600"
                  : "text-ink-900 hover:text-brand-600",
              )}
            >
              All
            </Link>
          </li>

          {categories.map((category) => {
            const isOpen = openSlug === category.slug;
            const isCurrent = pathname.startsWith(`/shop/${category.slug}`);

            return (
              <li key={category.id}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-haspopup="true"
                  onMouseEnter={() => open(category.slug)}
                  onFocus={() => open(category.slug)}
                  onClick={() => setOpenSlug(isOpen ? null : category.slug)}
                  className={cn(
                    "inline-flex h-11 items-center gap-1.5 px-3 text-[0.6875rem] font-medium uppercase tracking-[0.14em] transition-colors",
                    isOpen || isCurrent
                      ? "text-brand-600"
                      : "text-ink-900 hover:text-brand-600",
                  )}
                >
                  {category.name}
                  <ChevronDown
                    aria-hidden="true"
                    className={cn(
                      "h-3 w-3 transition-transform duration-200",
                      isOpen && "rotate-180",
                    )}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {categories.map((category) => {
        if (openSlug !== category.slug) return null;

        return (
          <div
            key={category.id}
            onMouseEnter={() => open(category.slug)}
            className="absolute left-1/2 top-full z-50 w-[min(60rem,calc(100vw-3rem))] -translate-x-1/2 border border-ivory-400 bg-ivory-50 shadow-lifted"
          >
            <div className="grid grid-cols-[1fr_15rem]">
              <div className="p-7">
                <p className="mb-1 font-display text-lg">{category.name}</p>
                {category.description && (
                  <p className="mb-5 max-w-md text-xs leading-relaxed text-ink-400">
                    {category.description}
                  </p>
                )}

                <ul className="grid grid-cols-2 gap-x-8 gap-y-1">
                  {category.children.map((child) => (
                    <li key={child.id}>
                      <Link
                        href={`/shop/${category.slug}/${child.slug}`}
                        className="block border-b border-transparent py-1.5 text-sm text-ink-500 transition-colors hover:border-gold-400 hover:text-brand-600"
                      >
                        {child.name}
                      </Link>
                    </li>
                  ))}
                </ul>

                <Link
                  href={`/shop/${category.slug}`}
                  className="mt-5 inline-flex items-center gap-2 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-brand-600 hover:text-brand-700"
                >
                  All {category.name}
                  <span aria-hidden="true">→</span>
                </Link>
              </div>

              {category.imageUrl && (
                <Link
                  href={`/shop/${category.slug}`}
                  className="relative block overflow-hidden bg-ivory-200"
                  tabIndex={-1}
                  aria-hidden="true"
                >
                  <Image
                    src={category.imageUrl}
                    alt=""
                    fill
                    sizes="15rem"
                    className="object-cover"
                  />
                </Link>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
