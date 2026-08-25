import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { requireCustomer } from "@/lib/commerce/context";
import { getCustomerReviews, getReviewableItems } from "@/lib/commerce/orders";
import { getCommerceSettings } from "@/lib/commerce/settings";
import { REVIEW_STATUS } from "@/lib/constants";
import { StatusBadge } from "@/components/commerce/status-badge";
import { RatingStars } from "@/components/storefront/rating-stars";
import { ReviewComposer } from "@/components/commerce/review-composer";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "My reviews" };

const REVIEW_TONE = {
  [REVIEW_STATUS.PENDING]: "warning",
  [REVIEW_STATUS.APPROVED]: "success",
  [REVIEW_STATUS.REJECTED]: "danger",
} as const;

const REVIEW_LABEL = {
  [REVIEW_STATUS.PENDING]: "Awaiting approval",
  [REVIEW_STATUS.APPROVED]: "Published",
  [REVIEW_STATUS.REJECTED]: "Not published",
} as const;

/**
 * Reviews — SRS §47.
 *
 * Split in two: pieces the customer has received but not yet reviewed, and the
 * reviews they have written. The first list is what makes reviews on this site
 * verified purchases — it is built from delivered order lines, so there is no
 * route to reviewing something you did not buy.
 *
 * A pending review is shown to its author with its moderation state. Hiding it
 * until approval is what makes people write it twice.
 */
export default async function ReviewsPage() {
  const customer = await requireCustomer("/account/reviews");

  const [reviewable, reviews, settings] = await Promise.all([
    getReviewableItems(customer.customerId, customer.userId),
    getCustomerReviews(customer.userId),
    getCommerceSettings(),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-3xl sm:text-4xl">My reviews</h1>
      <p className="mt-2 text-sm text-ink-400">
        {settings.reviewsModerated
          ? "Reviews are read by our team before they appear on the site."
          : "Your reviews appear on the site as soon as you post them."}
      </p>

      {/* ---- Waiting to be reviewed ---- */}
      <section className="mt-8">
        <h2 className="mb-4 font-display text-xl">
          Ready to review ({reviewable.length})
        </h2>

        {reviewable.length === 0 ? (
          <p className="rounded-md border border-ivory-400 bg-ivory-50 p-6 text-sm text-ink-400">
            Nothing waiting. Once an order is delivered, the pieces in it appear
            here for you to review.
          </p>
        ) : (
          <ul className="space-y-4">
            {reviewable.map((item) => (
              <li
                key={item.id}
                className="rounded-md border border-ivory-400 bg-ivory-50 p-5"
              >
                <div className="flex gap-4">
                  <div className="relative aspect-[3/4] w-14 shrink-0 overflow-hidden bg-ivory-200">
                    {item.imageUrl && (
                      <Image
                        src={item.imageUrl}
                        alt={item.productName}
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0">
                    {/* Delisted since it was bought? The line still deserves a
                        review, but there is no page to land on — same rule the
                        posted-reviews list below already applies. */}
                    {item.product.status === "APPROVED" ? (
                      <Link
                        href={`/product/${item.product.slug}`}
                        className="text-sm text-ink-900 hover:text-brand-600"
                      >
                        {item.productName}
                      </Link>
                    ) : (
                      <p className="text-sm text-ink-900">{item.productName}</p>
                    )}
                    <p className="mt-1 text-xs text-ink-400">
                      Delivered
                      {item.subOrder.deliveredAt &&
                        ` ${formatDate(item.subOrder.deliveredAt)}`}{" "}
                      · order {item.subOrder.order.orderNumber}
                    </p>
                  </div>
                </div>

                <div className="mt-5 border-t border-ivory-300 pt-5">
                  <ReviewComposer
                    productId={item.productId}
                    productName={item.productName}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---- Written ---- */}
      <section className="mt-10">
        <h2 className="mb-4 font-display text-xl">
          Reviews you have written ({reviews.length})
        </h2>

        {reviews.length === 0 ? (
          <div className="rounded-md border border-ivory-400 bg-ivory-50 p-8 text-center">
            <span
              aria-hidden="true"
              className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-ivory-200 text-ink-400"
            >
              <Star className="h-5 w-5" />
            </span>
            <p className="text-sm text-ink-400">
              You have not written a review yet.
            </p>
            <ButtonLink href="/account/orders" variant="secondary" className="mt-5">
              View your orders
            </ButtonLink>
          </div>
        ) : (
          <ul className="space-y-4">
            {reviews.map((review) => (
              <li
                key={review.id}
                className="flex gap-4 rounded-md border border-ivory-400 bg-ivory-50 p-5"
              >
                <div className="relative aspect-[3/4] w-12 shrink-0 overflow-hidden bg-ivory-200">
                  {review.product.images[0] && (
                    <Image
                      src={review.product.images[0].url}
                      alt={review.product.name}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                    <div className="min-w-0">
                      {review.product.status === "APPROVED" ? (
                        <Link
                          href={`/product/${review.product.slug}`}
                          className="text-sm text-ink-900 hover:text-brand-600"
                        >
                          {review.product.name}
                        </Link>
                      ) : (
                        <p className="text-sm text-ink-900">
                          {review.product.name}
                        </p>
                      )}
                      <div className="mt-1.5 flex items-center gap-2">
                        <RatingStars value={review.rating} />
                        <span className="text-xs text-ink-400">
                          {formatDate(review.createdAt)}
                        </span>
                      </div>
                    </div>

                    <StatusBadge
                      label={
                        REVIEW_LABEL[
                          review.status as keyof typeof REVIEW_LABEL
                        ] ?? review.status
                      }
                      tone={
                        REVIEW_TONE[
                          review.status as keyof typeof REVIEW_TONE
                        ] ?? "neutral"
                      }
                    />
                  </div>

                  {review.title && (
                    <p className="mt-3 text-sm font-medium text-ink-900">
                      {review.title}
                    </p>
                  )}
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-500">
                    {review.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
