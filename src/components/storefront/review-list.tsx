import { formatDate } from "@/lib/utils";
import { RatingStars } from "@/components/storefront/rating-stars";
import type { RatingBreakdown } from "@/lib/catalogue/queries";

type Review = {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  createdAt: Date;
  user: { fullName: string };
};

/**
 * Customer reviews — SRS §47.
 *
 * The average and the breakdown are computed from the approved reviews shown
 * here, not read off `Product.ratingAvg`, which also counts the 12 reviews
 * still awaiting moderation. A visitor should be able to add up the bars and
 * arrive at the number printed above them.
 */
export function ReviewList({
  reviews,
  breakdown,
}: {
  reviews: Review[];
  breakdown: RatingBreakdown;
}) {
  if (breakdown.total === 0) {
    return (
      <p className="text-sm text-ink-400">
        No reviews yet. Reviews appear here once a verified buyer has left one
        and it has passed moderation.
      </p>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[16rem_1fr]">
      <div>
        <p className="font-display text-5xl leading-none text-ink-900">
          {breakdown.average.toFixed(1)}
        </p>
        <RatingStars value={breakdown.average} size="md" className="mt-3" />
        <p className="mt-2 text-xs text-ink-400">
          {breakdown.total} {breakdown.total === 1 ? "review" : "reviews"}
        </p>

        <ul className="mt-5 space-y-1.5">
          {breakdown.buckets.map((bucket) => (
            <li key={bucket.stars} className="flex items-center gap-3 text-xs">
              <span className="w-8 shrink-0 tabular-nums text-ink-400">
                {bucket.stars} ★
              </span>
              <span className="h-1.5 flex-1 bg-ivory-300">
                <span
                  className="block h-full bg-gold-400"
                  style={{ width: `${bucket.percent}%` }}
                />
              </span>
              <span className="w-6 shrink-0 text-right tabular-nums text-ink-400">
                {bucket.count}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <ul className="divide-y divide-ivory-400 border-t border-ivory-400">
        {reviews.map((review) => (
          <li key={review.id} className="py-6 first:pt-0">
            <div className="flex flex-wrap items-center gap-3">
              <RatingStars value={review.rating} />
              {review.title && (
                <p className="text-sm font-medium text-ink-900">
                  {review.title}
                </p>
              )}
            </div>
            <p className="mt-2.5 text-sm leading-relaxed text-ink-500">
              {review.body}
            </p>
            <p className="mt-3 text-xs text-ink-400">
              {review.user.fullName} · {formatDate(review.createdAt)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
