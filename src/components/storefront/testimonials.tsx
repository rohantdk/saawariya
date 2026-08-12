import Link from "next/link";
import { RatingStars } from "@/components/storefront/rating-stars";
import type { Testimonial } from "@/lib/catalogue/queries";

/**
 * Customer testimonials — SRS §154.
 *
 * Every quote here is a real `Review` row that an admin approved, attributed to
 * the customer who wrote it and linked to the product it is about. Nothing on
 * this band is copy: if the moderation queue rejects a review it stops
 * appearing, and if the catalogue has no approved reviews the band does not
 * render at all.
 *
 * SRS §154 lists a profile image. The platform has never collected one, so the
 * card shows a monogram. Illustrating invented customers with photographs of
 * real people would be the one dishonest thing on the page.
 */
export function Testimonials({ items }: { items: Testimonial[] }) {
  if (items.length === 0) return null;

  return (
    <section className="border-t border-ivory-400 bg-ivory-100">
      <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
        <div className="mb-10 flex flex-col items-center text-center">
          <p className="eyebrow mb-3">In their words</p>
          <h2 className="font-display text-3xl leading-tight sm:text-[2rem]">
            What customers say
          </h2>
          <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-ink-400">
            Published reviews from verified purchases, shown exactly as they were
            written.
          </p>
        </div>

        <ul className="grid gap-5 md:grid-cols-3">
          {items.map((item) => (
            <li
              key={item.id}
              // min-w-0 so a long unbroken word cannot push the grid track wider
              // than the column and put the page into horizontal scroll at 375px.
              className="flex min-w-0 flex-col border border-ivory-400 bg-ivory-50 p-6"
            >
              <RatingStars value={item.rating} size="md" />

              {item.title && (
                <p className="mt-4 font-display text-lg leading-snug text-ink-900">
                  {item.title}
                </p>
              )}

              <blockquote className="mt-3 grow text-sm leading-relaxed text-ink-500">
                {item.body}
              </blockquote>

              <footer className="mt-6 flex items-center gap-3 border-t border-ivory-400 pt-4">
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-900 text-xs font-medium tracking-wide text-ivory-50"
                >
                  {initials(item.authorName)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm text-ink-900">
                    {item.authorName}
                  </span>
                  <Link
                    href={`/product/${item.productSlug}`}
                    className="block truncate text-xs text-ink-400 underline-offset-4 hover:text-brand-600 hover:underline"
                  >
                    on {item.productName}
                  </Link>
                </span>
              </footer>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** "Rohan Tidke" → "RT". Falls back to one letter for a single-word name. */
function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}
