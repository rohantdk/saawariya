import "server-only";
import { prisma } from "@/lib/prisma";
import { CUSTOMER_TYPE, ORDER_STATUS, USER_STATUS } from "@/lib/constants";

/**
 * Customer administration — SRS §73.
 *
 * A "customer" here is a `User` with a `Customer` row, and both halves matter:
 * the tier (retail / wholesale) lives on `Customer`, while suspension lives on
 * `User.status` because that is what `src/lib/auth/dal.ts` checks on every
 * request. Anything that suspends an account therefore writes the User, not the
 * Customer — a flag on the wrong row would look right on this screen and do
 * nothing at all.
 */

const PAGE_SIZE = 20;

export type CustomerFilters = {
  tier?: string;
  status?: string;
  q?: string;
  page?: number;
};

export async function listCustomers(filters: CustomerFilters = {}) {
  const { tier = "all", status = "all", q = "", page = 1 } = filters;

  const where = {
    ...(tier !== "all" ? { customerType: tier } : {}),
    user: {
      ...(status !== "all" ? { status } : {}),
      ...(q
        ? {
            OR: [
              { fullName: { contains: q } },
              { email: { contains: q } },
              { mobile: { contains: q } },
            ],
          }
        : {}),
    },
  };

  const total = await prisma.customer.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(Math.max(1, page), pageCount);

  const customers = await prisma.customer.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (current - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      customerType: true,
      gstNumber: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          mobile: true,
          status: true,
          lastLoginAt: true,
        },
      },
      _count: { select: { orders: true } },
    },
  });

  return { customers, total, page: current, pageCount };
}

export async function customerCounts() {
  const [all, retail, wholesale, suspended] = await Promise.all([
    prisma.customer.count(),
    prisma.customer.count({ where: { customerType: CUSTOMER_TYPE.RETAIL } }),
    prisma.customer.count({ where: { customerType: CUSTOMER_TYPE.WHOLESALE } }),
    prisma.customer.count({
      where: { user: { status: USER_STATUS.SUSPENDED } },
    }),
  ]);

  return { all, retail, wholesale, suspended };
}

/**
 * One customer: the account, what they have bought, and what they have said.
 *
 * Lifetime value counts orders that were **not** cancelled. Counting every
 * order would flatter an account that placed and cancelled the same basket
 * five times, and this figure is exactly the one someone leans on when deciding
 * whether to suspend it.
 */
export async function getCustomerDetail(customerId: string) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      customerType: true,
      gstNumber: true,
      dateOfBirth: true,
      preferredLang: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          mobile: true,
          status: true,
          emailVerified: true,
          mobileVerified: true,
          lastLoginAt: true,
          createdAt: true,
          addresses: {
            select: {
              id: true,
              label: true,
              fullName: true,
              line1: true,
              city: true,
              state: true,
              pinCode: true,
              isDefaultShipping: true,
            },
          },
        },
      },
    },
  });
  if (!customer) return null;

  const [orders, spend, reviews, tickets] = await Promise.all([
    prisma.order.findMany({
      where: { customerId },
      orderBy: { placedAt: "desc" },
      take: 10,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalAmount: true,
        placedAt: true,
        _count: { select: { subOrders: true } },
      },
    }),

    prisma.order.aggregate({
      where: { customerId, status: { not: ORDER_STATUS.CANCELLED } },
      _sum: { totalAmount: true },
      _count: { _all: true },
    }),

    prisma.review.findMany({
      where: { userId: customer.user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        rating: true,
        title: true,
        status: true,
        createdAt: true,
        product: { select: { id: true, name: true } },
      },
    }),

    prisma.supportTicket.findMany({
      where: { raisedById: customer.user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        ticketNumber: true,
        subject: true,
        status: true,
        priority: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    customer,
    orders,
    stats: {
      orderCount: spend._count._all,
      lifetimeValue: spend._sum.totalAmount ?? 0,
    },
    reviews,
    tickets,
  };
}
