import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { SOLD_SUB_ORDER_STATUSES } from "@/lib/constants";

/**
 * Recompute `Product.salesCount` from the order lines that actually sold.
 *
 * A denormalised column exists for the same reason `Product.priceEffective` and
 * `SupportTicket.priorityRank` do: Prisma cannot `orderBy` an aggregate across
 * a relation, so "sort by best selling" needs a real column to sort on, and
 * sorting in memory instead would break pagination on the listing page.
 *
 * Before this existed, `salesCount` was **merchandising data invented by the
 * seed** — two products claimed 207 and 143 units against a database holding 39
 * sub-orders in total — and nothing at runtime ever moved it. The storefront's
 * "Best selling" sort, the seller's "Units sold" figure and the admin product
 * page were all reporting that number as fact. Same class as the fabricated
 * campaign counters Phase 8 removed.
 *
 * Call it inside the transaction that moved the sub-order, so the counter and
 * the lines behind it cannot disagree.
 */
export async function recomputeProductSales(
  tx: Prisma.TransactionClient,
  productIds: string[],
): Promise<void> {
  const unique = [...new Set(productIds)];
  if (unique.length === 0) return;

  const sold = await tx.orderItem.groupBy({
    by: ["productId"],
    where: {
      productId: { in: unique },
      subOrder: { status: { in: [...SOLD_SUB_ORDER_STATUSES] } },
    },
    _sum: { quantity: true },
  });

  const byProduct = new Map(sold.map((row) => [row.productId, row._sum?.quantity ?? 0]));

  // A product whose only sale was returned drops out of the groupBy entirely,
  // so iterate the ids asked for rather than the rows found — otherwise the
  // count would stick at its old value forever.
  for (const productId of unique) {
    await tx.product.update({
      where: { id: productId },
      data: { salesCount: byProduct.get(productId) ?? 0 },
    });
  }
}
