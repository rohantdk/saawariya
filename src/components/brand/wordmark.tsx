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

export function ArchMark({
  size = 40,
  surface = "dark",
  className,
}: {
  /** Rendered height of the arch, in pixels. */
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
      style={{ height: size, width: (size * MARK.w) / MARK.h }}
      className={cn("w-auto select-none", className)}
    />
  );
}

export function Wordmark({
  className,
  href = "/",
  showMark = true,
  surface = "dark",
  size = 40,
}: {
  className?: string;
  href?: string;
  showMark?: boolean;
  surface?: "dark" | "light";
  /** Height of the arch in pixels; the wordmark is scaled to match. */
  size?: number;
}) {
  const typeHeight = Math.round(size * TYPE_TO_MARK);

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
        style={{ height: typeHeight, width: (typeHeight * TYPE.w) / TYPE.h }}
        className="w-auto select-none"
      />
    </Link>
  );
}
