import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/context";
import { listReviews, reviewCounts } from "@/lib/admin/reviews";
import { REVIEW_STATUS } from "@/lib/constants";
import { REVIEW_STATUS_TONE } from "@/lib/status-tone";
import { formatDate, formatRating } from "@/lib/utils";
import { StatusBadge } from "@/components/commerce/status-badge";
import { ReviewModeration } from "@/components/admin/review-moderation";

export const metadata: Metadata = { title: "Reviews" };

const TABS = [
  { key: REVIEW_STATUS.PENDING, label: "Awaiting moderation" },
  { key: REVIEW_STATUS.APPROVED, label: "Published" },
  { key: REVIEW_STATUS.REJECTED, label: "Rejected" },
  { key: "all", label: "All" },
];

/**
 * Review moderation — SRS §47.
 *
 * Every row shows the product's *current* rollup beside the review being
 * judged, because that number is what the decision changes. Publishing a
 * one-star review of a product sitting at 4.8 is a different act from
 * publishing it on a product with no reviews at all, and the queue should not
 * hide which one you are doing.
 */
export default async function AdminReviewsPage({
  searchParams,
}: PageProps<"/admin/reviews">) {
  await requireAdmin("/admin/reviews");
  const params = await searchParams;

  const status =
    typeof params.status === "string" ? params.status : REVIEW_STATUS.PENDING;
  const q = typeof params.q === "string" ? params.q : "";
  const page = Number(params.page) || 1;

  const [{ reviews, total, pageCount, page: current }, counts] =
    await Promise.all([listReviews({ status, q, page }), reviewCounts()]);

  const keep = (extra: Record<string, string | number>) => {
    const search = new URLSearchParams();
    if (status) search.set("status", status);
    if (q) search.set("q", q);
    for (const [key, value] of Object.entries(extra)) {
      if (value === "") search.delete(key);
      else search.set(key, String(value));
    }
    const qs = search.toString();
    return qs ? `/admin/reviews?${qs}` : "/admin/reviews";
  };

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6">
        <p className="eyebrow mb-2">Review moderation</p>
        <h1 className="font-display text-3xl">Reviews</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-400">
          Only published reviews are visible on the storefront, and only
          published reviews count towards a product&rsquo;s star rating.
        </p>
      </header>

      <nav aria-label="Filter by status" className="mb-5">
        <ul className="flex flex-wrap gap-1 border-b border-ivory-400">
          {TABS.map((tab) => {
            const isActive = status === tab.key;
            return (
              <li key={tab.key}>
                <Link
                  href={keep({ status: tab.key, page: 1 })}
                  aria-current={isActive ? "page" : undefined}
                  className={`-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm transition-colors ${
                    isActive
                      ? "border-brand-600 text-brand-600"
                      : "border-transparent text-ink-500 hover:text-ink-900"
                  }`}
                >
                  {tab.label}
                  <span className="text-xs text-ink-400">
                    {counts[tab.key] ?? 0}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <form action="/admin/reviews" className="mb-6 flex gap-2">
        <input type="hidden" name="status" value={status} />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search review text, product or reviewer"
          aria-label="Search reviews"
          className="rounded-md w-full max-w-sm border border-ivory-400 bg-ivory-50 px-4 py-2.5 text-sm text-ink-900 placeholder:text-ink-400/60 focus:border-brand-600 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-md border border-ink-900/15 px-5 text-xs font-medium uppercase tracking-[0.12em] text-ink-900 transition-colors hover:bg-ivory-200"
        >
          Search
        </button>
      </form>

      {reviews.length === 0 ? (
        <div className="rounded-md border border-ivory-400 bg-ivory-50 p-10 text-center">
          <p className="text-sm text-ink-400">
            {status === REVIEW_STATUS.PENDING && !q
              ? "Nothing awaiting moderation."
              : "No reviews match this view."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {reviews.map((review) => {
            const image = review.product.images[0];
            return (
              <li
                key={review.id}
                className="rounded-md border border-ivory-400 bg-ivory-50 p-5"
              >
                <div className="flex flex-wrap items-start gap-4">
                  <span className="relative aspect-square w-14 shrink-0 overflow-hidden bg-ivory-200">
                    {image && (
                      <Image
                        src={image.url}
                        alt=""
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/admin/products/${review.product.id}`}
                      className="text-sm text-ink-900 underline-offset-4 hover:text-brand-600 hover:underline"
                    >
                      {review.product.name}
                    </Link>
                    <p className="mt-0.5 text-xs text-ink-400">
                      {review.product.ratingCount > 0
                        ? `Currently ${formatRating(review.product.ratingAvg)}★ from ${review.product.ratingCount} published review${
                            review.product.ratingCount === 1 ? "" : "s"
                          }`
                        : "No published reviews yet"}
                    </p>
                  </div>

                  <StatusBadge
                    label={review.status}
                    tone={REVIEW_STATUS_TONE[review.status] ?? "neutral"}
                  />
                </div>

                <div className="mt-4 border-t border-ivory-300 pt-4">
                  <p className="text-sm text-ink-900">
                    <span aria-label={`${review.rating} out of 5`}>
                      {"★".repeat(review.rating)}
                      <span className="text-ink-400">
                        {"★".repeat(5 - review.rating)}
                      </span>
                    </span>
                    {review.title && (
                      <span className="ml-2 font-medium">{review.title}</span>
                    )}
                  </p>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-500">
                    {review.body}
                  </p>
                  <p className="mt-2 text-xs text-ink-400">
                    {review.user.fullName} · {review.user.email} ·{" "}
                    {formatDate(review.createdAt)}
                  </p>
                </div>

                <div className="mt-4">
                  <ReviewModeration
                    reviewId={review.id}
                    status={review.status}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {pageCount > 1 && (
        <nav
          aria-label="Pagination"
          className="mt-8 flex items-center justify-between gap-4"
        >
          {current > 1 ? (
            <Link
              href={keep({ page: current - 1 })}
              className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500 transition-colors hover:text-brand-600"
            >
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <p className="text-xs text-ink-400">
            Page {current} of {pageCount} · {total} review
            {total === 1 ? "" : "s"}
          </p>
          {current < pageCount ? (
            <Link
              href={keep({ page: current + 1 })}
              className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500 transition-colors hover:text-brand-600"
            >
              Next →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
