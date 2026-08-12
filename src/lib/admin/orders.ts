import "server-only";
import { prisma } from "@/lib/prisma";
import { ORDER_STATUS } from "@/lib/constants";

/**
 * Platform-wide order administration — SRS §78.
 *
 * The list is over `Order` and the detail is over its `SubOrder`s, which is the
 * shape of the domain rather than a UI choice: a customer places one Order and
 * pays for it once, and each seller's part moves through the pipeline on its
 * own. Anything that reports on fulfilment reads sub-orders; anything that
 * reports on what was bought reads the order.
 */

const PAGE_SIZE = 20;

export type AdminOrderFilters = {
  status?: string;
  q?: string;
  page?: number;
};

export async function listOrders(filters: AdminOrderFilters = {}) {
  const { status = "all", q = "", page = 1 } = filters;

  const where = {
    ...(status !== "all" ? { status } : {}),
    ...(q
      ? {
          OR: [
            { orderNumber: { contains: q } },
            { shipShippingName: { contains: q } },
            { customer: { user: { email: { contains: q } } } },
            { subOrders: { some: { subOrderNumber: { contains: q } } } },
          ],
        }
      : {}),
  };

  const total = await prisma.order.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(Math.max(1, page), pageCount);

  const orders = await prisma.order.findMany({
    where,
    orderBy: { placedAt: "desc" },
    skip: (current - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      subtotal: true,
      discountAmount: true,
      totalAmount: true,
      couponCode: true,
      placedAt: true,
      shipCity: true,
      shipState: true,
      customer: {
        select: {
          id: true,
          customerType: true,
          user: { select: { fullName: true, email: true } },
        },
      },
      subOrders: {
        select: {
          id: true,
          subOrderNumber: true,
          status: true,
          seller: { select: { businessName: true } },
        },
      },
      payments: { select: { method: true, status: true } },
    },
  });

  return { orders, total, page: current, pageCount };
}

export async function orderCounts(): Promise<Record<string, number>> {
  const rows = await prisma.order.groupBy({
    by: ["status"],
    _count: { _all: true },
  });

  const counts: Record<string, number> = {
    all: 0,
    ...Object.fromEntries(Object.values(ORDER_STATUS).map((s) => [s, 0])),
  };
  for (const row of rows) {
    counts[row.status] = row._count._all;
    counts.all += row._count._all;
  }
  return counts;
}

/**
 * One order in full: every sub-order, every line, the payment, any refunds, and
 * the whole event trail.
 *
 * The events are read at order level rather than per sub-order and shown as one
 * timeline. Someone diagnosing "where is this order" needs the sequence across
 * sellers, and three separate lists make an interleaving impossible to see.
 */
export async function getOrderDetail(orderNumber: string) {
  return prisma.order.findUnique({
    where: { orderNumber },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      subtotal: true,
      discountAmount: true,
      shippingAmount: true,
      taxAmount: true,
      totalAmount: true,
      couponCode: true,
      placedAt: true,
      cancelledAt: true,
      cancelReason: true,
      shipShippingName: true,
      shipMobile: true,
      shipLine1: true,
      shipLine2: true,
      shipCity: true,
      shipState: true,
      shipPinCode: true,
      customer: {
        select: {
          id: true,
          customerType: true,
          gstNumber: true,
          user: { select: { id: true, fullName: true, email: true, mobile: true } },
        },
      },
      subOrders: {
        orderBy: { subOrderNumber: "asc" },
        select: {
          id: true,
          subOrderNumber: true,
          status: true,
          subtotal: true,
          discountAmount: true,
          shippingAmount: true,
          totalAmount: true,
          confirmedAt: true,
          dispatchedAt: true,
          deliveredAt: true,
          seller: {
            select: { id: true, businessName: true, verificationStatus: true },
          },
          items: {
            select: {
              id: true,
              productId: true,
              productName: true,
              productSku: true,
              imageUrl: true,
              unitPrice: true,
              priceTier: true,
              quantity: true,
              lineTotal: true,
            },
          },
          settlement: {
            select: {
              id: true,
              status: true,
              grossAmount: true,
              commissionAmount: true,
              netAmount: true,
            },
          },
        },
      },
      payments: {
        select: {
          id: true,
          method: true,
          amount: true,
          status: true,
          gatewayRef: true,
          paidAt: true,
          refunds: {
            select: {
              id: true,
              amount: true,
              reason: true,
              status: true,
              requestedAt: true,
            },
          },
        },
      },
      events: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          subOrderId: true,
          fromStatus: true,
          toStatus: true,
          actorRole: true,
          note: true,
          createdAt: true,
        },
      },
    },
  });
}

export type AdminOrderDetail = NonNullable<
  Awaited<ReturnType<typeof getOrderDetail>>
>;
