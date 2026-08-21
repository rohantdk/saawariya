import "server-only";
import { prisma } from "@/lib/prisma";
import { ORDER_STATUS, PAYMENT_STATUS, type OrderStatus } from "@/lib/constants";
import { CUSTOMER_CANCELLABLE, SUB_ORDER_TERMINAL } from "@/lib/commerce/order-status";
import { getCommerceSettings } from "@/lib/commerce/settings";
import { formatPaise } from "@/lib/utils";

/**
 * Customer-side order reads and the two state changes a customer can make:
 * cancelling an order and requesting a return.
 *
 * Every query here is scoped by `customerId`. An order is looked up by
 * `orderNumber`, which appears in URLs and is guessable — SAAW-2026-000042 is
 * one character away from someone else's order — so the customer id is part of
 * the `where`, never a check performed after fetching.
 */

export const ORDERS_PAGE_SIZE = 10;

// ---------------------------------------------------------------------------
// LISTS
// ---------------------------------------------------------------------------

export type OrderListFilter = "all" | "active" | "delivered" | "cancelled";

const FILTER_WHERE: Record<OrderListFilter, { status?: object }> = {
  all: {},
  active: {
    status: {
      in: [
        ORDER_STATUS.PENDING,
        ORDER_STATUS.CONFIRMED,
        ORDER_STATUS.PROCESSING,
        ORDER_STATUS.PARTIALLY_SHIPPED,
        ORDER_STATUS.SHIPPED,
      ],
    },
  },
  delivered: { status: { in: [ORDER_STATUS.DELIVERED] } },
  cancelled: {
    status: { in: [ORDER_STATUS.CANCELLED, ORDER_STATUS.RETURNED] },
  },
};

export async function listCustomerOrders(
  customerId: string,
  options: { filter?: OrderListFilter; page?: number } = {},
) {
  const filter = options.filter ?? "all";
  const where = { customerId, ...FILTER_WHERE[filter] };

  const total = await prisma.order.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / ORDERS_PAGE_SIZE));
  const page = Math.min(Math.max(1, options.page ?? 1), pageCount);

  const orders = await prisma.order.findMany({
    where,
    orderBy: { placedAt: "desc" },
    skip: (page - 1) * ORDERS_PAGE_SIZE,
    take: ORDERS_PAGE_SIZE,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      totalAmount: true,
      placedAt: true,
      subOrders: {
        select: {
          id: true,
          status: true,
          seller: { select: { businessName: true } },
          items: {
            select: {
              id: true,
              productName: true,
              imageUrl: true,
              quantity: true,
            },
          },
        },
      },
      payments: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { method: true, status: true },
      },
    },
  });

  return { orders, total, page, pageCount, filter };
}

export type CustomerOrderListItem = Awaited<
  ReturnType<typeof listCustomerOrders>
>["orders"][number];

/** Counts behind the filter tabs, so an empty tab is visibly empty. */
export async function getOrderFilterCounts(customerId: string) {
  const entries = await Promise.all(
    (Object.keys(FILTER_WHERE) as OrderListFilter[]).map(async (filter) => {
      const count = await prisma.order.count({
        where: { customerId, ...FILTER_WHERE[filter] },
      });
      return [filter, count] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<OrderListFilter, number>;
}

// ---------------------------------------------------------------------------
// DETAIL
// ---------------------------------------------------------------------------

export async function getCustomerOrder(
  customerId: string,
  orderNumber: string,
) {
  return prisma.order.findFirst({
    // customerId in the where, not a check afterwards — see the file note.
    where: { orderNumber, customerId },
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
      shipShippingName: true,
      shipMobile: true,
      shipLine1: true,
      shipLine2: true,
      shipCity: true,
      shipState: true,
      shipPinCode: true,
      shipCountry: true,
      billingSameAsShip: true,
      billingJson: true,
      placedAt: true,
      cancelledAt: true,
      cancelReason: true,
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
            select: { id: true, businessName: true, city: true, state: true },
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
              loomWeeks: true,
              product: { select: { slug: true, status: true } },
            },
          },
          shipment: {
            select: {
              courierName: true,
              trackingNumber: true,
              status: true,
              dispatchedAt: true,
              deliveredAt: true,
              events: {
                orderBy: { createdAt: "desc" },
                select: {
                  id: true,
                  status: true,
                  location: true,
                  note: true,
                  createdAt: true,
                },
              },
            },
          },
          returnRequest: {
            select: {
              status: true,
              reason: true,
              resolution: true,
              requestedAt: true,
            },
          },
          events: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              toStatus: true,
              note: true,
              actorRole: true,
              createdAt: true,
            },
          },
        },
      },
      payments: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          method: true,
          amount: true,
          status: true,
          gatewayRef: true,
          paidAt: true,
          createdAt: true,
          refunds: {
            select: {
              id: true,
              amount: true,
              status: true,
              reason: true,
              requestedAt: true,
              processedAt: true,
            },
          },
        },
      },
      events: {
        where: { subOrderId: null },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          toStatus: true,
          note: true,
          actorRole: true,
          createdAt: true,
        },
      },
    },
  });
}

