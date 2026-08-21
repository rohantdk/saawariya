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
 * Split rather than full-bleed. The editorial photography is portrait, and
 * stretching a 768px-wide frame across a 1920px viewport both crops away most of
 * the garment and upscales what is left past the point where the zari reads.
 * Given a panel of its own, each frame is shown at roughly its native width and
 * stays sharp — and the copy gets a solid wine ground instead of a scrim fighting
 * the image behind it.
 *
 * Auto-advances, but stops on hover, on focus, when the tab is hidden, and
 * permanently once the visitor uses the controls: an image that moves while
 * someone is reading it is the most common complaint about carousels. It also
 * does not auto-advance at all under prefers-reduced-motion.
 *
 * Every slide is rendered — not just the active one — so the browser preloads
 * the next image and the transition is a cross-fade rather than a flash of
 * empty box. The text blocks are stacked in a single grid cell for the same
 * reason: the panel keeps the height of its tallest slide and nothing below it
 * shifts as the copy changes.
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
      className="relative isolate overflow-hidden bg-brand-900"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={() => setIsPaused(false)}
    >
      {/* The image column runs to the right edge of the window rather than
          stopping at the content container, so the hero reads as a full-bleed
          spread. The copy column right-aligns a 40rem block against the centre
          line, which puts its left edge on the same gutter as every other
          section on the page. */}
      <div className="grid lg:grid-cols-2">
        {/* ---- Copy panel ---- */}
        <div className="relative order-2 grid w-full max-w-[40rem] px-5 pb-12 pt-10 lg:order-1 lg:ml-auto lg:px-12 lg:pb-16 lg:pt-20">
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
                  // All slides occupy the same cell, so the panel sizes to the
                  // tallest and the controls never move between slides.
                  "col-start-1 row-start-1 flex flex-col justify-center self-center",
                  "transition-opacity duration-700 ease-[var(--ease-out-soft)]",
                  isActive ? "opacity-100" : "pointer-events-none opacity-0",
                )}
              >
                <p className="mb-5 inline-flex items-center gap-3 text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-gold-300">
                  <span aria-hidden="true" className="h-px w-8 bg-gold-400" />
                  The Edit
                </p>

                <h1 className="font-display text-[2.5rem] font-bold leading-[1.05] tracking-[-0.03em] text-cream sm:text-5xl lg:text-[3.75rem]">
                  {slide.title}
                </h1>

                {slide.subtitle && (
                  <p className="mt-5 max-w-md text-sm leading-relaxed text-cream/75 sm:text-base">
                    {slide.subtitle}
                  </p>
                )}

                {slide.linkUrl && (
                  <div>
                    <Link
                      href={slide.linkUrl}
                      className={cn(
                        "group/cta mt-9 inline-flex h-12 items-center gap-3 bg-cream px-8",
                        "text-xs font-semibold uppercase tracking-[0.16em] text-onyx",
                        "transition-colors duration-300 hover:bg-gold-300",
                      )}
                    >
                      Explore
                      <ArrowRight
                        aria-hidden="true"
                        className="h-3.5 w-3.5 transition-transform duration-300 ease-[var(--ease-out-soft)] group-hover/cta:translate-x-1"
                      />
                    </Link>
                  </div>
                )}
              </div>
            );
          })}

          {slides.length > 1 && (
            <div className="col-start-1 row-start-2 mt-10 flex items-center gap-5 lg:mt-14">
              <div className="flex items-center gap-2">
                <CarouselButton
                  label="Previous slide"
                  onClick={() => goTo(index - 1)}
                >
                  <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                </CarouselButton>
                <CarouselButton
                  label="Next slide"
                  onClick={() => goTo(index + 1)}
                >
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </CarouselButton>
              </div>

              <div className="flex items-center gap-2">
                {slides.map((slide, i) => (
                  <button
                    key={slide.id}
                    type="button"
                    onClick={() => goTo(i)}
                    aria-current={i === index}
                    className={cn(
                      "h-0.5 transition-all duration-500 ease-[var(--ease-out-soft)]",
                      i === index
                        ? "w-10 bg-gold-400"
                        : "w-5 bg-cream/30 hover:bg-cream/60",
                    )}
                  >
                    <span className="sr-only">Go to slide {i + 1}</span>
                  </button>
                ))}
              </div>

              <p
                aria-hidden="true"
                className="ml-auto font-display text-sm tabular-nums text-cream/50"
              >
                <span className="text-gold-300">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {" / "}
                {String(slides.length).padStart(2, "0")}
              </p>
            </div>
          )}
        </div>

        {/* ---- Image panel ---- */}
        <div className="relative order-1 aspect-[4/5] w-full self-stretch bg-brand-950 sm:aspect-[16/10] lg:order-2 lg:aspect-auto lg:min-h-[38rem]">
          {slides.map((slide, i) => (
            <Image
              key={slide.id}
              src={slide.imageUrl}
              alt=""
              fill
              priority={i === 0}
              sizes="(min-width: 1024px) 50vw, 100vw"
              className={cn(
                // These frames are portrait and the panel is landscape, so
                // roughly half the height is cropped whatever we do. Anchoring
                // slightly below centre keeps the model's face and the fall of
                // the drape in frame; object-top showed the ceiling.
                "object-cover object-[center_55%]",
                "transition-opacity duration-700 ease-[var(--ease-out-soft)]",
                i === index ? "opacity-100" : "opacity-0",
              )}
            />
          ))}

          {/* Feathers the frame into the wine panel so the two halves read as one
              composition rather than as a photo pasted beside a block of colour. */}
          <div
            aria-hidden="true"
            className="absolute inset-y-0 left-0 hidden w-32 bg-gradient-to-r from-brand-900 to-transparent lg:block"
          />
          <div
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-brand-900 to-transparent lg:hidden"
          />
        </div>
      </div>

      {slides.length > 1 && (
        /* Announces slide changes to screen readers without moving focus. */
        <p aria-live="polite" className="sr-only">
          Slide {index + 1} of {slides.length}: {slides[index].title}
        </p>
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
      className="rounded-md flex h-10 w-10 items-center justify-center border border-cream/25 text-cream transition-colors duration-300 hover:border-gold-400 hover:bg-cream/10 hover:text-gold-300"
    >
      {children}
      <span className="sr-only">{label}</span>
    </button>
  );
}
