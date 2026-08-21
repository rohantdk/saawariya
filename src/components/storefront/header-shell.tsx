"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * The scroll-reactive frame the storefront header renders inside.
 *
 * Only the state lives here. The header itself stays a Server Component, because
 * it reads the category tree, the signed-in user and the bag counts — pushing
 * that across a client boundary would mean shipping the catalogue query result
 * to the browser to draw a navigation bar.
 *
 * The condensed state is published as `data-scrolled` on the header's group, so
 * every descendant can respond with a `group-data-[scrolled=true]:` variant and
 * no child needs its own listener. The group is deliberately unnamed: Tailwind
 * emits no rule for the named form of a data-attribute group variant, while the
 * nested `group/mark` and `group/user` groups inside the header compile to their
 * own selectors and so cannot collide with this one.
 *
 * Reading `scrollY` inside rAF rather than in the listener keeps the work on the
 * frame the browser is already painting; a listener that calls setState on every
 * scroll event fires far more often than the screen refreshes.
 */
export function HeaderShell({ children }: { children: React.ReactNode }) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    let frame = 0;

    function onScroll() {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        // A band rather than a single point: a threshold crossed by one pixel
        // makes the header flicker when a trackpad hovers on the boundary.
        setIsScrolled((current) =>
          current ? window.scrollY > 32 : window.scrollY > 72,
        );
      });
    }

    // Restoring a scrolled position on reload must not start from the tall state.
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <header
      data-scrolled={isScrolled ? "true" : "false"}
      className={cn(
        "group sticky top-0 z-40 bg-brand-900",
        "transition-shadow duration-500 ease-[var(--ease-out-soft)]",
        "data-[scrolled=true]:shadow-[0_10px_30px_-12px_rgba(38,28,23,0.45)]",
      )}
    >
      {children}

      {/* A zari hairline along the bottom edge. It is always present so the
          header has a defined foot, and brightens once the page is scrolled to
          separate the bar from content passing underneath it. */}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 h-px",
          "bg-gradient-to-r from-transparent via-gold-500/50 to-transparent",
          "transition-opacity duration-500 ease-[var(--ease-out-soft)]",
          "opacity-60 group-data-[scrolled=true]:opacity-100",
        )}
      />
    </header>
  );
}
