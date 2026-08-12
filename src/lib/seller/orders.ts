import "server-only";
import { prisma } from "@/lib/prisma";
import { SUB_ORDER_STATUS } from "@/lib/constants";

/**
 * Seller order reads — SRS §61.
 *
 * The seller works on `SubOrder`, never `Order`. An Order can span several
 * sellers and is the customer's contract with Saawariya; a SubOrder is exactly
 * one seller's part of it. Showing a seller the Order would show them another
 * seller's lines and another seller's money.
 *
 * Every query is scoped by `sellerId` in the `where`. Sub-order numbers appear
 * in URLs and are guessable — SAAW-2026-000013-A is one character from someone
 * else's parcel — so ownership is part of the lookup, not a check afterwards.
 */

export const SELLER_ORDERS_PAGE_SIZE = 12;

/** Waiting on the seller to accept or decline. */
export const AWAITING_SELLER = [SUB_ORDER_STATUS.PLACED];

/** Handed over and moving through the platform warehouse. */
export const IN_FULFILMENT = [
  SUB_ORDER_STATUS.CONFIRMED,
  SUB_ORDER_STATUS.WAREHOUSE_QUEUE,
  SUB_ORDER_STATUS.PICKING,
  SUB_ORDER_STATUS.PICKED,
  SUB_ORDER_STATUS.QC_PENDING,
  SUB_ORDER_STATUS.QC_PASSED,
  SUB_ORDER_STATUS.QC_FAILED,
  SUB_ORDER_STATUS.RETURNED_TO_WAREHOUSE,
  SUB_ORDER_STATUS.PACKING,
  SUB_ORDER_STATUS.READY_FOR_DISPATCH,
];

export const IN_TRANSIT = [
  SUB_ORDER_STATUS.DISPATCHED,
  SUB_ORDER_STATUS.IN_TRANSIT,
  SUB_ORDER_STATUS.OUT_FOR_DELIVERY,
];

export const CLOSED = [
  SUB_ORDER_STATUS.DELIVERED,
  SUB_ORDER_STATUS.CANCELLED,
  SUB_ORDER_STATUS.RETURN_REQUESTED,
  SUB_ORDER_STATUS.RETURNED,
];

export type SellerOrderFilter =
  | "all"
  | "awaiting"
  | "fulfilment"
  | "transit"
  | "closed";

const FILTER_STATUSES: Record<SellerOrderFilter, string[] | null> = {
  all: null,
  awaiting: AWAITING_SELLER,
  fulfilment: IN_FULFILMENT,
  transit: IN_TRANSIT,
  closed: CLOSED,
};

export async function listSellerOrders(
  sellerId: string,
  options: { filter?: SellerOrderFilter; q?: string; page?: number } = {},
) {
  const filter = options.filter ?? "all";
  const q = options.q?.trim();
  const statuses = FILTER_STATUSES[filter];

  const where = {
    sellerId,
    ...(statuses ? { status: { in: statuses } } : {}),
    ...(q
      ? {
          OR: [
            { subOrderNumber: { contains: q } },
            { order: { orderNumber: { contains: q } } },
            { items: { some: { productName: { contains: q } } } },
          ],
        }
      : {}),
  };

  const total = await prisma.subOrder.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / SELLER_ORDERS_PAGE_SIZE));
  const page = Math.min(Math.max(1, options.page ?? 1), pageCount);

  const orders = await prisma.subOrder.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * SELLER_ORDERS_PAGE_SIZE,
    take: SELLER_ORDERS_PAGE_SIZE,
    select: {
      id: true,
      subOrderNumber: true,
      status: true,
      subtotal: true,
      discountAmount: true,
      shippingAmount: true,
      totalAmount: true,
      createdAt: true,
      confirmedAt: true,
      deliveredAt: true,
      order: {
        select: {
          orderNumber: true,
          placedAt: true,
          shipCity: true,
          shipState: true,
          customer: { select: { user: { select: { fullName: true } } } },
        },
      },
      items: {
        select: {
          id: true,
          productName: true,
          productSku: true,
          imageUrl: true,
          quantity: true,
          unitPrice: true,
          lineTotal: true,
          priceTier: true,
        },
      },
    },
  });

  return { orders, total, page, pageCount, filter };
}

export async function sellerOrderCounts(sellerId: string) {
  const [all, awaiting, fulfilment, transit, closed] = await Promise.all([
    prisma.subOrder.count({ where: { sellerId } }),
    prisma.subOrder.count({
      where: { sellerId, status: { in: AWAITING_SELLER } },
    }),
    prisma.subOrder.count({
      where: { sellerId, status: { in: IN_FULFILMENT } },
    }),
    prisma.subOrder.count({ where: { sellerId, status: { in: IN_TRANSIT } } }),
    prisma.subOrder.count({ where: { sellerId, status: { in: CLOSED } } }),
  ]);

  return { all, awaiting, fulfilment, transit, closed };
}

/**
 * One sub-order in full, or null when it is not this seller's.
 *
 * The customer's contact details are deliberately narrow: name, city and state,
 * no phone number or full street address. The seller does not ship the parcel
 * under the platform-warehouse model, so they have no need for it, and handing
 * over a customer's address to every seller who ever sold them something is a
 * privacy leak with no operational purpose. The warehouse pick list (Phase 7)
 * carries the full address, because that is where it is actually used.
 */
export async function getSellerOrder(
  sellerId: string,
  subOrderNumber: string,
) {
  return prisma.subOrder.findFirst({
    where: { subOrderNumber, sellerId },
    select: {
      id: true,
      subOrderNumber: true,
      status: true,
      subtotal: true,
      discountAmount: true,
      shippingAmount: true,
      totalAmount: true,
      createdAt: true,
      confirmedAt: true,
      pickedAt: true,
      qcAt: true,
      packedAt: true,
      dispatchedAt: true,
      deliveredAt: true,
      order: {
        select: {
          id: true,
          orderNumber: true,
          placedAt: true,
          status: true,
          shipCity: true,
          shipState: true,
          shipPinCode: true,
          customer: {
            select: {
              customerType: true,
              user: { select: { fullName: true } },
            },
          },
          payments: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { method: true, status: true },
          },
        },
      },
      items: {
        select: {
          id: true,
          productId: true,
          productName: true,
          productSku: true,
          imageUrl: true,
          quantity: true,
          unitPrice: true,
          lineTotal: true,
          priceTier: true,
        },
      },
      shipment: {
        select: {
          courierName: true,
          trackingNumber: true,
          status: true,
          dispatchedAt: true,
          deliveredAt: true,
        },
      },
      settlement: {
        select: {
          grossAmount: true,
          commissionPercent: true,
          commissionAmount: true,
          netAmount: true,
          status: true,
          releasedAt: true,
        },
      },
      events: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          toStatus: true,
          actorRole: true,
          note: true,
          createdAt: true,
        },
      },
    },
  });
}

export type SellerOrder = NonNullable<
  Awaited<ReturnType<typeof getSellerOrder>>
>;
