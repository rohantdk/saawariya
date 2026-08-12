import { cn } from "@/lib/utils";

/**
 * Star rating.
 *
 * Drawn as a single star path clipped by width so a 4.3 shows four full stars
 * and a partial fifth, rather than rounding to a whole star. Ratings on this
 * platform are stored as integers scaled by 10, so 4.3 is a value that really
 * occurs and rounding it away would misreport the product.
 */
export function RatingStars({
  value,
  size = "sm",
  className,
}: {
  /** 0 to 5, decimals allowed. */
  value: number;
  size?: "sm" | "md";
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(5, value));
  const percent = (clamped / 5) * 100;
  const dimension = size === "md" ? "h-4 w-4" : "h-3 w-3";

  return (
    <span
      className={cn("relative inline-flex shrink-0", className)}
      role="img"
      aria-label={`${clamped.toFixed(1)} out of 5 stars`}
    >
      <span className="flex gap-0.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <Star key={i} className={cn(dimension, "text-ivory-500")} />
        ))}
      </span>
      <span
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${percent}%` }}
        aria-hidden="true"
      >
        <span className="flex gap-0.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <Star key={i} className={cn(dimension, "shrink-0 text-gold-400")} />
          ))}
        </span>
      </span>
    </span>
  );
}

function Star({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
      <path d="M10 1.5l2.47 5.24 5.53.82-4 4.05.94 5.89L10 14.75 5.06 17.5 6 11.61l-4-4.05 5.53-.82L10 1.5z" />
    </svg>
  );
}
