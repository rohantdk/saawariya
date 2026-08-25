"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";

/**
 * The `<main>` element for every shell, with scroll reveals applied to whatever
 * page is rendered inside it.
 *
 * A layout cannot see a page's sections — `children` is one opaque element —
 * so this finds them in the DOM after render rather than by wrapping them in
 * JSX. That is what makes the effect apply to all 87 pages, and to any page
 * added later, without either the page or the layout knowing about it.
 *
 * Three things keep it from being the usual fade-in-everything treatment:
 *
 *   - **Nothing above the fold is ever hidden.** A block already on screen when
 *     the page mounts is left alone entirely. Hiding it would flash — the server
 *     HTML paints before hydration — and content you can already see has no
 *     business animating. Only blocks you actually scroll to reveal.
 *   - **It reveals page blocks, not rows.** The target is the content column's
 *     direct children, so a console table animates once as a card rather than
 *     220 times as rows.
 *   - **It yields to hand-placed reveals.** Any block that is, or contains, a
 *     `<Reveal>` is skipped, so a grid staggering its own items is not also
 *     faded in wholesale on top of that.
 *
 * State is written as a `data-reveal` attribute rather than a class or inline
 * style because React owns `className` and `style` on these elements and would
 * drop ours on its next render; it does not touch a data attribute it never set.
 */
/**
 * Elements that group other elements, and so are safe to treat as a page's
 * content column. Anything not listed here ends the descent — see the loop.
 */
const CONTAINERS = new Set(["DIV", "SECTION", "ARTICLE", "FORM", "UL", "OL"]);

export function RevealMain({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  // The layout does not remount on navigation, so without this the next page's
  // blocks would render already-visible and never be observed.
  const pathname = usePathname();

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let observer: IntersectionObserver | null = null;

    // One frame's grace so streamed Suspense content is in place before we
    // decide what is on screen and what is below it.
    const frame = requestAnimationFrame(() => {
      // Pages are near-universally `main > div.mx-auto.max-w-7xl > (blocks)`,
      // so walk down the single-child wrappers to reach the content column.
      // Bounded twice over: by depth, and by only ever stepping into an element
      // that groups other elements. Without the tag guard a page whose column
      // is a lone heading would have this descend into the <h1> and animate its
      // individual spans.
      let column: HTMLElement = root;
      for (let depth = 0; depth < 4; depth += 1) {
        const only = column.children.length === 1 ? column.children[0] : null;
        if (!(only instanceof HTMLElement)) break;
        if (!CONTAINERS.has(only.tagName)) break;
        column = only;
      }

      // A column that turned out to hold one block (or none) is not a column —
      // fall back to the shell's own children rather than revealing a leaf.
      const source =
        column !== root && column.children.length > 1 ? column : root;

      const targets = Array.from(source.children).filter(
        (child): child is HTMLElement => {
          if (!(child instanceof HTMLElement)) return false;
          // Already handled, by us on a previous pass or by a <Reveal>.
          if (child.dataset.reveal) return false;
          if (child.matches("[data-reveal-item]")) return false;
          if (child.querySelector("[data-reveal-item]")) return false;

          // A sticky filter rail or a fixed drawer must not be translated out
          // from under the reader.
          const position = getComputedStyle(child).position;
          if (position === "fixed" || position === "sticky") return false;

          const rect = child.getBoundingClientRect();
          // Zero-height children are wrappers around portals and modals.
          return rect.height > 0;
        },
      );

      observer = new IntersectionObserver(
        (entries) => {
          entries
            .filter((entry) => entry.isIntersecting)
            .forEach((entry, i) => {
              const el = entry.target as HTMLElement;
              // Blocks crossing the threshold in the same frame sit side by
              // side, so they are staggered against each other; a block
              // arriving on its own gets no delay and no perceived lag.
              if (i > 0) el.style.transitionDelay = `${i * 80}ms`;
              el.dataset.reveal = "shown";
              observer?.unobserve(el);
            });
        },
        { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
      );

      for (const target of targets) {
        // The rule that makes this safe on a server-rendered page: only hide
        // what cannot currently be seen.
        if (target.getBoundingClientRect().top < window.innerHeight) continue;
        target.dataset.reveal = "hidden";
        observer.observe(target);
      }
    });

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [pathname]);

  return (
    <main ref={ref} id={id} className={className}>
      {children}
    </main>
  );
}
