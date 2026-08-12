import "server-only";
import { prisma } from "@/lib/prisma";
import { SUB_ORDER_STATUS as S } from "@/lib/constants";

/**
 * The operations queues — SRS §93-110.
 *
 * A queue is a *named set of statuses*, and that is the whole of a desk's
 * scoping. The seller panel scopes by `sellerId` because a sub-order belongs to
 * one seller; the operations desks scope by **where the parcel is in the
 * pipeline**, because under the platform-warehouse model every desk works on
 * every seller's goods. `src/lib/fulfilment/transition.ts` never sees either —
 * ownership and scope are a `where` clause at the call site, and this file is
 * that clause for all three panels.
 *
 * Each desk's queues are laid out the same way: the statuses waiting on *this*
 * desk to act, then the ones it has handed on. A queue that needs no action from
 * the desk reading it is marked `passive` and drawn without controls, because a
 * screen full of rows you cannot act on is how a real queue gets lost.
 */

export type OperationsQueue = {
  key: string;
  label: string;
  /** One line under the heading, saying what this queue actually is. */
  hint: string;
  statuses: string[];
  /** True when the desk is watching rather than working — no action expected. */
  passive?: boolean;
};

/**
 * The warehouse inbound queue is `CONFIRMED`, not something the seller pushed
 * here. Confirmation is the handover and it stops there deliberately (see the
 * note on `CONFIRMED` in the state machine): auto-advancing on the seller's
 * click would record the warehouse as having accepted something nobody here had
 * seen. Pulling work in is the first thing this desk does.
 */
export const WAREHOUSE_QUEUES: OperationsQueue[] = [
  {
    key: "inbound",
    label: "Inbound",
    hint: "Confirmed by the seller and waiting to be pulled into the warehouse.",
    statuses: [S.CONFIRMED],
  },
  {
    key: "picking",
    label: "Picking",
    hint: "On the floor — locate the stock, verify the quantity, hand it to quality control.",
    statuses: [S.WAREHOUSE_QUEUE, S.PICKING, S.PICKED, S.RETURNED_TO_WAREHOUSE],
  },
  {
    key: "packing",
    label: "Packing",
    hint: "Passed inspection. Pack, label and mark ready for the courier.",
    statuses: [S.QC_PASSED, S.PACKING],
  },
  {
    key: "waiting",
    label: "With another desk",
    hint: "The warehouse is done with these for now — quality control or logistics has them.",
    statuses: [S.QC_PENDING, S.READY_FOR_DISPATCH],
    passive: true,
  },
];

export const QC_QUEUES: OperationsQueue[] = [
  {
    key: "pending",
    label: "Awaiting inspection",
    hint: "Picked and handed over. Run the checklist and record a verdict.",
    statuses: [S.QC_PENDING],
  },
  {
    key: "failed",
    label: "Failed",
    hint: "Inspected and rejected. Send each one back to the warehouse to be re-picked.",
    statuses: [S.QC_FAILED],
  },
  {
    key: "repicking",
    label: "Being re-picked",
    hint: "Back with the warehouse after a failure. They will return here for re-inspection.",
    statuses: [S.RETURNED_TO_WAREHOUSE],
    passive: true,
  },
];

export const LOGISTICS_QUEUES: OperationsQueue[] = [
  {
    key: "dispatch",
    label: "Ready to dispatch",
    hint: "Packed and waiting for a courier. Assigning one creates the shipment and its tracking number.",
    statuses: [S.READY_FOR_DISPATCH],
  },
  {
    key: "transit",
    label: "In transit",
    hint: "With the courier. Move each parcel along as the network reports it.",
    statuses: [S.DISPATCHED, S.IN_TRANSIT],
  },
  {
    key: "delivery",
    label: "Out for delivery",
    hint: "On the van today. Confirm delivery, or record a failed attempt.",
    statuses: [S.OUT_FOR_DELIVERY],
  },
  {
    key: "delivered",
    label: "Delivered",
    hint: "Completed deliveries, most recent first.",
    statuses: [S.DELIVERED],
    passive: true,
  },
];

/**
 * The statuses in which the goods are physically on a Saawariya shelf.
 *
 * This is the scope of the warehouse's one stock write. A shortage or damage
 * report is only meaningful while the operator has the parcel in front of them;
 * outside these states the units are with QC, a courier or the customer, and
 * "we found three of these damaged" is somebody else's finding.
 */
export const WAREHOUSE_HELD: string[] = [
  S.WAREHOUSE_QUEUE,
  S.PICKING,
  S.PICKED,
  S.RETURNED_TO_WAREHOUSE,
  S.QC_PASSED,
  S.PACKING,
];

export function findQueue(
  queues: OperationsQueue[],
  key: string | undefined,
): OperationsQueue {
  return queues.find((queue) => queue.key === key) ?? queues[0];
}

// ---------------------------------------------------------------------------
// READING A QUEUE
// ---------------------------------------------------------------------------

export const QUEUE_PAGE_SIZE = 15;

/**
 * One row in any operations queue.
 *
 * The same projection for all three desks: they are all looking at the same
 * parcel from a different point in its journey, and three near-identical
 * selects is how the warehouse ends up unable to see the courier the logistics
 * desk assigned.
 */
