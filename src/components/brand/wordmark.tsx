import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Saawariya brand lockup.
 *
 * This is the supplied artwork, not an interpretation of it. The original file
 * (public/brand/logo-original.jpg) is cream artwork printed on a solid maroon
 * field, so it cannot be dropped onto any other background without bringing a
 * maroon box with it. Both elements have therefore been lifted off that field
 * into transparent PNGs, and each exists in two colourways:
 *
 *   brand/mark.png            cream arch, maroon monogram — for dark surfaces
 *   brand/mark-on-light.png   maroon arch, cream monogram — for ivory surfaces
 *   brand/wordmark-cream.png  the wordmark, for dark surfaces
 *   brand/wordmark-maroon.png the wordmark, for ivory surfaces
 *
 * The arch was cut with an analytic mask (a rectangle capped by a semicircle)
 * rather than a colour threshold, because the monogram's tail runs past the
 * arch's flat base and any flood fill from the edge follows it inward and eats
 * the letterform. Regenerating them is a scripted step, not hand work — see
 * docs/DESIGN_SYSTEM.md.
 */

/** Proportions of the two source crops, used to reserve exact space. */
const MARK = { w: 166, h: 223 };
const TYPE = { w: 750, h: 176 };

/** The wordmark reads correctly at just under three-quarters of the mark's height. */
const TYPE_TO_MARK = 0.72;

/**
 * Sizing, and why it goes through a CSS variable.
 *
 * The lockup used to take its height from an inline `style`, which no class can
 * override — inline styles beat every selector. So the header rendered it at its
 * full desktop size on a phone: 224px of a 375px viewport, which together with
 * the menu button, the gaps, the padding and the signed-in actions cluster came
 * to 401px and made /cart and /checkout scroll sideways.
 *
 * `--lockup-h` is therefore never *declared* here. It is only *read*, with the
 * `size` prop as its fallback. A caller that says nothing gets `size`; a caller
 * that sets `--lockup-h` in a class — at any breakpoint — wins, because there is
 * no inline declaration left to outrank it.
 */
const lockupHeight = (size: number) => `var(--lockup-h, ${size}px)`;

export function ArchMark({
  size = 40,
  surface = "dark",
  className,
}: {
  /** Fallback height of the arch in pixels, used when --lockup-h is not set. */
  size?: number;
  /** The surface it sits on — "dark" means a wine or ink background. */
  surface?: "dark" | "light";
  className?: string;
}) {
  return (
    <Image
      src={surface === "dark" ? "/brand/mark.png" : "/brand/mark-on-light.png"}
      alt=""
      width={MARK.w}
      height={MARK.h}
      priority
      style={{ height: lockupHeight(size), width: "auto" }}
      className={cn("w-auto select-none", className)}
    />
  );
}

export function Wordmark({
  className,
  typeClassName,
  href = "/",
  showMark = true,
  surface = "dark",
  size = 40,
}: {
  className?: string;
  /**
   * Classes for the wordmark type only, so a caller can drop it and keep the
   * arch. The header does this on very narrow phones, where the full lockup
   * plus a 44px menu button and three 44px actions no longer fit the row.
   */
  typeClassName?: string;
  href?: string;
  showMark?: boolean;
  surface?: "dark" | "light";
  /** Height of the arch in pixels; the wordmark is scaled to match. */
  size?: number;
}) {
  return (
    <Link
      href={href}
      className={cn("group/mark inline-flex items-center gap-3", className)}
      aria-label="Saawariya — home"
    >
      {showMark && (
        <ArchMark
          size={size}
          surface={surface}
          // A slow, small lift on hover. The mark is a fixed piece of artwork,
          // so movement is the only affordance available to it.
          className="transition-transform duration-500 ease-[var(--ease-out-soft)] group-hover/mark:-translate-y-0.5"
        />
      )}
      <Image
        src={surface === "dark" ? "/brand/wordmark-cream.png" : "/brand/wordmark-maroon.png"}
        alt="Saawariya"
        width={TYPE.w}
        height={TYPE.h}
        priority
        style={{
          height: `calc(${lockupHeight(size)} * ${TYPE_TO_MARK})`,
          width: "auto",
        }}
        className={cn("w-auto select-none", typeClassName)}
      />
    </Link>
  );
}
