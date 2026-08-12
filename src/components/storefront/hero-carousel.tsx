"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type HeroSlide = {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  linkUrl: string | null;
};

/**
 * Homepage hero — SRS §125, §147.
 *
 * Auto-advances, but stops on hover, on focus, when the tab is hidden, and
 * permanently once the visitor uses the controls: an image that moves while
 * someone is reading it is the most common complaint about carousels. It also
 * does not auto-advance at all under prefers-reduced-motion.
 *
 * Every slide is rendered — not just the active one — so the browser preloads
 * the next image and the transition is a cross-fade rather than a flash of
 * empty box.
 */
export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const interacted = useRef(false);

  const goTo = useCallback(
    (next: number) => {
      interacted.current = true;
      setIndex(((next % slides.length) + slides.length) % slides.length);
    },
    [slides.length],
  );

  useEffect(() => {
    if (slides.length < 2 || isPaused || interacted.current) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) return;

    const timer = setInterval(() => {
      if (document.hidden) return;
      setIndex((current) => (current + 1) % slides.length);
    }, 6000);

    return () => clearInterval(timer);
  }, [slides.length, isPaused]);

  if (slides.length === 0) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured collections"
      className="relative isolate h-[26rem] overflow-hidden bg-ink-900 sm:h-[32rem] lg:h-[38rem]"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={() => setIsPaused(false)}
    >
      {slides.map((slide, i) => {
        const isActive = i === index;

        return (
          <div
            key={slide.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${slides.length}`}
            aria-hidden={!isActive}
            // inert keeps the offscreen slides' links out of the tab order.
            inert={!isActive}
            className={cn(
              "absolute inset-0 transition-opacity duration-700 ease-[var(--ease-out-soft)]",
              isActive ? "opacity-100" : "opacity-0",
            )}
          >
            <Image
              src={slide.imageUrl}
              alt=""
              fill
              priority={i === 0}
              sizes="100vw"
              className="object-cover object-center"
            />
            {/* Museum textile photography is bright and busy; the copy needs a
                deliberate scrim rather than a text-shadow to stay readable. */}
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-r from-ink-900/85 via-ink-900/55 to-ink-900/10"
            />

            <div className="relative mx-auto flex h-full max-w-7xl items-center px-5 lg:px-8">
              <div className="max-w-lg">
                <p className="mb-4 inline-flex items-center gap-3 text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-gold-300">
                  <span aria-hidden="true" className="h-px w-7 bg-gold-400" />
                  The Edit
                </p>
                <h1 className="font-display text-4xl leading-[1.1] text-ivory-50 sm:text-5xl lg:text-[3.5rem]">
                  {slide.title}
                </h1>
                {slide.subtitle && (
                  <p className="mt-4 max-w-md text-sm leading-relaxed text-ivory-100/80 sm:text-base">
                    {slide.subtitle}
                  </p>
                )}
                {slide.linkUrl && (
                  <Link
                    href={slide.linkUrl}
                    className="mt-8 inline-flex h-12 items-center bg-ivory-50 px-8 text-xs font-medium uppercase tracking-[0.16em] text-ink-900 transition-colors hover:bg-gold-300"
                  >
                    Explore
                  </Link>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {slides.length > 1 && (
        <>
          <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3 lg:left-auto lg:right-8 lg:translate-x-0">
            <CarouselButton
              label="Previous slide"
              onClick={() => goTo(index - 1)}
            >
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            </CarouselButton>

            <div className="flex items-center gap-2">
              {slides.map((slide, i) => (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => goTo(i)}
                  aria-current={i === index}
                  className={cn(
                    "h-1 transition-all duration-300",
                    i === index
                      ? "w-8 bg-gold-400"
                      : "w-4 bg-ivory-100/40 hover:bg-ivory-100/70",
                  )}
                >
                  <span className="sr-only">Go to slide {i + 1}</span>
                </button>
              ))}
            </div>

            <CarouselButton label="Next slide" onClick={() => goTo(index + 1)}>
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </CarouselButton>
          </div>

          {/* Announces slide changes to screen readers without moving focus. */}
          <p aria-live="polite" className="sr-only">
            Slide {index + 1} of {slides.length}: {slides[index].title}
          </p>
        </>
      )}
    </section>
  );
}

function CarouselButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center border border-ivory-100/30 text-ivory-50 transition-colors hover:border-ivory-50 hover:bg-ivory-50/10"
    >
      {children}
      <span className="sr-only">{label}</span>
    </button>
  );
}
