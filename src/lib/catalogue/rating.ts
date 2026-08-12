import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { REVIEW_STATUS } from "@/lib/constants";

/**
 * Recompute `Product.ratingAvg` / `ratingCount` from APPROVED reviews.
 *
 * `ratingAvg` is stored as an integer scaled by ten (45 = 4.5) — the codebase
 * holds no floats for values that are compared or aggregated. See the note in
 * `src/lib/utils.ts`.
 *
 * Shared rather than private to the customer review action, because Phase 6's
 * moderation queue changes exactly the same thing: **only approved reviews
 * count**, so approving one has to move the average and rejecting one has to
 * move it back. Two implementations of that rule is how a product ends up
 * advertising 4.6 stars from reviews nobody can read — which is the bug the
 * Phase 4 verification specifically checked for on the way in, and this is the
 * path on the way out.
 *
 * Always call it inside the transaction that changed the review, so the
 * counters and the rows they summarise cannot disagree.
 */
export async function recomputeProductRating(
  tx: Prisma.TransactionClient,
  productId: string,
): Promise<{ ratingAvg: number; ratingCount: number }> {
  const stats = await tx.review.aggregate({
    where: { productId, status: REVIEW_STATUS.APPROVED },
    _avg: { rating: true },
    _count: { rating: true },
  });

  const ratingAvg = Math.round((stats._avg.rating ?? 0) * 10);
  const ratingCount = stats._count.rating;

  await tx.product.update({
    where: { id: productId },
    data: { ratingAvg, ratingCount },
  });

  return { ratingAvg, ratingCount };
}
