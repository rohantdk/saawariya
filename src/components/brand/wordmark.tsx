import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Saawariya wordmark.
 *
 * Drawn as inline SVG + type rather than placed as an image, because the supplied
 * logo is a JPEG on a solid maroon field — it cannot sit on the ivory background
 * without a visible box, and it does not scale cleanly for the header.
 * The arch-and-monogram silhouette and both colours are taken from that file
 * (public/brand/logo-original.jpg).
 *
 * TODO(handover): replace <ArchMark> with the official vector once Team ARJITAY
 * supplies an SVG or transparent PNG. Nothing else needs to change.
 */

export function ArchMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 44"
      fill="none"
      aria-hidden="true"
      className={cn("h-8 w-auto", className)}
    >
      {/* Arch silhouette — a rounded-top niche, as in the original mark */}
      <path
        d="M16 0C7.163 0 0 7.163 0 16v28h32V16C32 7.163 24.837 0 16 0Z"
        className="fill-brand-600"
      />
      {/* Stylised 'S' monogram, reversed out of the arch */}
      <path
        d="M20.5 13.2c-.9-1.5-2.6-2.4-4.4-2.4-2.6 0-4.6 1.7-4.6 4 0 2 1.4 3.2 3.9 4.2l1.6.7c3.4 1.4 5.1 3.2 5.1 6.2 0 3.6-3 6.3-7 6.3-3.2 0-5.8-1.6-6.9-4.2"
        stroke="currentColor"
        className="stroke-ivory-100"
        strokeWidth="2.1"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="16" cy="30.5" r="2.3" className="fill-ivory-100" />
    </svg>
  );
}

export function Wordmark({
  className,
  href = "/",
  showMark = true,
  tone = "dark",
}: {
  className?: string;
  href?: string;
  showMark?: boolean;
  tone?: "dark" | "light";
}) {
  return (
    <Link
      href={href}
      className={cn("inline-flex items-center gap-3", className)}
      aria-label="Saawariya — home"
    >
      {showMark && <ArchMark />}
      <span
        className={cn(
          "font-display text-2xl lowercase leading-none tracking-[0.02em]",
          tone === "light" ? "text-ivory-100" : "text-ink-900",
        )}
      >
        saawariya
      </span>
    </Link>
  );
}
