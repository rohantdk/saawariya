"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type HeroSlide = {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  linkUrl: string | null;
};

/** How long a slide holds before the next one fades up. */
const DWELL_MS = 7000;

/**
 * Homepage hero — SRS §125, §147.
 *
 * Full-bleed photography with the copy centred over it and no scrim — the
 * imagery is chosen to carry cream text on its own, and dimming it would flatten
 * the one band on the page where the photograph is the product.
 *
 * It renders every live `HOME_HERO` banner in `sortOrder`, cross-fading between
 * them, so the order set in the admin panel is what the homepage does. With a
 * single banner it degrades to exactly what it was before: one still frame, no
 * controls.
 *
 * Motion here is deliberately slow — an 18s Ken Burns cycle and a 1.6s
 * cross-fade — because this band is looked *at*, not looked *past*, and the
 * design language is calm rather than bouncy. Rotation stops under
 * prefers-reduced-motion and while the tab is hidden, but **not** on mouse
 * hover — the user asked explicitly (2026-08-25) for the hero to stay
 * "always free flowing" regardless of cursor position, after finding that
 * hovering the photograph froze it and moving off reset the current slide's
 * dwell. It still pauses on keyboard focus (tabbing onto an indicator), which
 * is the accessibility case a mouse passing over the image never has: a
 * keyboard user needs the slide to hold still while they decide.
 *
 * The indicators being clickable buttons at all **reverses an earlier
 * decision** to make them inert `<span>`s and let the band rotate
 * unconditionally. Confirmed with the user 2026-08-25 and kept deliberately: an
 * auto-advancing carousel with no way to choose a slide or stop it via focus
 * fails WCAG 2.2.2. Do not revert them to spans on the strength of the older
 * note — but do not reintroduce mouse-hover pause either; that was tried in
 * this same round and explicitly rejected.
 */
