"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminAction } from "@/lib/admin/context";
import { AUDIT_ACTIONS, writeAudit } from "@/lib/admin/audit";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { recomputeProductRating } from "@/lib/catalogue/rating";
import { reviewModerationSchema } from "@/lib/validations/admin";
import { fieldErrors, type ActionState } from "@/lib/validations/commerce";
import { formatRating } from "@/lib/utils";

/**
 * Review moderation — SRS §47.
 *
 * The decision does two things that must happen together: it changes whether
 * the review is publicly readable, and it changes the number on the product
 * card. `recomputeProductRating` runs in the same transaction for exactly that
 * reason — a product advertising a star rating built partly from reviews the
 * public cannot read is a lie the storefront would have no way to detect.
 *
 * This is the other end of a behaviour Phase 4 verified deliberately: a newly
 * posted review stayed PENDING and did **not** move `Product.ratingAvg`. This
 * action is what finally moves it.
 */
export async function moderateReview(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireAdminAction(PERMISSIONS.REVIEW_MODERATE);
  if (!auth.ok) return { status: "error", message: auth.error };

  const parsed = reviewModerationSchema.safeParse({
    reviewId: formData.get("reviewId"),
    decision: formData.get("decision"),
  });
  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error) };
  }

  const review = await prisma.review.findUnique({
    where: { id: parsed.data.reviewId },
    select: {
      id: true,
      rating: true,
      status: true,
      productId: true,
      product: { select: { name: true, slug: true } },
      user: { select: { id: true, fullName: true } },
    },
  });
  if (!review) return { status: "error", message: "Review not found." };

  if (review.status === parsed.data.decision) {
    return {
      status: "error",
      message: `That review is already ${parsed.data.decision.toLowerCase()}.`,
    };
  }

  const approving = parsed.data.decision === "APPROVED";

  const rollup = await prisma.$transaction(async (tx) => {
    await tx.review.update({
      where: { id: review.id },
      data: { status: parsed.data.decision },
    });

    // Recomputed on both decisions, not only on approval: rejecting a review
    // that was previously live has to take its stars back out of the average.
    const next = await recomputeProductRating(tx, review.productId);

    await tx.notification.create({
      data: {
        userId: review.user.id,
        title: approving ? "Your review is live" : "Your review was not published",
        body: approving
          ? `Your review of ${review.product.name} is now visible to other shoppers.`
          : `Your review of ${review.product.name} did not meet our review guidelines and has not been published.`,
        category: "SYSTEM",
        linkUrl: approving ? `/product/${review.product.slug}` : "/account/reviews",
      },
    });

    await writeAudit(
      {
        userId: auth.admin.userId,
        action: approving
          ? AUDIT_ACTIONS.REVIEW_APPROVED
          : AUDIT_ACTIONS.REVIEW_REJECTED,
        entityType: "Review",
        entityId: review.id,
        summary: `${review.rating}★ review of ${review.product.name} by ${review.user.fullName} ${
          approving ? "approved" : "rejected"
        }`,
        meta: {
          productId: review.productId,
          from: review.status,
          ratingAvg: next.ratingAvg,
          ratingCount: next.ratingCount,
        },
      },
      tx,
    );

    return next;
  });

  revalidatePath("/admin/reviews");
  revalidatePath(`/product/${review.product.slug}`);
  revalidatePath("/account/reviews");
  // The rating rollup shows on cards across the shop, and the seller's own
  // catalogue renders it too.
  revalidatePath("/shop");
  revalidatePath("/seller/products");

  return {
    status: "success",
    message:
      rollup.ratingCount > 0
        ? `${approving ? "Published" : "Rejected"}. ${review.product.name} now shows ${formatRating(
            rollup.ratingAvg,
          )}★ from ${rollup.ratingCount} review${rollup.ratingCount === 1 ? "" : "s"}.`
        : `${approving ? "Published" : "Rejected"}. ${review.product.name} has no public reviews.`,
  };
}
