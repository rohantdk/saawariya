"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { recomputeProductRating } from "@/lib/catalogue/rating";
import { getCustomerContext } from "@/lib/commerce/context";
import { getCommerceSettings } from "@/lib/commerce/settings";
import { REVIEW_STATUS } from "@/lib/constants";
import {
  fieldErrors,
  reviewSchema,
  type ActionState,
} from "@/lib/validations/commerce";

/**
 * Writing a review — SRS §47.
 *
 * Two rules make a review mean something here:
 *
 *  1. **Verified purchase only.** A review can only be written for a product
 *     that appears on a DELIVERED sub-order belonging to this customer. That is
 *     checked against the order tables, not passed in from the form.
 *
 *  2. **Moderated.** New reviews are PENDING when `feature.reviews_moderated`
 *     is on, so they do not appear on the storefront until an admin approves
 *     them. The customer is told this rather than left wondering where their
 *     review went.
 *
 * The rating rollup on Product is recomputed from APPROVED reviews only, in the
 * same transaction — the storefront average must never include a review the
 * public cannot read.
 */
export async function submitReview(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getCustomerContext();
  if (!context) return { status: "error", message: "Sign in to leave a review." };

  const parsed = reviewSchema.safeParse({
    productId: formData.get("productId"),
    rating: formData.get("rating"),
    title: formData.get("title") ?? undefined,
    body: formData.get("body"),
  });

  if (!parsed.success) {
    const errors = fieldErrors(parsed.error);
    return {
      status: "error",
      errors,
      message: errors.rating?.[0] ?? errors.body?.[0],
    };
  }

  const { productId, rating, title, body } = parsed.data;

  const purchased = await prisma.orderItem.findFirst({
    where: {
      productId,
      subOrder: { status: "DELIVERED", order: { customerId: context.customerId } },
    },
    select: { id: true },
  });

  if (!purchased) {
    return {
      status: "error",
      message: "You can review a piece once it has been delivered to you.",
    };
  }

  const existing = await prisma.review.findUnique({
    where: { productId_userId: { productId, userId: context.userId } },
    select: { id: true },
  });

  if (existing) {
    return {
      status: "error",
      message: "You have already reviewed this piece.",
    };
  }

  const settings = await getCommerceSettings();
  const status = settings.reviewsModerated
    ? REVIEW_STATUS.PENDING
    : REVIEW_STATUS.APPROVED;

  await prisma.$transaction(async (tx) => {
    await tx.review.create({
      data: {
        productId,
        userId: context.userId,
        rating,
        title: title || null,
        body,
        status,
      },
    });

    // Only recompute when the review is immediately public. A pending review
    // must not move the average — that would leak unmoderated content as a
    // number even though the text is hidden.
    if (status === REVIEW_STATUS.APPROVED) {
      await recomputeProductRating(tx, productId);
    }
  });

  revalidatePath("/account/reviews");
  revalidatePath("/account");

  return {
    status: "success",
    message: settings.reviewsModerated
      ? "Thank you. Your review has been submitted and will appear once our team has approved it."
      : "Thank you — your review is now live.",
  };
}

export async function deleteReview(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getCustomerContext();
  if (!context) return { status: "error", message: "Sign in to manage reviews." };

  const id = String(formData.get("reviewId") ?? "");

  const review = await prisma.review.findFirst({
    where: { id, userId: context.userId },
    select: { id: true, productId: true },
  });
  if (!review) return { status: "error", message: "Review not found." };

  await prisma.$transaction(async (tx) => {
    await tx.review.delete({ where: { id: review.id } });
    await recomputeProductRating(tx, review.productId);
  });

  revalidatePath("/account/reviews");
  return { status: "success", message: "Your review has been removed." };
}

