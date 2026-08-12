import "server-only";
import { prisma } from "@/lib/prisma";
import { SHIPMENT_STATUS, SUB_ORDER_STATUS as S } from "@/lib/constants";

/**
 * Logistics reads — SRS §107-110.
 *
 * Two records move together here and it is worth being explicit about which is
 * which. `SubOrder.status` is where the *order* is; `Shipment.status` is where
 * the *parcel* is. They agree most of the time, and the one case where they
 * must not is a failed delivery attempt: the shipment goes DELIVERY_FAILED with
 * a reason, and the sub-order stays OUT_FOR_DELIVERY because the courier will
 * try again tomorrow. Inventing a sub-order state for it would tell the
 * customer their order had gone backwards, and would need a state-machine exit
 * that leads nowhere.
 */

/**
 * A tracking number derived from the sub-order it ships.
 *
 * `Shipment.subOrderId` is unique and `Shipment.trackingNumber` is unique, so
 * deriving one from the other makes the second constraint follow from the
 * first — there is no random suffix that could collide and no retry loop to get
 * wrong. Reassigning a courier rewrites the number on the same row, which is
 * the honest thing to do: it is a different carrier's consignment.
 */
export function trackingNumberFor(
  courierName: string,
  subOrderNumber: string,
): string {
  const code = courierName
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 3)
    .padEnd(3, "X");

  return `${code}${subOrderNumber.replace(/[^A-Z0-9]/gi, "").toUpperCase()}`;
}

export async function logisticsSummary() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [ready, inTransit, outForDelivery, deliveredToday, failed] =
    await Promise.all([
      prisma.subOrder.count({ where: { status: S.READY_FOR_DISPATCH } }),
      prisma.subOrder.count({
        where: { status: { in: [S.DISPATCHED, S.IN_TRANSIT] } },
      }),
      prisma.subOrder.count({ where: { status: S.OUT_FOR_DELIVERY } }),
      prisma.subOrder.count({
        where: { status: S.DELIVERED, deliveredAt: { gte: startOfToday } },
      }),
      prisma.shipment.count({
        where: { status: SHIPMENT_STATUS.DELIVERY_FAILED },
      }),
    ]);

  return { ready, inTransit, outForDelivery, deliveredToday, failed };
}

/**
 * Delivery performance — SRS §110.
 *
 * Grouped by courier because that is the only lever this desk has: the report
 * exists so someone can stop giving parcels to the carrier that loses them.
 * Transit time is measured dispatch → delivery on the shipment itself, not on
 * the sub-order, so a parcel that sat in the warehouse for three days does not
 * count against the courier that then delivered it in one.
 */
export async function deliveryReport(days = 90) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const shipments = await prisma.shipment.findMany({
    where: { createdAt: { gte: since } },
    select: {
      courierName: true,
      status: true,
      dispatchedAt: true,
      deliveredAt: true,
    },
  });

  const byCourier = new Map<
    string,
    {
      courier: string;
      shipments: number;
      delivered: number;
      failed: number;
      transitDays: number[];
    }
  >();

  for (const shipment of shipments) {
    const row = byCourier.get(shipment.courierName) ?? {
      courier: shipment.courierName,
      shipments: 0,
      delivered: 0,
      failed: 0,
      transitDays: [],
    };

    row.shipments += 1;
    if (shipment.status === SHIPMENT_STATUS.DELIVERED) row.delivered += 1;
    if (shipment.status === SHIPMENT_STATUS.DELIVERY_FAILED) row.failed += 1;

    if (shipment.dispatchedAt && shipment.deliveredAt) {
      row.transitDays.push(
        (shipment.deliveredAt.getTime() - shipment.dispatchedAt.getTime()) /
          86_400_000,
      );
    }

    byCourier.set(shipment.courierName, row);
  }

  const couriers = [...byCourier.values()]
    .map((row) => ({
      courier: row.courier,
      shipments: row.shipments,
      delivered: row.delivered,
      failed: row.failed,
      // Null rather than zero when nothing has completed: an average of no
      // journeys is not "instant", it is unknown, and a 0.0 in that column
      // would read as the best carrier on the page.
      avgTransitDays:
        row.transitDays.length === 0
          ? null
          : row.transitDays.reduce((sum, d) => sum + d, 0) /
            row.transitDays.length,
      deliveryRate:
        row.shipments === 0
          ? null
          : Math.round((row.delivered / row.shipments) * 100),
    }))
    .sort((a, b) => b.shipments - a.shipments);

  const delivered = couriers.reduce((sum, c) => sum + c.delivered, 0);
  const allTransit = [...byCourier.values()].flatMap((r) => r.transitDays);

  return {
    days,
    shipments: shipments.length,
    delivered,
    failed: couriers.reduce((sum, c) => sum + c.failed, 0),
    avgTransitDays:
      allTransit.length === 0
        ? null
        : allTransit.reduce((sum, d) => sum + d, 0) / allTransit.length,
    couriers,
  };
}

/** Every failed attempt still open, so the desk can chase them. */
export async function failedDeliveries() {
  return prisma.shipment.findMany({
    where: { status: SHIPMENT_STATUS.DELIVERY_FAILED },
    orderBy: { updatedAt: "desc" },
    take: 20,
    select: {
      id: true,
      courierName: true,
      trackingNumber: true,
      failureReason: true,
      updatedAt: true,
      subOrder: {
        select: {
          subOrderNumber: true,
          status: true,
          order: {
            select: {
              orderNumber: true,
              shipCity: true,
              shipState: true,
              shipShippingName: true,
            },
          },
        },
      },
    },
  });
}