export type CustomerOrder = NonNullable<
  Awaited<ReturnType<typeof getCustomerOrder>>
>;

export function canCancel(order: { status: string }): boolean {
  return CUSTOMER_CANCELLABLE.includes(order.status as OrderStatus);
}

/**
 * Whether a delivered sub-order is still inside the return window.
 * The window is a platform setting (SRS §111), so a policy change moves it
 * everywhere rather than in this one function.
 */
export async function returnEligibility(subOrder: {
  status: string;
  deliveredAt: Date | null;
  returnRequest: unknown;
}): Promise<{ eligible: boolean; reason: string | null; closesOn: Date | null }> {
  const settings = await getCommerceSettings();

  if (!settings.returnsEnabled) {
    return { eligible: false, reason: null, closesOn: null };
  }
  if (subOrder.returnRequest) {
    return {
      eligible: false,
      reason: "A return has already been requested for this parcel.",
      closesOn: null,
    };
  }
  if (subOrder.status !== "DELIVERED" || !subOrder.deliveredAt) {
    return {
      eligible: false,
      reason: "Returns open once the parcel has been delivered.",
      closesOn: null,
    };
  }

  const closesOn = new Date(subOrder.deliveredAt);
  closesOn.setDate(closesOn.getDate() + settings.returnWindowDays);

  if (closesOn < new Date()) {
    return {
      eligible: false,
      reason: `The ${settings.returnWindowDays}-day return window has closed.`,
      closesOn,
    };
  }

  return { eligible: true, reason: null, closesOn };
}

// ---------------------------------------------------------------------------
// CANCEL
// ---------------------------------------------------------------------------

/**
 * Cancelling releases everything the order was holding.
 *
 * The reservation has to come back or the stock is lost until someone notices —
 * `reservedQty` only ever falls when an order is dispatched or cancelled, and a
 * cancellation that forgets it slowly makes the catalogue look sold out.
 */
