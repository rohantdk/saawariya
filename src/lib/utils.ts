import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge conditional class names, with later Tailwind utilities winning. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Money is stored everywhere as an integer number of PAISE (1 rupee = 100 paise).
 * Nothing in this codebase holds a currency value in a float — rounding drift in
 * order totals, commission splits and settlements is not recoverable once written.
 */
export function formatPaise(
  paise: number,
  options: { showDecimals?: boolean } = {},
): string {
  const { showDecimals = false } = options;
  const rupees = paise / 100;

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(rupees);
}

/** Percentage discount between the original and the offer price. */
export function discountPercent(original: number, offer: number): number {
  if (original <= 0 || offer >= original) return 0;
  return Math.round(((original - offer) / original) * 100);
}

/** Ratings are stored as integers scaled by 10 (45 = 4.5 stars). */
export function formatRating(scaled: number): string {
  return (scaled / 10).toFixed(1);
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

/**
 * A `Date` as an `<input type="datetime-local">` value.
 *
 * `toISOString()` is UTC and the input is local, so using it directly shifts
 * every scheduled coupon and banner by the timezone offset — five and a half
 * hours here, which is enough to start a promotion on the wrong day.
 */
export function toDateTimeLocal(date: Date | null | undefined): string {
  if (!date) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

/** URL-safe slug from a product or category name. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
