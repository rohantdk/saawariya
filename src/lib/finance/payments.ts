import "server-only";
import { prisma } from "@/lib/prisma";
import { PAYMENT_METHOD, PAYMENT_STATUS } from "@/lib/constants";

/**
 * The payment transaction log — SRS §118.
 *
 * **Read-only, and that is the design.** No role holds a permission to edit a
 * payment: `PAYMENT_VIEW` is the only one that exists, and the finance role is
 * granted exactly that. A payment row states what a gateway did, so a screen
 * that let someone change it would be recording a fiction. The two things
 * finance can actually *do* about money — release a payout, decide a refund —
 * are their own models with their own state machines, and this screen links to
 * them.
 *
 * This is the same argument Phase 6 made for the admin inventory screen being
 * read-only, and it is worth restating here because a "Mark as paid" button is
 * the single most tempting thing to add to a page like this.
 *
 * There is no payment gateway in this build, and the checkout says so on the
 * page. Online methods carry a `SIM-<orderNumber>` reference; this screen shows
 * that reference verbatim rather than dressing it up as a bank transaction id.
 */

export const PAYMENTS_PAGE_SIZE = 25;

export type PaymentFilters = {
  status?: string;
  method?: string;
  q?: string;
  page?: number;
};

function buildWhere({ status = "all", method = "all", q = "" }: PaymentFilters) {
  return {
    ...(status !== "all" ? { status } : {}),
    ...(method !== "all" ? { method } : {}),
    ...(q
      ? {
          OR: [
            { gatewayRef: { contains: q } },
            { order: { orderNumber: { contains: q } } },
            { order: { customer: { user: { fullName: { contains: q } } } } },
            { order: { customer: { user: { email: { contains: q } } } } },
          ],
        }
      : {}),
  };
}

export async function listPayments(filters: PaymentFilters = {}) {
  const where = buildWhere(filters);

  const total = await prisma.payment.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / PAYMENTS_PAGE_SIZE));
  const page = Math.min(Math.max(1, filters.page ?? 1), pageCount);

  const payments = await prisma.payment.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAYMENTS_PAGE_SIZE,
    take: PAYMENTS_PAGE_SIZE,
    select: {
      id: true,
      method: true,
      amount: true,
      status: true,
      gatewayRef: true,
      failureReason: true,
      createdAt: true,
      paidAt: true,
      order: {
        select: {
          orderNumber: true,
          status: true,
          customer: {
            select: { user: { select: { fullName: true, email: true } } },
          },
        },
      },
      refunds: {
        select: { id: true, amount: true, status: true },
      },
    },
  });

  // Summed over the whole filtered set rather than the current page: a total
  // that changes when you turn the page is not a total.
  const filteredTotal = await prisma.payment.aggregate({
    where,
    _sum: { amount: true },
  });

  return {
    payments,
    total,
    page,
    pageCount,
    amount: filteredTotal._sum.amount ?? 0,
  };
}

/** Tab counts. Every status is listed even at zero, so the tabs do not move. */
export async function paymentCounts(filters: PaymentFilters = {}) {
  const scope = { method: filters.method, q: filters.q };

  const grouped = await prisma.payment.groupBy({
    by: ["status"],
    where: buildWhere({ ...scope, status: "all" }),
    _count: { _all: true },
  });

  const counts: Record<string, number> = { all: 0 };
  for (const status of Object.values(PAYMENT_STATUS)) counts[status] = 0;
  for (const row of grouped) {
    counts[row.status] = row._count._all;
    counts.all += row._count._all;
  }
  return counts;
}

/** Method breakdown for the filter, so it never offers an empty option. */
export async function paymentMethodOptions() {
  const grouped = await prisma.payment.groupBy({
    by: ["method"],
    _count: { _all: true },
  });

  return Object.values(PAYMENT_METHOD)
    .map((method) => ({
      code: method,
      count: grouped.find((row) => row.method === method)?._count._all ?? 0,
    }))
    .filter((option) => option.count > 0);
}