export async function cancelOrder(input: {
  userId: string;
  customerId: string;
  orderNumber: string;
  reason: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const order = await prisma.order.findFirst({
    where: { orderNumber: input.orderNumber, customerId: input.customerId },
    select: {
      id: true,
      status: true,
      totalAmount: true,
      orderNumber: true,
      couponCode: true,
      subOrders: {
        select: {
          id: true,
          status: true,
          sellerId: true,
          subOrderNumber: true,
          items: { select: { productId: true, quantity: true } },
        },
      },
      payments: {
        where: { status: PAYMENT_STATUS.SUCCESS },
        select: { id: true, amount: true },
      },
    },
  });

  if (!order) return { ok: false, error: "Order not found." };
  if (!canCancel(order)) {
    return {
      ok: false,
      error:
        "This order has already been dispatched and can no longer be cancelled. You can request a return once it arrives.",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: {
        status: ORDER_STATUS.CANCELLED,
        cancelledAt: new Date(),
        cancelReason: input.reason,
      },
    });

    for (const subOrder of order.subOrders) {
      if (SUB_ORDER_TERMINAL.includes(subOrder.status)) continue;

      await tx.subOrder.update({
        where: { id: subOrder.id },
        data: { status: "CANCELLED" },
      });

      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          subOrderId: subOrder.id,
          fromStatus: subOrder.status,
          toStatus: "CANCELLED",
          actorUserId: input.userId,
          actorRole: "CUSTOMER",
          note: input.reason,
        },
      });

      // Release the stock this parcel was holding.
      for (const item of subOrder.items) {
        const inventory = await tx.inventory.findUnique({
          where: { productId: item.productId },
          select: { id: true, reservedQty: true },
        });
        if (!inventory) continue;

        await tx.inventory.update({
          where: { id: inventory.id },
          data: {
            // Clamp at zero: a negative reservation would be worse than the
            // inconsistency it came from, and it would corrupt availability
            // for every other customer.
            reservedQty: Math.max(0, inventory.reservedQty - item.quantity),
          },
        });

        await tx.stockMovement.create({
          data: {
            inventoryId: inventory.id,
            changeQty: 0,
            // ORDER_CANCELLED, not ADJUSTMENT: the seller decline path in
            // src/app/actions/seller-orders.ts releases stock for the same
            // reason, and two different codes for one event make the ledger
            // impossible to read back.
            reason: "ORDER_CANCELLED",
            referenceId: subOrder.id,
            note: `${item.quantity} released — ${subOrder.subOrderNumber} cancelled`,
          },
        });
      }

      const seller = await tx.seller.findUnique({
        where: { id: subOrder.sellerId },
        select: { userId: true },
      });
      if (seller) {
        await tx.notification.create({
          data: {
            userId: seller.userId,
            title: `Order ${subOrder.subOrderNumber} cancelled`,
            body: `The customer cancelled this order. Reason: ${input.reason}`,
            category: "ORDER",
            linkUrl: `/seller/orders/${subOrder.subOrderNumber}`,
          },
        });
      }
    }

    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        fromStatus: order.status,
        toStatus: ORDER_STATUS.CANCELLED,
        actorUserId: input.userId,
        actorRole: "CUSTOMER",
        note: input.reason,
      },
    });

    // A captured payment becomes a refund request for Finance (SRS §121).
    // It is deliberately not auto-approved: money leaving the platform is a
    // finance decision, and the refund queue is a real screen in Phase 8.
    for (const payment of order.payments) {
      await tx.refund.create({
        data: {
          paymentId: payment.id,
          amount: payment.amount,
          reason: "ORDER_CANCELLED",
          status: "PENDING",
        },
      });
    }

    // Give the customer their coupon use back.
    if (order.couponCode) {
      await tx.coupon.updateMany({
        where: { code: order.couponCode, usageCount: { gt: 0 } },
        data: { usageCount: { decrement: 1 } },
      });
    }

    await tx.notification.create({
      data: {
        userId: input.userId,
        title: `Order ${order.orderNumber} cancelled`,
        body: order.payments.length
          ? `Your order has been cancelled. A refund of ${formatPaise(order.totalAmount)} has been raised and will be processed to your original payment method.`
          : "Your order has been cancelled. Nothing was charged.",
        category: "ORDER",
        linkUrl: `/account/orders/${order.orderNumber}`,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: input.userId,
        action: "ORDER_CANCELLED",
        entityType: "Order",
        entityId: order.id,
        summary: `Order ${order.orderNumber} cancelled by customer — ${input.reason}`,
      },
    });
  });

  return { ok: true };
}

// ---------------------------------------------------------------------------
// RETURNS
// ---------------------------------------------------------------------------