export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const sectionRef = useRef<HTMLElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  // Bumped on resume so the dwell bar restarts in step with the fresh interval
  // below, rather than finishing early against a timer that began again at 0.
  const [run, setRun] = useState(0);

  const count = slides.length;

  // ---- Rotation -----------------------------------------------------------
  // `index` is a dependency on purpose: choosing a slide by hand clears and
  // restarts the interval, so a hand-picked slide gets its full dwell instead of
  // whatever was left of the previous one's.
  useEffect(() => {
    if (count < 2 || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = setInterval(() => {
      if (document.hidden) return;
      setIndex((current) => (current + 1) % count);
    }, DWELL_MS);

    return () => clearInterval(timer);
  }, [count, paused, index]);

  // ---- Parallax -----------------------------------------------------------
  // Writes 0→1 into --hero-progress as the section leaves the viewport. The
  // scroll listener is only attached while the hero is actually on screen, so
  // the rest of a long page scrolls without this running at all.
  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;

    const update = () => {
      frame = 0;
      const rect = node.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, -rect.top / rect.height));
      node.style.setProperty("--hero-progress", progress.toFixed(3));
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        window.addEventListener("scroll", onScroll, { passive: true });
        update();
      } else {
        window.removeEventListener("scroll", onScroll);
      }
    });

    observer.observe(node);

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const slide = slides[index];
  if (!slide) return null;

  const resume = () => {
    setPaused(false);
    setRun((n) => n + 1);
  };

  return (
    <section
      ref={sectionRef}
      aria-label="Featured collection"
      data-hero-paused={paused}
      // Deliberately no onMouseEnter/onMouseLeave pause — the user asked for
      // the hero to stay "always free flowing" regardless of cursor position;
      // hovering the photograph should never freeze or reset the rotation.
      // Focus-pause stays: a keyboard user tabbed onto an indicator still
      // needs the slide to hold still while they decide, which a pointer
      // passing over the image never needs.
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={resume}
      className="relative isolate min-h-[32rem] overflow-hidden bg-brand-900 sm:min-h-[36rem] lg:min-h-[42rem]"
    >
      {/* ---- Background images, full-bleed and cross-fading ---- */}
      {/* The parallax drift lives on this wrapper and the Ken Burns pan on the
          frames inside it, so the two transforms compose instead of one
          overwriting the other. */}
      <div className="hero-parallax absolute inset-0">
        {slides.map((item, i) => (
          <div
            key={item.id}
            aria-hidden="true"
            className={cn(
              // 1600ms and eased in *and* out: the user's standing note on this
              // band is that the change should read as "very smooth, almost
              // blending" rather than as a cut. Do not shorten without asking.
              "absolute inset-0 transition-opacity duration-[1600ms] ease-in-out",
              i === index ? "opacity-100" : "opacity-0",
            )}
          >
            <Image
              src={item.imageUrl}
              alt=""
              fill
              // Only the first frame is above the fold on load; marking them
              // all priority would have them compete for the same bandwidth.
              priority={i === 0}
              sizes="100vw"
              className="hero-frame object-cover object-center"
            />
          </div>
        ))}
      </div>

      {/* ---- Copy, overlaid and centred ---- */}
      {/* Keyed on the slide so every line replays its rise on a change. Only
          the active slide's copy is in the DOM, which keeps exactly one <h1>
          on the page and exactly one CTA in the tab order — the reason the
          copy swaps rather than cross-fading with the images. */}
      <div
        key={slide.id}
        className="hero-copy relative z-10 flex min-h-[32rem] w-full flex-col items-center justify-center px-5 py-24 text-center sm:min-h-[36rem] lg:min-h-[42rem]"
      >
        <p className="hero-line mb-5 inline-flex items-center gap-3 text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-gold-300">
          <span aria-hidden="true" className="h-px w-8 bg-gold-400" />
          The Edit
          <span aria-hidden="true" className="h-px w-8 bg-gold-400" />
        </p>

        <h1
          className="hero-line max-w-2xl font-display text-[2.5rem] font-bold leading-[1.05] tracking-[-0.03em] text-cream sm:text-5xl lg:text-[3.75rem]"
          style={{ animationDelay: "90ms" }}
        >
          {slide.title}
        </h1>

        {slide.subtitle && (
          <p
            className="hero-line mt-5 max-w-md text-sm leading-relaxed text-cream/80 sm:text-base"
            style={{ animationDelay: "190ms" }}
          >
            {slide.subtitle}
          </p>
        )}

        {slide.linkUrl && (
          <Link
            href={slide.linkUrl}
            style={{ animationDelay: "290ms" }}
            className={cn(
              "hero-line group/cta mt-9 inline-flex h-12 items-center gap-3 rounded-md bg-cream px-8",
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
        )}
      </div>

      {/* ---- Dwell indicators ---- */}
      {count > 1 && (
        <div className="absolute inset-x-0 bottom-9 z-20 flex justify-center gap-3">
          {slides.map((item, i) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show slide ${i + 1} of ${count}: ${item.title}`}
              aria-current={i === index}
              // The mark is a hairline but the target is not — the padding
              // carries this to a comfortable touch size without drawing a
              // 44px control over the photograph.
              className="group/bar cursor-pointer px-1 py-4"
            >
              <span className="relative block h-px w-10 overflow-hidden bg-cream/30 transition-colors group-hover/bar:bg-cream/60 sm:w-14">
                {i === index && (
                  // `key` restarts the fill on a slide change and on resume.
                  <span
                    key={`${index}-${run}`}
                    className="hero-dwell-fill absolute inset-0 bg-gold-300"
                    style={{ ["--hero-dwell" as string]: `${DWELL_MS}ms` }}
                  />
                )}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ---- Scroll cue ---- */}
      {/* Desktop only: on a phone the hero already runs past the fold and
          nobody needs telling that a page scrolls. */}
      <div
        aria-hidden="true"
        className="hero-copy absolute bottom-9 left-8 z-20 hidden lg:block"
      >
        <span className="relative block h-10 w-px overflow-hidden bg-cream/25">
          <span className="hero-cue-run absolute inset-x-0 top-0 block h-4 bg-gold-300" />
        </span>
      </div>
    </section>
  );
}