const QUEUE_SELECT = {
  id: true,
  subOrderNumber: true,
  status: true,
  totalAmount: true,
  createdAt: true,
  confirmedAt: true,
  pickedAt: true,
  qcAt: true,
  packedAt: true,
  dispatchedAt: true,
  deliveredAt: true,
  seller: { select: { businessName: true } },
  order: {
    select: {
      orderNumber: true,
      placedAt: true,
      shipCity: true,
      shipState: true,
      shipPinCode: true,
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
    },
  },
  shipment: {
    select: { courierName: true, trackingNumber: true, status: true },
  },
  _count: { select: { qcInspections: true } },
} as const;

export type QueueRow = Awaited<ReturnType<typeof listQueue>>["rows"][number];

export async function listQueue(
  queue: OperationsQueue,
  options: { q?: string; page?: number } = {},
) {
  const q = options.q?.trim();

  const where = {
    status: { in: queue.statuses },
    ...(q
      ? {
          OR: [
            { subOrderNumber: { contains: q } },
            { order: { orderNumber: { contains: q } } },
            { items: { some: { productSku: { contains: q } } } },
            { items: { some: { productName: { contains: q } } } },
            { shipment: { trackingNumber: { contains: q } } },
          ],
        }
      : {}),
  };

  const total = await prisma.subOrder.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / QUEUE_PAGE_SIZE));
  const page = Math.min(Math.max(1, options.page ?? 1), pageCount);

  const rows = await prisma.subOrder.findMany({
    where,
    /**
     * Oldest first on the working queues — a warehouse queue sorted newest
     * first starves the parcel that has been waiting longest, which is exactly
     * the one a customer is chasing. The passive queues read as a log, so they
     * run the other way.
     */
    orderBy: queue.passive ? { updatedAt: "desc" } : { createdAt: "asc" },
    skip: (page - 1) * QUEUE_PAGE_SIZE,
    take: QUEUE_PAGE_SIZE,
    select: QUEUE_SELECT,
  });

  return { rows, total, page, pageCount };
}

/**
 * Counts for every queue on a desk, from one `groupBy` rather than one query
 * per tab. The tab bar is rendered on every page of the panel, so this runs
 * more often than anything else here.
 */
export async function queueCounts(
  queues: OperationsQueue[],
): Promise<Record<string, number>> {
  const rows = await prisma.subOrder.groupBy({
    by: ["status"],
    _count: { _all: true },
  });

  const byStatus = new Map(rows.map((row) => [row.status, row._count._all]));

  return Object.fromEntries(
    queues.map((queue) => [
      queue.key,
      queue.statuses.reduce(
        (sum, status) => sum + (byStatus.get(status) ?? 0),
        0,
      ),
    ]),
  );
}

// ---------------------------------------------------------------------------
// ONE SUB-ORDER, IN FULL
// ---------------------------------------------------------------------------

/**
 * The operations view of a single parcel.
 *
 * Unlike the seller's version this **carries the full delivery address**. That
 * is not an inconsistency: under the platform-warehouse model the warehouse is
 * what physically ships the parcel, so the address is the operational document
 * here and withholding it would make the pick list unusable. The seller, who
 * never touches the parcel, still sees only name, city, state and PIN.
 *
 * Every desk loads the same row. Which controls appear is decided by
 * `availableTransitions()` against the viewer's permissions, so a QC user
 * opening a dispatched parcel sees its record and no buttons — the honest
 * answer, and one no extra `where` clause is needed to produce.
 */
export async function getOperationsSubOrder(subOrderNumber: string) {
  return prisma.subOrder.findUnique({
    where: { subOrderNumber },
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
      seller: {
        select: {
          id: true,
          businessName: true,
          ownerName: true,
          city: true,
          state: true,
        },
      },
      order: {
        select: {
          id: true,
          orderNumber: true,
          placedAt: true,
          status: true,
          shipShippingName: true,
          shipMobile: true,
          shipLine1: true,
          shipLine2: true,
          shipCity: true,
          shipState: true,
          shipPinCode: true,
          shipCountry: true,
          customer: {
            select: {
              customerType: true,
              user: { select: { fullName: true } },
            },
          },
          payments: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { method: true, status: true, amount: true },
          },
        },
      },
      items: {
        select: {
          id: true,
          productId: true,
          /**
           * `variantId` is a plain column, not a relation — an OrderItem's
           * product may be delisted and its variants deleted, which is the
           * whole reason the line snapshots name, SKU and price. The pick list
           * resolves it against `product.variants` below and simply shows
           * nothing if that variant is gone, rather than failing to render an
           * order because a seller tidied their catalogue.
           */
          variantId: true,
          productName: true,
          productSku: true,
          imageUrl: true,
          quantity: true,
          unitPrice: true,
          lineTotal: true,
          priceTier: true,
          product: {
            select: {
              fabric: true,
              color: true,
              variants: { select: { id: true, name: true, value: true } },
              inventory: {
                select: { stockQty: true, reservedQty: true, status: true },
              },
            },
          },
        },
      },
      shipment: {
        select: {
          id: true,
          courierName: true,
          trackingNumber: true,
          status: true,
          failureReason: true,
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
      qcInspections: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          result: true,
          checklistJson: true,
          rejectionReason: true,
          notes: true,
          isReinspection: true,
          createdAt: true,
          inspector: { select: { fullName: true } },
        },
      },
      events: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
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

export type OperationsSubOrder = NonNullable<
  Awaited<ReturnType<typeof getOperationsSubOrder>>
>;
