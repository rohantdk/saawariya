import "server-only";
import { prisma } from "@/lib/prisma";
import { REVIEW_STATUS } from "@/lib/constants";

/**
 * Review moderation — SRS §47.
 *
 * Only APPROVED reviews are public and only APPROVED reviews count towards
 * `Product.ratingAvg`, so this queue is the single gate between what a customer
 * wrote and what the storefront says about a product.
 *
 * The queue is oldest first, unlike every other list in this console. A review
 * left unmoderated is a customer waiting; working newest-first leaves the
 * oldest one waiting forever.
 */

const PAGE_SIZE = 20;

export async function listReviews(
  filters: { status?: string; q?: string; page?: number } = {},
) {
  const { status = REVIEW_STATUS.PENDING, q = "", page = 1 } = filters;

  const where = {
    ...(status !== "all" ? { status } : {}),
    ...(q
      ? {
          OR: [
            { body: { contains: q } },
            { title: { contains: q } },
            { product: { name: { contains: q } } },
            { user: { fullName: { contains: q } } },
          ],
        }
      : {}),
  };

  const total = await prisma.review.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(Math.max(1, page), pageCount);

  const reviews = await prisma.review.findMany({
    where,
    orderBy: {
      createdAt: status === REVIEW_STATUS.PENDING ? "asc" : "desc",
    },
    skip: (current - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      rating: true,
      title: true,
      body: true,
      status: true,
      createdAt: true,
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          slug: true,
          ratingAvg: true,
          ratingCount: true,
          images: {
            where: { isMain: true },
            take: 1,
            select: { url: true },
          },
        },
      },
      user: { select: { id: true, fullName: true, email: true } },
    },
  });

  return { reviews, total, page: current, pageCount };
}

export async function reviewCounts(): Promise<Record<string, number>> {
  const rows = await prisma.review.groupBy({
    by: ["status"],
    _count: { _all: true },
  });

  const counts: Record<string, number> = {
    all: 0,
    ...Object.fromEntries(Object.values(REVIEW_STATUS).map((s) => [s, 0])),
  };
  for (const row of rows) {
    counts[row.status] = row._count._all;
    counts.all += row._count._all;
  }
  return counts;
}
