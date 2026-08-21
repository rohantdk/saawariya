"use client";

import { useEffect, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";

/**
 * Small-screen wrapper for the filter panel.
 *
 * The panel itself stays a Server Component — it is passed in as `children`, so
 * none of the facet rendering or its data crosses into the client bundle. This
 * component only owns the open/closed state of the sheet that holds it.
 *
 * `location` is passed in rather than read with `useSearchParams()`. That hook
 * suspends, which required a Suspense boundary here, and that boundary did not
 * resolve — leaving this whole control inside React's hidden container and the
 * Filter button invisible on the screens it exists for. The caller is a Server
 * Component that already knows the URL, so it just tells us.
 */
export function FilterDrawer({
  activeCount,
  location,
  children,
}: {
  activeCount: number;
  /** Current path plus query string; a change to either closes the sheet. */
  location: string;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  // Applying a filter navigates; the sheet should get out of the way so the
  // result is visible rather than sitting behind it. Adjusted during render
  // rather than in an effect, which would cascade.
  const [renderedLocation, setRenderedLocation] = useState(location);
  if (location !== renderedLocation) {
    setRenderedLocation(location);
    setIsOpen(false);
  }

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
        className="flex h-10 items-center gap-2 border border-ivory-400 bg-ivory-50 px-4 text-xs text-ink-900 transition-colors hover:border-ink-400 lg:hidden"
      >
        <SlidersHorizontal aria-hidden="true" className="h-3.5 w-3.5" />
        Filter
        {activeCount > 0 && (
          <span className="flex h-4 min-w-4 items-center justify-center bg-brand-600 px-1 text-[0.625rem] text-cream">
            {activeCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 bg-scrim/40"
            tabIndex={-1}
          >
            <span className="sr-only">Close filters</span>
          </button>

          <div className="absolute inset-y-0 right-0 flex w-[min(22rem,90vw)] flex-col bg-ivory-50 shadow-lifted">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-ivory-400 px-5">
              <span className="text-[0.6875rem] font-medium uppercase tracking-[0.16em]">
                Filter
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex h-10 w-10 items-center justify-center text-ink-900"
              >
                <X aria-hidden="true" className="h-5 w-5" />
                <span className="sr-only">Close filters</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">{children}</div>
          </div>
        </div>
      )}
    </>
  );
}