export async function requestReturn(input: {
  userId: string;
  customerId: string;
  subOrderNumber: string;
  reason: string;
  detail: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const subOrder = await prisma.subOrder.findFirst({
    where: {
      subOrderNumber: input.subOrderNumber,
      order: { customerId: input.customerId },
    },
    select: {
      id: true,
      status: true,
      deliveredAt: true,
      sellerId: true,
      subOrderNumber: true,
      orderId: true,
      order: { select: { orderNumber: true } },
      returnRequest: { select: { id: true } },
    },
  });

  if (!subOrder) return { ok: false, error: "Parcel not found." };

  const eligibility = await returnEligibility(subOrder);
  if (!eligibility.eligible) {
    return {
      ok: false,
      error: eligibility.reason ?? "Returns are not available at the moment.",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.returnRequest.create({
      data: {
        subOrderId: subOrder.id,
        reason: input.reason,
        detail: input.detail,
        status: "REQUESTED",
      },
    });

    await tx.subOrder.update({
      where: { id: subOrder.id },
      data: { status: "RETURN_REQUESTED" },
    });

    await tx.orderEvent.create({
      data: {
        orderId: subOrder.orderId,
        subOrderId: subOrder.id,
        fromStatus: subOrder.status,
        toStatus: "RETURN_REQUESTED",
        actorUserId: input.userId,
        actorRole: "CUSTOMER",
        note: input.reason,
      },
    });

    await tx.notification.create({
      data: {
        userId: input.userId,
        title: `Return requested for ${subOrder.subOrderNumber}`,
        body: "We have received your return request. Our team will review it and arrange a pickup.",
        category: "ORDER",
        linkUrl: `/account/orders/${subOrder.order.orderNumber}`,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: input.userId,
        action: "RETURN_REQUESTED",
        entityType: "SubOrder",
        entityId: subOrder.id,
        summary: `Return requested for ${subOrder.subOrderNumber} — ${input.reason}`,
      },
    });
  });

  return { ok: true };
}

// ---------------------------------------------------------------------------
// DASHBOARD
// ---------------------------------------------------------------------------

export async function getAccountSummary(customerId: string, userId: string) {
  const [
    totalOrders,
    activeOrders,
    deliveredOrders,
    wishlistCount,
    cartCount,
    unreadNotifications,
    openTickets,
    spend,
  ] = await Promise.all([
    prisma.order.count({ where: { customerId } }),
    prisma.order.count({ where: { customerId, ...FILTER_WHERE.active } }),
    prisma.order.count({ where: { customerId, ...FILTER_WHERE.delivered } }),
    prisma.wishlistItem.count({ where: { customerId } }),
    prisma.cartItem.count({ where: { customerId } }),
    prisma.notification.count({ where: { userId, isRead: false } }),
    prisma.supportTicket.count({
      where: {
        raisedById: userId,
        status: { notIn: ["RESOLVED", "CLOSED"] },
      },
    }),
    prisma.order.aggregate({
      where: { customerId, status: { not: ORDER_STATUS.CANCELLED } },
      _sum: { totalAmount: true },
    }),
  ]);

  return {
    totalOrders,
    activeOrders,
    deliveredOrders,
    wishlistCount,
    cartCount,
    unreadNotifications,
    openTickets,
    lifetimeSpendPaise: spend._sum.totalAmount ?? 0,
  };
}

/**
 * Products this customer has actually received and has not yet reviewed.
 *
 * Reviews are keyed unique on (productId, userId), so the list has to exclude
 * anything already written or the form would fail on submit — and "delivered"
 * is what makes a review a verified purchase rather than an opinion.
 */
export async function getReviewableItems(customerId: string, userId: string) {
  const items = await prisma.orderItem.findMany({
    where: {
      subOrder: {
        status: "DELIVERED",
        order: { customerId },
      },
    },
    orderBy: { subOrder: { deliveredAt: "desc" } },
    select: {
      id: true,
      productId: true,
      productName: true,
      imageUrl: true,
      subOrder: {
        select: { deliveredAt: true, order: { select: { orderNumber: true } } },
      },
      product: { select: { slug: true, status: true } },
    },
  });

  const reviewed = new Set(
    (
      await prisma.review.findMany({
        where: { userId },
        select: { productId: true },
      })
    ).map((review) => review.productId),
  );

  // One product can arrive in several orders; only offer it once.
  const seen = new Set<string>();
  return items.filter((item) => {
    if (reviewed.has(item.productId) || seen.has(item.productId)) return false;
    seen.add(item.productId);
    return true;
  });
}

/** Reviews this customer has written, with their moderation state. */
export async function getCustomerReviews(userId: string) {
  return prisma.review.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      rating: true,
      title: true,
      body: true,
      status: true,
      createdAt: true,
      product: {
        select: { name: true, slug: true, status: true, images: { where: { isMain: true }, take: 1, select: { url: true } } },
      },
    },
  });
}
