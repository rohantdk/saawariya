import type { PrismaClient } from "../../src/generated/prisma/client";
// The real pricing resolver, not a copy — seeded orders have to be priced by
// the same rule the storefront would have applied, or the demo data contradicts
// the software that produced it. (pricing.ts is pure; nothing server-only.)
import { resolvePrice } from "../../src/lib/catalogue/pricing";
import { deriveOrderStatus } from "../../src/lib/fulfilment/order-rollup";
import {
  COURIERS,
  FLAT_SHIPPING_PAISE,
  FREE_SHIPPING_THRESHOLD_PAISE,
  GST_PERCENT,
  PRICE_TIER,
  QC_CHECKLIST,
  SOLD_SUB_ORDER_STATUSES,
} from "../../src/lib/constants";

/**
 * Seeded order history.
 *
 * The customer panel, the seller order queue, the operations pipeline and every
 * finance report read from Order/SubOrder. With none of them the screens are
 * technically working and impossible to evaluate — the same reason the Phase 2
 * approval queues were seeded non-empty.
 *
 * Three properties this seed is written to hold, all checked by
 * prisma/seed-check.ts:
 *
 *  1. **Idempotent.** Every seeded order is deleted and rebuilt on each run, so
 *     seeding twice leaves the database identical to seeding once.
 *
 *  2. **Money reconciles.** Every order satisfies
 *     `SUM(subOrder.subtotal - discount + shipping) === order.totalAmount`, and
 *     every sub-order total is the sum of its lines. Integer paise throughout.
 *
 *  3. **Stock reservations are derived, never accumulated.** `reservedQty` is
 *     recomputed at the end from the sub-orders that are actually live. Adding
 *     to it per run is how a re-seeded database ends up with a catalogue that
 *     claims to be sold out.
 *
 *  4. **`salesCount` is derived as well.** It used to be merchandising data
 *     typed into the product seed — one saree claimed 207 units against a
 *     database of 39 sub-orders — which the storefront's "Best selling" sort
 *     and both panels' "Units sold" figures reported as fact. It is now
 *     recomputed here from the lines that actually reached a customer.
 */

type OrderPlan = {
  /** Which customer, by the email the user seed created. */
  customerEmail: string;
  daysAgo: number;
  status:
    | "PENDING"
    | "CONFIRMED"
    | "PROCESSING"
    | "PARTIALLY_SHIPPED"
    | "SHIPPED"
    | "DELIVERED"
    | "CANCELLED";
  paymentMethod: "UPI" | "CREDIT_CARD" | "NET_BANKING" | "COD" | "WALLET";
  couponCode?: string;
  cancelReason?: string;
  /** SKUs and quantities. Products are looked up by SKU so this stays readable. */
  lines: { sku: string; quantity: number }[];
  /** Per sub-order pipeline state, in the order the sellers come out. */
  subOrderStatuses?: string[];

  // --- Phase 8: the finance and support desks need every queue non-empty ----
  //
  // Same lesson as Phase 5 (no PLACED sub-orders, so the seller's primary queue
  // was empty) and Phase 7 (seven of eight operations queues were empty). A desk
  // whose queue is empty cannot be evaluated, and the seed is where that is
  // fixed rather than in the panel.

  /**
   * Overrides the settlement state for this order's delivered sub-orders. The
   * default is age-based; this is how UNDER_REVIEW and FAILED payouts exist at
   * all, since nothing in the happy path produces them.
   */
  settlementStatus?: "PENDING" | "UNDER_REVIEW" | "RELEASED" | "FAILED";
  settlementNote?: string;
  /** Overrides the refund state raised by a cancellation. */
  refundStatus?: "PENDING" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "PROCESSED";
  refundNote?: string;
  /** Marks the payment FAILED with this reason — the transaction log needs one. */
  paymentFailure?: string;
  /** A return against the sub-order at this index. */
  returnRequest?: {
    index: number;
    reason: string;
    detail?: string;
    status: string;
    reviewNote?: string;
  };
};

export async function seedOrders(prisma: PrismaClient) {
  // ---- Wipe previously seeded orders -------------------------------------
  // Cascades take SubOrder, OrderItem, OrderEvent, Payment, Shipment,
  // ShipmentEvent, QcInspection and ReturnRequest with them; Refund cascades
  // from Payment.
  await prisma.order.deleteMany({});

  /**
   * `Notification` does **not** cascade — it hangs off `User`, not `Order` — so
   * it has to be cleared by hand, and until Phase 7 it was not. Every re-seed
   * added another 54 rows about orders that had just been deleted: 453, 510,
   * 567. The "seed twice → identical counts" check missed it for four phases
   * because the seed only ever printed the counts it *rebuilt*, and this was the
   * one table it wrote without owning. The count is now printed for that reason.
   *
   * Scoped to the ORDER category, which is exactly what this module creates —
   * both the customer's and the seller's. Notifications in other categories
   * belong to other seed modules or to runtime, and deleting a table this
   * module does not own is how a seed starts destroying someone's data.
   */
  await prisma.notification.deleteMany({
    /**
     * All three categories belong to this module. `SETTLEMENT` and `PAYMENT`
     * were added in Phase 8: settlements and refunds cascade from the orders
     * deleted above, so a re-seed was leaving a seller told "payout released"
     * about a settlement row that no longer exists, and a customer told their
     * refund had been sent for an order that had been rebuilt. Those rows are
     * written at runtime rather than by the seed, so they never broke the
     * "seed twice → identical counts" check — they simply outlived what they
     * described.
     */
    where: { category: { in: ["ORDER", "SETTLEMENT", "PAYMENT"] } },
  });

  const [customers, products] = await Promise.all([
    prisma.customer.findMany({
      select: {
        id: true,
        customerType: true,
        userId: true,
        user: { select: { email: true, fullName: true } },
      },
    }),
    prisma.product.findMany({
      where: { status: "APPROVED" },
      select: {
        id: true,
        sku: true,
        name: true,
        sellerId: true,
        priceRetail: true,
        priceOffer: true,
        priceWholesale: true,
        minOrderQty: true,
        isMadeToOrder: true,
        loomWeeks: true,
        images: {
          where: { isMain: true },
          take: 1,
          select: { url: true },
        },
        variants: {
          orderBy: { sku: "asc" },
          take: 1,
          select: { id: true, name: true, value: true, priceDeltaPaise: true },
        },
        seller: { select: { id: true, userId: true, businessName: true } },
      },
    }),
  ]);

  const byEmail = new Map(customers.map((c) => [c.user.email, c]));
  const bySku = new Map(products.map((p) => [p.sku, p]));

  // Sub-orders carry a seller id; notifications need that seller's *user* and
  // settlements need their commission rate. Both are resolved once here rather
  // than re-queried inside the per-sub-order loop.
  const sellerUserById = new Map(
    products.map((p) => [p.seller.id, p.seller.userId]),
  );
  const commissionBySeller = new Map(
    await prisma.seller
      .findMany({ select: { id: true, commissionPercent: true } })
      .then((rows) => rows.map((r) => [r.id, r.commissionPercent] as const)),
  );

  const addresses = await prisma.address.findMany({
    where: { userId: { in: customers.map((c) => c.userId) } },
    orderBy: { createdAt: "asc" },
  });
  const addressByUser = new Map(addresses.map((a) => [a.userId, a]));

  // Inspections need an inspector. If the QC demo account is missing — a
  // partially seeded database — the inspections are skipped rather than the
  // whole order seed failing on a foreign key.
  const inspector = await prisma.user.findUnique({
    where: { email: "qc@saawariya.test" },
    select: { id: true },
  });
  const inspectorId = inspector?.id ?? null;

  const plans = buildPlans(
    products.map((p) => ({ sku: p.sku, sellerName: p.seller.businessName })),
  );

  let sequence = 0;
  let created = 0;
  let qcSequence = 0;

  for (const plan of plans) {
    const customer = byEmail.get(plan.customerEmail);
    if (!customer) continue;

    const address = addressByUser.get(customer.userId);
    if (!address) continue;

    const lines = plan.lines
      .map((line) => ({
        product: bySku.get(line.sku),
        quantity: line.quantity,
      }))
      .filter(
        (
          line,
        ): line is { product: (typeof products)[number]; quantity: number } =>
          Boolean(line.product),
      );

    if (lines.length === 0) continue;

    const isWholesale = customer.customerType === "WHOLESALE";
    const placedAt = daysBefore(plan.daysAgo);

    // ---- Money ----------------------------------------------------------
    const priced = lines.map((line) => {
      const variant = line.product.variants[0] ?? null;
      const delta = variant?.priceDeltaPaise ?? 0;

      const price = resolvePrice(
        {
          priceRetail: line.product.priceRetail + delta,
          priceOffer:
            line.product.priceOffer === null
              ? null
              : line.product.priceOffer + delta,
          priceWholesale:
            line.product.priceWholesale === null
              ? null
              : line.product.priceWholesale + delta,
          minOrderQty: line.product.minOrderQty,
        },
        isWholesale ? PRICE_TIER.WHOLESALE : PRICE_TIER.RETAIL,
      );

      // Wholesale lines must respect the MOQ the resolver reports, or the seed
      // would contain an order the storefront itself would have refused.
      const quantity = Math.max(line.quantity, price.minOrderQty);

      return {
        product: line.product,
        variant,
        quantity,
        unitPrice: price.amount,
        lineTotal: price.amount * quantity,
        priceTier: price.tier,
      };
    });

    const subtotal = priced.reduce((sum, line) => sum + line.lineTotal, 0);
    const discountAmount = plan.couponCode
      ? await discountFor(prisma, plan.couponCode, subtotal)
      : 0;
    const goods = subtotal - discountAmount;
    const shippingAmount =
      goods >= FREE_SHIPPING_THRESHOLD_PAISE ? 0 : FLAT_SHIPPING_PAISE;
    // Prices include GST (Setting tax.prices_include_gst), so tax is extracted
    // from the amount charged rather than added to it.
    const taxAmount = Math.round((goods * GST_PERCENT) / (100 + GST_PERCENT));
    const totalAmount = goods + shippingAmount;

    // ---- Group by seller -> sub-orders ----------------------------------
    const groups = new Map<string, typeof priced>();
    for (const line of priced) {
      const list = groups.get(line.product.sellerId) ?? [];
      list.push(line);
      groups.set(line.product.sellerId, list);
    }

    const groupList = [...groups.entries()];
    const weights = groupList.map(([, list]) =>
      list.reduce((sum, line) => sum + line.lineTotal, 0),
    );
    const shippingSplit = apportion(shippingAmount, weights);
    const discountSplit = apportion(discountAmount, weights);

    /**
     * The sub-order states first, then the order's status **derived from them**
     * with the same function the running software uses.
     *
     * `plan.status` stays the author's intent — it drives the default pipeline
     * state, the payment status and the notification wording — but it is no
     * longer written to the database as-is. It could disagree with its own
     * parts: a plan saying CONFIRMED produced sub-orders the roll-up rule calls
     * PROCESSING, and `deriveOrderStatus` cannot return CONFIRMED at all, so
     * the seed contained orders in a status the software never produces.
     */
    const groupStatuses = groupList.map((_, index) =>
      plan.status === "CANCELLED"
        ? "CANCELLED"
        : (plan.subOrderStatuses?.[index] ??
          defaultSubOrderStatus(plan.status)),
    );
    const orderStatus = deriveOrderStatus(groupStatuses);

    sequence += 1;
    const orderNumber = `SAAW-${placedAt.getFullYear()}-${String(sequence).padStart(6, "0")}`;

    const order = await prisma.order.create({
      data: {
        orderNumber,
        customerId: customer.id,
        status: orderStatus,
        subtotal,
        discountAmount,
        shippingAmount,
        taxAmount,
        totalAmount,
        /**
         * The code is recorded only when it actually took money off.
         *
         * `Order.couponCode` means "this coupon was applied", and checkout
         * cannot apply one that gives nothing — `validateCoupon` refuses a code
         * below its minimum order value with a shortfall message, which Phase 4
         * verified in the browser. A seeded order carrying a code with a zero
         * discount is therefore a state the running software cannot produce, and
         * Phase 8's coupon performance screen is what surfaced it: BULK20 showed
         * one redemption and ₹0 given away.
         */
        couponCode: discountAmount > 0 ? (plan.couponCode ?? null) : null,
        shipShippingName: address.fullName,
        shipMobile: address.mobile,
        shipLine1: address.line1,
        shipLine2: address.line2,
        shipCity: address.city,
        shipState: address.state,
        shipPinCode: address.pinCode,
        shipCountry: address.country,
        billingSameAsShip: true,
        placedAt,
        cancelledAt:
          plan.status === "CANCELLED" ? daysBefore(plan.daysAgo - 1) : null,
        cancelReason: plan.cancelReason ?? null,
      },
    });

    await prisma.orderEvent.create({
      data: {
        orderId: order.id,
        // A PENDING order has not been accepted by any seller yet, so claiming
        // it was "confirmed" would contradict its own sub-orders sitting at
        // PLACED — and the customer tracking page reads this trail.
        toStatus: plan.status === "PENDING" ? "PLACED" : "CONFIRMED",
        actorUserId: customer.userId,
        actorRole: "CUSTOMER",
        note:
          plan.status === "PENDING"
            ? "Order placed. Waiting for the seller to confirm."
            : plan.paymentMethod === "COD"
              ? "Order confirmed. Payment due on delivery."
              : "Order confirmed. Payment received.",
        createdAt: placedAt,
      },
    });

    for (const [index, [sellerId, list]] of groupList.entries()) {
      const groupSubtotal = weights[index];
      const sellerUserId = sellerUserById.get(sellerId);
      const status = groupStatuses[index];

      const timeline = timelineFor(status, placedAt);

      const subOrder = await prisma.subOrder.create({
        data: {
          subOrderNumber: `${orderNumber}-${String.fromCharCode(65 + index)}`,
          orderId: order.id,
          sellerId,
          status,
          subtotal: groupSubtotal,
          discountAmount: discountSplit[index],
          shippingAmount: shippingSplit[index],
          totalAmount:
            groupSubtotal - discountSplit[index] + shippingSplit[index],
          confirmedAt: timeline.confirmedAt,
          pickedAt: timeline.pickedAt,
          qcAt: timeline.qcAt,
          packedAt: timeline.packedAt,
          dispatchedAt: timeline.dispatchedAt,
          deliveredAt: timeline.deliveredAt,
          createdAt: placedAt,
          items: {
            create: list.map((line) => ({
              productId: line.product.id,
              variantId: line.variant?.id ?? null,
              productName: line.product.name,
              productSku: line.product.sku,
              imageUrl: line.product.images[0]?.url ?? null,
              unitPrice: line.unitPrice,
              priceTier: line.priceTier,
              quantity: line.quantity,
              lineTotal: line.lineTotal,
              // Snapshot, exactly as place-order does it, so a seeded order and
              // a placed one carry the same shape. Null for stocked lines.
              loomWeeks: line.product.isMadeToOrder
                ? line.product.loomWeeks
                : null,
            })),
          },
        },
      });

      // Event trail — one row per state the parcel has actually passed through,
      // so the customer tracking page and the ops reports read real history
      // rather than a status with no story behind it.
      for (const step of eventTrailFor(status, placedAt)) {
        await prisma.orderEvent.create({
          data: {
            orderId: order.id,
            subOrderId: subOrder.id,
            toStatus: step.status,
            actorRole: step.role,
            note: step.note,
            createdAt: step.at,
          },
        });
      }

      /**
       * Tell the seller, exactly as `place-order.ts` does at runtime. Without
       * this the seller notification screen is empty on a fresh database while
       * the customer's is full, which looks like a broken panel rather than a
       * quiet one. A PLACED parcel is a call to action and stays unread; older
       * ones are already read.
       */
      const needsSellerAction = status === "PLACED";
      if (sellerUserId) {
        await prisma.notification.create({
          data: {
            userId: sellerUserId,
            title: needsSellerAction
              ? `New order ${subOrder.subOrderNumber}`
              : `Order ${subOrder.subOrderNumber} ${status === "CANCELLED" ? "cancelled" : status === "DELIVERED" ? "delivered" : "updated"}`,
            body: needsSellerAction
              ? "A customer has placed an order with you. Confirm it to release stock to the warehouse."
              : status === "CANCELLED"
                ? "This order was cancelled. Any reserved stock has been released."
                : status === "DELIVERED"
                  ? "This order reached the customer. The settlement will follow in your next payout."
                  : "This order is being fulfilled by the Saawariya warehouse.",
            category: "ORDER",
            linkUrl: `/seller/orders/${subOrder.subOrderNumber}`,
            isRead: !needsSellerAction && plan.daysAgo > 10,
            readAt:
              !needsSellerAction && plan.daysAgo > 10
                ? daysBefore(plan.daysAgo - 1)
                : null,
            createdAt: placedAt,
          },
        });
      }

      /**
       * A delivered parcel owes the seller money — SRS §119, §120.
       *
       * Commission is charged on `subtotal`, the seller's GROSS line value
       * before any platform coupon, so a Saawariya promotion is not quietly
       * funded out of the seller's payout. That is the whole reason
       * `SubOrder.discountAmount` is its own column.
       *
       * The oldest settlements are already RELEASED and the recent ones still
       * PENDING, so both the seller payout screen and the Phase 8 finance
       * release queue have real rows to work with.
       */
      if (status === "DELIVERED") {
        const commissionPercent = commissionBySeller.get(sellerId) ?? 10;
        const commissionAmount = Math.round(
          (groupSubtotal * commissionPercent) / 100,
        );

        /**
         * `UNDER_REVIEW` and `FAILED` cannot arise from the happy path — a
         * payout is only held or bounced by a person — so a seed without an
         * override would leave two of the four tabs on the finance payout queue
         * permanently empty. Same reasoning as the operations states in Phase 7.
         */
        const settlementStatus =
          plan.settlementStatus ?? (plan.daysAgo > 30 ? "RELEASED" : "PENDING");
        const released = settlementStatus === "RELEASED";

        await prisma.settlement.create({
          data: {
            sellerId,
            subOrderId: subOrder.id,
            grossAmount: groupSubtotal,
            commissionPercent,
            commissionAmount,
            netAmount: groupSubtotal - commissionAmount,
            status: settlementStatus,
            reference: released ? `PAYOUT-${orderNumber}-${index}` : null,
            note: plan.settlementNote ?? null,
            createdAt: timeline.deliveredAt ?? placedAt,
            releasedAt: released ? daysBefore(Math.max(plan.daysAgo - 6, 0)) : null,
          },
        });
      }

      // ---- Return request, if this sub-order has one ----------------------
      if (plan.returnRequest && plan.returnRequest.index === index) {
        const request = plan.returnRequest;
        const settled = ["REJECTED", "REFUNDED", "REPLACED"].includes(
          request.status,
        );

        await prisma.returnRequest.create({
          data: {
            subOrderId: subOrder.id,
            reason: request.reason,
            detail: request.detail ?? null,
            status: request.status,
            resolution: request.status === "REFUNDED" ? "REFUND" : null,
            reviewNote: request.reviewNote ?? null,
            requestedAt: daysBefore(Math.max(plan.daysAgo - 5, 0)),
            resolvedAt: settled
              ? daysBefore(Math.max(plan.daysAgo - 7, 0))
              : null,
          },
        });
      }

      /**
       * Quality inspections — SRS §102.
       *
       * Without these the QC reports render zero rows and a null pass rate on a
       * freshly seeded database, which is exactly the "an empty screen cannot be
       * evaluated" problem the approval queues were seeded against in Phase 2.
       *
       * Every fourth passing parcel is given a failure first, so the report has
       * real rejection reasons and a non-zero re-inspection count. `qcSequence`
       * is a running counter over a fixed plan, so this is deterministic — the
       * same parcels fail on every run, which is what keeps the seed idempotent.
       */
      const stages = pathTo(status);
      if (inspectorId && (stages.includes("QC_PASSED") || stages.includes("QC_FAILED"))) {
        const passed = stages.includes("QC_PASSED");
        qcSequence += 1;
        const failedFirst = passed && qcSequence % 4 === 0;
        const inspectedAt = timeline.qcAt ?? daysBefore(plan.daysAgo - 1);

        if (failedFirst || !passed) {
          const reason =
            QC_SEED_REASONS[qcSequence % QC_SEED_REASONS.length];
          await prisma.qcInspection.create({
            data: {
              subOrderId: subOrder.id,
              inspectorId,
              result: "FAILED",
              checklistJson: checklistJson(reason.failedItem),
              rejectionReason: reason.code,
              notes: reason.note,
              isReinspection: false,
              createdAt: new Date(inspectedAt.getTime() - 3_600_000),
            },
          });
        }

        if (passed) {
          await prisma.qcInspection.create({
            data: {
              subOrderId: subOrder.id,
              inspectorId,
              result: "PASSED",
              checklistJson: checklistJson(null),
              notes: null,
              isReinspection: failedFirst,
              createdAt: inspectedAt,
            },
          });
        }
      }

      // Dispatched or delivered parcels have a shipment.
      if (timeline.dispatchedAt) {
        const courierName = COURIERS[index % COURIERS.length];
        const shipment = await prisma.shipment.create({
          data: {
            subOrderId: subOrder.id,
            courierName,
            trackingNumber: `${subOrder.subOrderNumber.replace(/-/g, "")}${index}`,
            status: timeline.deliveredAt
              ? "DELIVERED"
              : status === "OUT_FOR_DELIVERY"
                ? "OUT_FOR_DELIVERY"
                : "IN_TRANSIT",
            dispatchedAt: timeline.dispatchedAt,
            deliveredAt: timeline.deliveredAt,
            createdAt: timeline.dispatchedAt,
          },
        });

        /**
         * The courier's own scan history — SRS §109.
         *
         * A separate trail from `OrderEvent` on purpose: one is what the
         * platform did, the other is what the carrier reported. The logistics
         * detail page shows them side by side, and with no ShipmentEvent rows
         * that panel would be permanently empty for every seeded parcel.
         */
        const scans: { status: string; location: string | null; at: Date }[] = [
          {
            status: "PICKED_UP",
            location: "Saawariya warehouse, Surat",
            at: timeline.dispatchedAt,
          },
          {
            status: "IN_TRANSIT",
            location: "Surat sorting hub",
            at: new Date(timeline.dispatchedAt.getTime() + 8 * 3_600_000),
          },
        ];

        if (status === "OUT_FOR_DELIVERY" || timeline.deliveredAt) {
          scans.push({
            status: "REACHED_HUB",
            location: `${address.city} hub`,
            at: new Date(timeline.dispatchedAt.getTime() + 30 * 3_600_000),
          });
          scans.push({
            status: "OUT_FOR_DELIVERY",
            location: address.city,
            at: new Date(timeline.dispatchedAt.getTime() + 44 * 3_600_000),
          });
        }

        if (timeline.deliveredAt) {
          scans.push({
            status: "DELIVERED",
            location: address.city,
            at: timeline.deliveredAt,
          });
        }

        for (const scan of scans) {
          await prisma.shipmentEvent.create({
            data: {
              shipmentId: shipment.id,
              status: scan.status,
              location: scan.location,
              note: null,
              createdAt: scan.at,
            },
          });
        }
      }
    }

    // ---- Payment ---------------------------------------------------------
    const isCod = plan.paymentMethod === "COD";

    /**
     * A cancelled order's payment is only REFUNDED once the money has actually
     * gone back. Before Phase 8 the seed marked every cancellation REFUNDED and
     * every refund PROCESSED in the same breath, which made the refund queue
     * look permanently finished — the one screen finance exists to work.
     */
    const refundStatus = plan.refundStatus ?? "PROCESSED";
    const paymentStatus = plan.paymentFailure
      ? "FAILED"
      : plan.status === "CANCELLED"
        ? isCod
          ? "CANCELLED"
          : refundStatus === "PROCESSED"
            ? "REFUNDED"
            : "SUCCESS"
        : isCod
          ? plan.status === "DELIVERED"
            ? "SUCCESS"
            : "PENDING"
          : "SUCCESS";

    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        method: plan.paymentMethod,
        amount: totalAmount,
        status: paymentStatus,
        gatewayRef: isCod ? null : `SIM-${orderNumber}`,
        failureReason: plan.paymentFailure ?? null,
        idempotencyKey: `seed-${orderNumber}`,
        paidAt:
          paymentStatus === "FAILED"
            ? null
            : isCod
              ? plan.status === "DELIVERED"
                ? daysBefore(Math.max(plan.daysAgo - 4, 0))
                : null
              : placedAt,
        createdAt: placedAt,
      },
    });

    if (plan.status === "CANCELLED" && !isCod && !plan.paymentFailure) {
      await prisma.refund.create({
        data: {
          paymentId: payment.id,
          amount: totalAmount,
          reason: "ORDER_CANCELLED",
          status: refundStatus,
          reviewNote: plan.refundNote ?? null,
          requestedAt: daysBefore(Math.max(plan.daysAgo - 1, 0)),
          processedAt:
            refundStatus === "PROCESSED"
              ? daysBefore(Math.max(plan.daysAgo - 3, 0))
              : null,
        },
      });
    }

    /**
     * A completed return raises its own refund, exactly as the support desk does
     * at runtime: `RETURN`, raised PENDING, never auto-approved. Without one the
     * refund queue would have only cancellations in it, and the "Return" reason
     * filter would offer an option that matches nothing.
     */
    if (plan.returnRequest?.status === "REFUNDED" && paymentStatus !== "FAILED") {
      await prisma.refund.create({
        data: {
          paymentId: payment.id,
          amount: totalAmount,
          reason: "RETURN",
          status: "PENDING",
          requestedAt: daysBefore(Math.max(plan.daysAgo - 7, 0)),
        },
      });
    }

    // ---- Notification ----------------------------------------------------
    await prisma.notification.create({
      data: {
        userId: customer.userId,
        title:
          plan.status === "DELIVERED"
            ? `Order ${orderNumber} delivered`
            : plan.status === "CANCELLED"
              ? `Order ${orderNumber} cancelled`
              : plan.status === "PENDING"
                ? `Order ${orderNumber} placed`
                : `Order ${orderNumber} confirmed`,
        body:
          plan.status === "DELIVERED"
            ? "Your parcel has arrived. We would love to hear what you think of it."
            : plan.status === "CANCELLED"
              ? "Your order was cancelled and the amount refunded to your original payment method."
              : plan.status === "PENDING"
                ? "Thank you for your order. We are waiting for the seller to confirm it."
                : "Thank you for your order. We will let you know as soon as it is dispatched.",
        category: "ORDER",
        linkUrl: `/account/orders/${orderNumber}`,
        // The oldest few are already read, so the notifications screen shows
        // both states rather than a wall of unread rows.
        isRead: plan.daysAgo > 30,
        readAt: plan.daysAgo > 30 ? daysBefore(plan.daysAgo - 1) : null,
        createdAt: placedAt,
      },
    });

    created += 1;
  }

  await recomputeReservations(prisma);
  await recomputeSalesCounts(prisma);

  const [subOrderCount, inspectionCount, shipmentCount, notificationCount] =
    await Promise.all([
      prisma.subOrder.count(),
      prisma.qcInspection.count(),
      prisma.shipment.count(),
      prisma.notification.count({ where: { category: "ORDER" } }),
    ]);
  console.log(
    `  Orders: ${created} orders, ${subOrderCount} sub-orders, ${inspectionCount} QC inspections, ${shipmentCount} shipments, ${notificationCount} notifications, reservations recomputed`,
  );
}

// ---------------------------------------------------------------------------
// THE PLAN
// ---------------------------------------------------------------------------

/**
 * SKUs are resolved at runtime, so this stays correct if the product seed
 * changes: anything not found is skipped rather than crashing the seed.
 */
function buildPlans(
  available: { sku: string; sellerName: string }[],
): OrderPlan[] {
  const sku = (index: number) => available[index % available.length].sku;

  /**
   * A SKU belonging to a *named* seller.
   *
   * Positional `sku(n)` is fine when any product will do, but the seller demo
   * login has to have work waiting in its own queue — an evaluator signing in as
   * the seller and finding an empty "orders to confirm" list learns nothing.
   * Falls back to positional if that seller has no approved products, so this
   * never breaks the seed.
   */
  const sellerSku = (sellerName: string, index: number) => {
    const owned = available.filter((p) => p.sellerName === sellerName);
    return owned.length ? owned[index % owned.length].sku : sku(index);
  };

  return [
    // --- Rahul Sharma, the retail demo login ---------------------------
    {
      customerEmail: "customer@saawariya.test",
      daysAgo: 74,
      status: "DELIVERED",
      paymentMethod: "UPI",
      lines: [{ sku: sku(0), quantity: 1 }],
    },
    {
      customerEmail: "customer@saawariya.test",
      daysAgo: 52,
      status: "DELIVERED",
      paymentMethod: "CREDIT_CARD",
      couponCode: "FESTIVE500",
      lines: [
        { sku: sku(3), quantity: 1 },
        { sku: sku(7), quantity: 2 },
      ],
    },
    {
      customerEmail: "customer@saawariya.test",
      daysAgo: 33,
      status: "CANCELLED",
      paymentMethod: "UPI",
      cancelReason: "Ordered by mistake",
      lines: [{ sku: sku(11), quantity: 1 }],
    },
    {
      customerEmail: "customer@saawariya.test",
      daysAgo: 12,
      status: "SHIPPED",
      paymentMethod: "NET_BANKING",
      lines: [{ sku: sku(5), quantity: 1 }],
    },
    {
      customerEmail: "customer@saawariya.test",
      daysAgo: 3,
      status: "PROCESSING",
      paymentMethod: "COD",
      lines: [{ sku: sku(9), quantity: 1 }],
    },

    // --- Meera Traders, the wholesale demo login -----------------------
    {
      customerEmail: "wholesale@saawariya.test",
      daysAgo: 61,
      status: "DELIVERED",
      paymentMethod: "NET_BANKING",
      lines: [{ sku: sku(15), quantity: 12 }],
    },
    {
      customerEmail: "wholesale@saawariya.test",
      daysAgo: 26,
      status: "DELIVERED",
      paymentMethod: "NET_BANKING",
      couponCode: "BULK20",
      // Sized to clear BULK20's ₹50,000 minimum. At the previous quantities the
      // order came to ₹40,400, so the code took nothing off and was recorded
      // anyway — a redemption the cart would have refused.
      lines: [
        { sku: sku(16), quantity: 30 },
        { sku: sku(17), quantity: 24 },
      ],
    },
    {
      customerEmail: "wholesale@saawariya.test",
      daysAgo: 8,
      // Two sellers, one dispatched and one still being prepared — the case
      // the multi-seller model exists for, and the one a single Order.status
      // could not describe.
      status: "PARTIALLY_SHIPPED",
      paymentMethod: "NET_BANKING",
      lines: [
        { sku: sku(1), quantity: 10 },
        { sku: sku(20), quantity: 10 },
      ],
      subOrderStatuses: ["DISPATCHED", "PACKING"],
    },

    // --- The wider customer base ---------------------------------------
    {
      customerEmail: "priya.nair@saawariya.test",
      daysAgo: 45,
      status: "DELIVERED",
      paymentMethod: "UPI",
      lines: [{ sku: sku(2), quantity: 1 }],
    },
    {
      customerEmail: "ananya.bose@saawariya.test",
      daysAgo: 19,
      status: "DELIVERED",
      paymentMethod: "WALLET",
      lines: [{ sku: sku(6), quantity: 1 }],
    },
    {
      customerEmail: "kavitha.reddy@saawariya.test",
      daysAgo: 6,
      status: "CONFIRMED",
      paymentMethod: "UPI",
      couponCode: "WELCOME10",
      lines: [{ sku: sku(13), quantity: 1 }],
    },
    {
      customerEmail: "ritu.malhotra@saawariya.test",
      daysAgo: 2,
      status: "CONFIRMED",
      paymentMethod: "CREDIT_CARD",
      lines: [{ sku: sku(4), quantity: 1 }],
    },

    /**
     * A recently delivered order for the seller demo login.
     *
     * Every one of Anil Textiles' other delivered orders is more than 30 days
     * old, so all of their settlements seed as RELEASED and "awaiting payout"
     * reads ₹0 — a true figure that demonstrates nothing. This one is inside the
     * window, so the seller payout screen has a pending row and the Phase 8
     * finance release queue has something to release.
     */
    {
      customerEmail: "priya.nair@saawariya.test",
      daysAgo: 9,
      status: "DELIVERED",
      paymentMethod: "UPI",
      lines: [{ sku: sellerSku("Anil Textiles", 3), quantity: 1 }],
    },

    /**
     * --- One parcel in every operations state --------------------------
     *
     * Phase 7 built the warehouse, QC and logistics desks and found that only
     * one of their eight queues had anything in it: the seed went straight from
     * WAREHOUSE_QUEUE to PACKING, so picking, inspection, re-inspection and
     * dispatch were all empty. Exactly the Phase 5 finding about the seller's
     * queue, one layer down — an empty queue cannot be evaluated, and three
     * empty panels look broken rather than quiet.
     *
     * The order status of each of these is derived, not declared: every one of
     * them rolls up to PROCESSING except the last, which rolls up to SHIPPED.
     */
    {
      customerEmail: "priya.nair@saawariya.test",
      daysAgo: 2,
      status: "PROCESSING",
      paymentMethod: "UPI",
      lines: [{ sku: sku(21), quantity: 1 }],
      subOrderStatuses: ["PICKING"],
    },
    {
      customerEmail: "ananya.bose@saawariya.test",
      daysAgo: 2,
      status: "PROCESSING",
      paymentMethod: "CREDIT_CARD",
      lines: [{ sku: sku(22), quantity: 1 }],
      subOrderStatuses: ["PICKED"],
    },
    {
      customerEmail: "kavitha.reddy@saawariya.test",
      daysAgo: 3,
      status: "PROCESSING",
      paymentMethod: "UPI",
      lines: [{ sku: sku(23), quantity: 1 }],
      subOrderStatuses: ["QC_PENDING"],
    },
    {
      customerEmail: "wholesale@saawariya.test",
      daysAgo: 3,
      status: "PROCESSING",
      paymentMethod: "NET_BANKING",
      lines: [{ sku: sku(24), quantity: 6 }],
      subOrderStatuses: ["QC_PENDING"],
    },
    // Failed inspection, still sitting with QC — the "send it back" queue.
    {
      customerEmail: "ritu.malhotra@saawariya.test",
      daysAgo: 4,
      status: "PROCESSING",
      paymentMethod: "WALLET",
      lines: [{ sku: sku(25), quantity: 1 }],
      subOrderStatuses: ["QC_FAILED"],
    },
    // Sent back and being re-picked. It will return to QC as a re-inspection,
    // which is the flag the QC report counts.
    {
      customerEmail: "customer@saawariya.test",
      daysAgo: 5,
      status: "PROCESSING",
      paymentMethod: "UPI",
      lines: [{ sku: sku(26), quantity: 1 }],
      subOrderStatuses: ["RETURNED_TO_WAREHOUSE"],
    },
    {
      customerEmail: "priya.nair@saawariya.test",
      daysAgo: 3,
      status: "PROCESSING",
      paymentMethod: "COD",
      lines: [{ sku: sku(27), quantity: 1 }],
      subOrderStatuses: ["QC_PASSED"],
    },
    {
      customerEmail: "customer@saawariya.test",
      daysAgo: 4,
      status: "PROCESSING",
      paymentMethod: "NET_BANKING",
      lines: [{ sku: sku(28), quantity: 1 }],
      subOrderStatuses: ["READY_FOR_DISPATCH"],
    },
    {
      customerEmail: "ananya.bose@saawariya.test",
      daysAgo: 4,
      status: "PROCESSING",
      paymentMethod: "COD",
      lines: [{ sku: sellerSku("Anil Textiles", 4), quantity: 1 }],
      subOrderStatuses: ["READY_FOR_DISPATCH"],
    },
    {
      customerEmail: "kavitha.reddy@saawariya.test",
      daysAgo: 7,
      status: "SHIPPED",
      paymentMethod: "UPI",
      lines: [{ sku: sku(29), quantity: 1 }],
      subOrderStatuses: ["OUT_FOR_DELIVERY"],
    },

    // --- Waiting on a seller to accept ---------------------------------
    // Deliberately non-empty, for the same reason the Phase 2 approval queues
    // are: "orders to confirm" is the seller panel's primary action, and an
    // empty queue cannot be evaluated. Two of the three belong to Anil
    // Textiles, the seller demo login.
    {
      customerEmail: "priya.nair@saawariya.test",
      daysAgo: 1,
      status: "PENDING",
      paymentMethod: "UPI",
      lines: [{ sku: sellerSku("Anil Textiles", 1), quantity: 1 }],
    },
    {
      customerEmail: "wholesale@saawariya.test",
      daysAgo: 1,
      status: "PENDING",
      paymentMethod: "NET_BANKING",
      lines: [{ sku: sellerSku("Anil Textiles", 2), quantity: 4 }],
    },
    {
      customerEmail: "ananya.bose@saawariya.test",
      daysAgo: 0,
      status: "PENDING",
      paymentMethod: "COD",
      lines: [{ sku: sellerSku("Meenakshi Silks", 0), quantity: 1 }],
    },

    // --- Returns, for the support desk (SRS §111) -----------------------
    // Four returns across the whole workflow, because the desk's queue tabs are
    // "to decide / in progress / completed / rejected" and a tab that is always
    // empty cannot be evaluated. The parcel state and the return state are
    // deliberately different rows: a return can be approved for days before the
    // goods move.
    {
      customerEmail: "customer@saawariya.test",
      daysAgo: 14,
      status: "DELIVERED",
      paymentMethod: "UPI",
      lines: [{ sku: sku(30), quantity: 1 }],
      subOrderStatuses: ["RETURN_REQUESTED"],
      returnRequest: {
        index: 0,
        reason: "Wrong item delivered",
        detail:
          "The blouse piece that came with the saree is a different colour from the one on the listing.",
        status: "REQUESTED",
      },
    },
    {
      customerEmail: "priya.nair@saawariya.test",
      daysAgo: 18,
      status: "DELIVERED",
      paymentMethod: "CREDIT_CARD",
      lines: [{ sku: sku(31), quantity: 1 }],
      subOrderStatuses: ["RETURN_REQUESTED"],
      returnRequest: {
        index: 0,
        reason: "Damaged in transit",
        detail: "There is a tear along one edge of the pallu.",
        status: "APPROVED",
        reviewNote: "Photographs received and the damage is clear. Pickup to follow.",
      },
    },
    {
      customerEmail: "deepa.iyer@saawariya.test",
      daysAgo: 22,
      status: "DELIVERED",
      paymentMethod: "NET_BANKING",
      lines: [{ sku: sku(32), quantity: 1 }],
      subOrderStatuses: ["RETURN_REQUESTED"],
      returnRequest: {
        index: 0,
        reason: "Not as described",
        detail: "The fabric feels much lighter than the description suggests.",
        status: "RECEIVED",
        reviewNote: "Back at the warehouse and checked in. Ready to complete.",
      },
    },
    // A finished one: the parcel really did come back, so the sub-order is
    // RETURNED — which is what put the units back on the shelf — and a refund
    // sits PENDING on the finance queue, exactly as the desk raises it.
    {
      customerEmail: "farah.sheikh@saawariya.test",
      daysAgo: 26,
      status: "DELIVERED",
      paymentMethod: "UPI",
      lines: [{ sku: sku(33), quantity: 1 }],
      subOrderStatuses: ["RETURNED"],
      returnRequest: {
        index: 0,
        reason: "Size or fit",
        detail: "The stitched blouse is a size too small.",
        status: "REFUNDED",
        reviewNote: "Received, inspected and accepted. Refund raised for finance.",
      },
    },
    {
      customerEmail: "sunita.desai@saawariya.test",
      daysAgo: 33,
      status: "DELIVERED",
      paymentMethod: "WALLET",
      lines: [{ sku: sku(34), quantity: 1 }],
      subOrderStatuses: ["DELIVERED"],
      returnRequest: {
        index: 0,
        reason: "Changed my mind",
        status: "REJECTED",
        reviewNote:
          "Raised 21 days after delivery, outside the return window stated on the product page.",
      },
    },

    // --- Finance: payouts and refunds that are not on the happy path -----
    // A held payout and a bounced one. Neither can arise without a person
    // deciding, so without these two the finance queue would show only
    // "to release" and "released".
    {
      customerEmail: "kavitha.reddy@saawariya.test",
      daysAgo: 12,
      status: "DELIVERED",
      paymentMethod: "UPI",
      lines: [{ sku: sku(35), quantity: 1 }],
      settlementStatus: "UNDER_REVIEW",
      settlementNote:
        "Held while we confirm the seller's revised bank details — the account name did not match the PAN on file.",
    },
    {
      customerEmail: "ritu.malhotra@saawariya.test",
      daysAgo: 16,
      status: "DELIVERED",
      paymentMethod: "NET_BANKING",
      lines: [{ sku: sku(36), quantity: 1 }],
      settlementStatus: "FAILED",
      settlementNote:
        "Transfer returned by the bank: IFSC no longer valid after the branch merger. Awaiting updated details.",
    },
    // Refunds at each stage of their own workflow.
    {
      customerEmail: "ananya.bose@saawariya.test",
      daysAgo: 3,
      status: "CANCELLED",
      paymentMethod: "CREDIT_CARD",
      cancelReason: "Ordered the wrong colour",
      lines: [{ sku: sku(37), quantity: 1 }],
      refundStatus: "PENDING",
    },
    {
      customerEmail: "lakshmi.boutique@saawariya.test",
      daysAgo: 6,
      status: "CANCELLED",
      paymentMethod: "UPI",
      cancelReason: "Found it cheaper elsewhere",
      lines: [{ sku: sku(38), quantity: 2 }],
      refundStatus: "UNDER_REVIEW",
      refundNote:
        "Second cancellation from this account this month — checking before we release the money.",
    },
    {
      customerEmail: "wholesale@saawariya.test",
      daysAgo: 8,
      status: "CANCELLED",
      paymentMethod: "NET_BANKING",
      cancelReason: "Delivery timeline did not suit us",
      lines: [{ sku: sku(39), quantity: 3 }],
      refundStatus: "APPROVED",
      refundNote: "Approved in full. Transfer to be raised in the next batch.",
    },
    // A payment that never completed. The transaction log has a FAILED tab and
    // nothing else in the seed produces one.
    {
      customerEmail: "sanskriti.exports@saawariya.test",
      daysAgo: 2,
      status: "CANCELLED",
      paymentMethod: "CREDIT_CARD",
      cancelReason: "Payment did not go through",
      lines: [{ sku: sku(40), quantity: 1 }],
      paymentFailure: "Card declined by the issuing bank (insufficient funds).",
    },

    // --- Trading history, so reviews can be real -------------------------
    //
    // These are deliberately old (three to seven months) and unremarkable: one
    // or two lines, delivered, no coupon, settlement long since released. They
    // exist because a review can only be written for a product the customer has
    // actually received — `submitReview` checks the order tables, not the form —
    // and without a delivered line behind it there is nothing to review.
    //
    // Before this block, 25 of the 34 approved products had never been
    // delivered to anyone, so nine products could carry a review between them
    // and the storefront's "Published reviews from verified purchases" was a
    // claim the data could not support. Rather than seed reviews the
    // application itself would refuse to accept, seed the purchases.
    //
    // Referenced by SKU rather than positionally, because the point is *which*
    // products get covered. Appended at the end on purpose: order numbers are
    // assigned in this array's order, so inserting these earlier would renumber
    // every order the walkthrough and the README name.
    { customerEmail: "priya.nair@saawariya.test", daysAgo: 196, status: "DELIVERED", paymentMethod: "UPI", lines: [{ sku: "SAAW-CHA-001", quantity: 1 }] },
    { customerEmail: "ananya.bose@saawariya.test", daysAgo: 188, status: "DELIVERED", paymentMethod: "CREDIT_CARD", lines: [{ sku: "SAAW-MEE-003", quantity: 1 }] },
    { customerEmail: "farah.sheikh@saawariya.test", daysAgo: 181, status: "DELIVERED", paymentMethod: "UPI", lines: [{ sku: "SAAW-RAJ-003", quantity: 1 }, { sku: "SAAW-RAJ-011", quantity: 1 }] },
    { customerEmail: "deepa.iyer@saawariya.test", daysAgo: 174, status: "DELIVERED", paymentMethod: "WALLET", lines: [{ sku: "SAAW-MEE-006", quantity: 1 }] },
    { customerEmail: "sunita.desai@saawariya.test", daysAgo: 168, status: "DELIVERED", paymentMethod: "NET_BANKING", lines: [{ sku: "SAAW-CHA-002", quantity: 1 }] },
    { customerEmail: "ritu.malhotra@saawariya.test", daysAgo: 162, status: "DELIVERED", paymentMethod: "UPI", lines: [{ sku: "SAAW-MEE-004", quantity: 1 }] },
    // Fabric lines carry quantities at or above the product's MOQ, exactly as
    // the cart would have insisted at the time.
    { customerEmail: "lakshmi.boutique@saawariya.test", daysAgo: 157, status: "DELIVERED", paymentMethod: "NET_BANKING", lines: [{ sku: "SAAW-CHA-008", quantity: 30 }] },
    { customerEmail: "kavitha.reddy@saawariya.test", daysAgo: 150, status: "DELIVERED", paymentMethod: "COD", lines: [{ sku: "SAAW-RAJ-006", quantity: 2 }, { sku: "SAAW-RAJ-007", quantity: 1 }] },
    { customerEmail: "customer@saawariya.test", daysAgo: 144, status: "DELIVERED", paymentMethod: "UPI", lines: [{ sku: "SAAW-ANI-005", quantity: 1 }] },
    { customerEmail: "sanskriti.exports@saawariya.test", daysAgo: 138, status: "DELIVERED", paymentMethod: "NET_BANKING", lines: [{ sku: "SAAW-MEE-005", quantity: 40 }] },
    { customerEmail: "priya.nair@saawariya.test", daysAgo: 132, status: "DELIVERED", paymentMethod: "CREDIT_CARD", lines: [{ sku: "SAAW-MEE-007", quantity: 1 }] },
    { customerEmail: "farah.sheikh@saawariya.test", daysAgo: 126, status: "DELIVERED", paymentMethod: "UPI", lines: [{ sku: "SAAW-CHA-005", quantity: 1 }] },
    { customerEmail: "deepa.iyer@saawariya.test", daysAgo: 120, status: "DELIVERED", paymentMethod: "COD", lines: [{ sku: "SAAW-RAJ-008", quantity: 1 }, { sku: "SAAW-RAJ-009", quantity: 1 }] },
    { customerEmail: "ananya.bose@saawariya.test", daysAgo: 115, status: "DELIVERED", paymentMethod: "WALLET", lines: [{ sku: "SAAW-CHA-007", quantity: 1 }] },
    { customerEmail: "wholesale@saawariya.test", daysAgo: 110, status: "DELIVERED", paymentMethod: "NET_BANKING", lines: [{ sku: "SAAW-RAJ-005", quantity: 25 }] },
    { customerEmail: "ritu.malhotra@saawariya.test", daysAgo: 106, status: "DELIVERED", paymentMethod: "CREDIT_CARD", lines: [{ sku: "SAAW-MEE-009", quantity: 1 }] },
    { customerEmail: "sunita.desai@saawariya.test", daysAgo: 102, status: "DELIVERED", paymentMethod: "UPI", lines: [{ sku: "SAAW-CHA-003", quantity: 1 }] },
    { customerEmail: "kavitha.reddy@saawariya.test", daysAgo: 99, status: "DELIVERED", paymentMethod: "UPI", lines: [{ sku: "SAAW-ANI-006", quantity: 1 }] },
    { customerEmail: "customer@saawariya.test", daysAgo: 96, status: "DELIVERED", paymentMethod: "NET_BANKING", lines: [{ sku: "SAAW-RAJ-010", quantity: 1 }] },
    { customerEmail: "priya.nair@saawariya.test", daysAgo: 93, status: "DELIVERED", paymentMethod: "UPI", lines: [{ sku: "SAAW-MEE-008", quantity: 1 }] },
    { customerEmail: "deepa.iyer@saawariya.test", daysAgo: 90, status: "DELIVERED", paymentMethod: "CREDIT_CARD", lines: [{ sku: "SAAW-CHA-006", quantity: 1 }] },
    { customerEmail: "lakshmi.boutique@saawariya.test", daysAgo: 88, status: "DELIVERED", paymentMethod: "NET_BANKING", lines: [{ sku: "SAAW-RAJ-004", quantity: 1 }] },

    // A second and third buyer for some of the above, so rating counts vary
    // and a product page has more than one opinion on it. Ratings averaged over
    // a single review are what make a catalogue look untested.
    { customerEmail: "ritu.malhotra@saawariya.test", daysAgo: 85, status: "DELIVERED", paymentMethod: "UPI", lines: [{ sku: "SAAW-CHA-002", quantity: 1 }] },
    { customerEmail: "farah.sheikh@saawariya.test", daysAgo: 82, status: "DELIVERED", paymentMethod: "WALLET", lines: [{ sku: "SAAW-MEE-006", quantity: 1 }] },
    { customerEmail: "sunita.desai@saawariya.test", daysAgo: 78, status: "DELIVERED", paymentMethod: "COD", lines: [{ sku: "SAAW-RAJ-006", quantity: 1 }] },
    { customerEmail: "ananya.bose@saawariya.test", daysAgo: 75, status: "DELIVERED", paymentMethod: "UPI", lines: [{ sku: "SAAW-CHA-001", quantity: 1 }] },
    { customerEmail: "deepa.iyer@saawariya.test", daysAgo: 72, status: "DELIVERED", paymentMethod: "CREDIT_CARD", lines: [{ sku: "SAAW-MEE-003", quantity: 1 }] },
    { customerEmail: "kavitha.reddy@saawariya.test", daysAgo: 69, status: "DELIVERED", paymentMethod: "UPI", lines: [{ sku: "SAAW-RAJ-011", quantity: 2 }] },
    { customerEmail: "priya.nair@saawariya.test", daysAgo: 66, status: "DELIVERED", paymentMethod: "NET_BANKING", lines: [{ sku: "SAAW-RAJ-008", quantity: 1 }] },
    { customerEmail: "customer@saawariya.test", daysAgo: 63, status: "DELIVERED", paymentMethod: "UPI", lines: [{ sku: "SAAW-MEE-006", quantity: 1 }] },
    // SAAW-RAJ-001 was otherwise bought only by the wholesale demo account —
    // and prisma/seed/reviews.ts holds back one delivered-but-unreviewed piece
    // per demo login so /account/reviews opens with something to write, at the
    // product level only where another buyer can still speak for it. With no
    // second buyer, that hold-back had nowhere safe to land and zeroed this
    // product's only review. A second buyer here fixes it the same way lines
    // 1258-1265 do for the others.
    { customerEmail: "kavitha.reddy@saawariya.test", daysAgo: 60, status: "DELIVERED", paymentMethod: "UPI", lines: [{ sku: "SAAW-RAJ-001", quantity: 1 }] },
  ];
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function defaultSubOrderStatus(orderStatus: string): string {
  switch (orderStatus) {
    // Paid for, but no seller has accepted it yet — this is the state the
    // seller panel's "orders to confirm" queue is made of.
    case "PENDING":
      return "PLACED";
    case "DELIVERED":
      return "DELIVERED";
    case "SHIPPED":
      return "IN_TRANSIT";
    case "PARTIALLY_SHIPPED":
      return "DISPATCHED";
    case "PROCESSING":
      return "WAREHOUSE_QUEUE";
    default:
      return "CONFIRMED";
  }
}

/**
 * The failures the QC report is built from — SRS §104.
 *
 * Codes, not labels: `QcInspection.rejectionReason` stores the key from
 * `QC_REJECTION_REASONS` and every screen looks the wording up, so a seeded row
 * carrying "Fabric Damage" instead of "FABRIC_DAMAGE" would render as its own
 * raw value and be invisible to the breakdown that groups by code.
 *
 * `failedItem` names the checklist line that failed, so the stored checklist
 * agrees with the reason beside it rather than being fifteen ticks and a
 * contradiction.
 */
const QC_SEED_REASONS = [
  {
    code: "FABRIC_DAMAGE",
    failedItem: "No Fabric Damage",
    note: "Pull along the selvedge, roughly 15cm.",
  },
  {
    code: "COLOR_MISMATCH",
    failedItem: "Colour Accuracy",
    note: "Dye lot is visibly warmer than the catalogue photograph.",
  },
  {
    code: "WRONG_VARIANT",
    failedItem: "Correct Variant",
    note: "Picked the 5.5m cut; the order is for 6.3m.",
  },
  {
    code: "PACKAGING_ISSUE",
    failedItem: "Proper Folding",
    note: "Creasing through the zari border from how it was folded.",
  },
];

/** A stored checklist with every box ticked, except one named failure. */
function checklistJson(failedItem: string | null): string {
  const checklist: Record<string, Record<string, boolean>> = {};

  for (const [key, group] of Object.entries(QC_CHECKLIST)) {
    checklist[key] = Object.fromEntries(
      group.items.map((item) => [item, item !== failedItem]),
    );
  }

  return JSON.stringify(checklist);
}

/** The happy path, used only to work out what a status implies about the past. */
const STAGE_ORDER = [
  "PLACED",
  "CONFIRMED",
  "WAREHOUSE_QUEUE",
  "PICKING",
  "PICKED",
  "QC_PENDING",
  "QC_PASSED",
  "PACKING",
  "READY_FOR_DISPATCH",
  "DISPATCHED",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

/**
 * Every state a parcel in `status` must already have passed through.
 *
 * The happy path is a prefix of `STAGE_ORDER`, but the QC loop is not on it:
 * a parcel that failed inspection has been to QC_PENDING and no further along
 * the line, and one sent back to the warehouse has been to QC_FAILED as well.
 * Deriving the whole path once means the timestamps and the event trail cannot
 * tell different stories about the same parcel — the previous version indexed
 * into `STAGE_ORDER` directly, so both silently produced nothing at all for the
 * two loop states.
 */
function pathTo(status: string): string[] {
  if (status === "QC_FAILED") return [...pathTo("QC_PENDING"), "QC_FAILED"];
  if (status === "RETURNED_TO_WAREHOUSE") {
    return [...pathTo("QC_FAILED"), "RETURNED_TO_WAREHOUSE"];
  }
  /**
   * The return states are not on `STAGE_ORDER` either, and Phase 8 walked into
   * the same trap Phase 7 documented: a parcel seeded as RETURN_REQUESTED got an
   * empty path, so it had no `deliveredAt`, no event trail, and a returns queue
   * full of rows whose timeline said the goods had never arrived.
   */
  if (status === "RETURN_REQUESTED") {
    return [...pathTo("DELIVERED"), "RETURN_REQUESTED"];
  }
  if (status === "RETURNED") {
    return [...pathTo("RETURN_REQUESTED"), "RETURNED"];
  }

  const index = STAGE_ORDER.indexOf(status);
  return index < 0 ? [] : STAGE_ORDER.slice(0, index + 1);
}

function timelineFor(status: string, placedAt: Date) {
  const after = (hours: number) =>
    new Date(placedAt.getTime() + hours * 3_600_000);

  const path = pathTo(status);
  const reached = (target: string) => path.includes(target);

  return {
    confirmedAt: reached("CONFIRMED") ? after(4) : null,
    pickedAt: reached("PICKED") ? after(20) : null,
    // Stamped on QC_PASSED only. A parcel that failed inspection has been to
    // quality control, but `qcAt` means "cleared QC", and back-dating a clean
    // inspection it never had is exactly the kind of tidy-looking lie the
    // event trail exists to prevent.
    qcAt: reached("QC_PASSED") ? after(26) : null,
    packedAt: reached("PACKING") ? after(30) : null,
    dispatchedAt: reached("DISPATCHED") ? after(36) : null,
    deliveredAt: reached("DELIVERED") ? after(96) : null,
  };
}

const STAGE_NOTES: Record<string, { role: string; note: string }> = {
  PLACED: { role: "CUSTOMER", note: "Order placed." },
  CONFIRMED: { role: "SELLER", note: "Confirmed by the seller." },
  WAREHOUSE_QUEUE: { role: "WAREHOUSE", note: "Queued for picking." },
  PICKING: { role: "WAREHOUSE", note: "Picking started." },
  PICKED: { role: "WAREHOUSE", note: "Items picked." },
  QC_PENDING: { role: "WAREHOUSE", note: "Sent for quality inspection." },
  QC_PASSED: { role: "QC", note: "Passed inspection." },
  QC_FAILED: { role: "QC", note: "Failed inspection." },
  RETURNED_TO_WAREHOUSE: {
    role: "QC",
    note: "Returned to the warehouse to be re-picked.",
  },
  PACKING: { role: "WAREHOUSE", note: "Packing." },
  READY_FOR_DISPATCH: {
    role: "WAREHOUSE",
    note: "Ready for courier pickup.",
  },
  DISPATCHED: { role: "LOGISTICS", note: "Handed to the courier." },
  IN_TRANSIT: { role: "LOGISTICS", note: "In transit." },
  OUT_FOR_DELIVERY: { role: "LOGISTICS", note: "Out for delivery." },
  DELIVERED: { role: "LOGISTICS", note: "Delivered." },
  RETURN_REQUESTED: {
    role: "CUSTOMER",
    note: "Customer requested a return.",
  },
  RETURNED: {
    role: "SUPPORT",
    note: "Return received and completed.",
  },
};

function eventTrailFor(status: string, placedAt: Date) {
  if (status === "CANCELLED") {
    return [
      {
        status: "PLACED",
        role: "CUSTOMER",
        note: "Order placed.",
        at: placedAt,
      },
      {
        status: "CANCELLED",
        role: "CUSTOMER",
        note: "Cancelled by the customer before dispatch.",
        at: new Date(placedAt.getTime() + 86_400_000),
      },
    ];
  }

  return pathTo(status).map((stage, position) => ({
    status: stage,
    role: STAGE_NOTES[stage].role,
    note: STAGE_NOTES[stage].note,
    at: new Date(placedAt.getTime() + position * 7 * 3_600_000),
  }));
}

/**
 * `reservedQty` is DERIVED, never incremented.
 *
 * It is the quantity held by sub-orders that have been placed but not yet
 * dispatched. Computing it from scratch is what makes this seed re-runnable —
 * incrementing per run would leave the catalogue progressively more "sold out"
 * every time someone re-seeds.
 */
async function recomputeReservations(prisma: PrismaClient) {
  const live = await prisma.orderItem.findMany({
    where: {
      subOrder: {
        status: {
          in: [
            "PLACED",
            "CONFIRMED",
            "WAREHOUSE_QUEUE",
            "PICKING",
            "PICKED",
            "QC_PENDING",
            "QC_PASSED",
            "QC_FAILED",
            "RETURNED_TO_WAREHOUSE",
            "PACKING",
            "READY_FOR_DISPATCH",
          ],
        },
      },
    },
    select: { productId: true, quantity: true },
  });

  const held = new Map<string, number>();
  for (const item of live) {
    held.set(item.productId, (held.get(item.productId) ?? 0) + item.quantity);
  }

  const inventories = await prisma.inventory.findMany({
    select: { id: true, productId: true, stockQty: true },
  });

  for (const inventory of inventories) {
    // Never reserve beyond what is physically there — a reservation larger than
    // stock makes availability negative everywhere it is computed.
    const reservedQty = Math.min(
      held.get(inventory.productId) ?? 0,
      inventory.stockQty,
    );
    await prisma.inventory.update({
      where: { id: inventory.id },
      data: { reservedQty },
    });
  }
}

/**
 * `salesCount` is DERIVED too, for the same reason `reservedQty` is.
 *
 * It used to be merchandising data typed into the product seed — one saree
 * claimed 207 units sold against a database holding 39 sub-orders in total —
 * and nothing in the application ever moved it. The storefront's "Best selling"
 * sort, the homepage best sellers rail and the "Units sold" figure on both the
 * seller and admin product pages all read it as fact. Same class as the
 * fabricated campaign counters removed in Phase 8: a number the rows behind it
 * cannot justify.
 *
 * The rule lives in `src/lib/catalogue/sales.ts` so the seed and the running
 * application cannot disagree about what "sold" means, exactly as
 * `deriveOrderStatus` and `deriveInventoryStatus` are shared.
 */
async function recomputeSalesCounts(prisma: PrismaClient) {
  const sold = await prisma.orderItem.findMany({
    where: { subOrder: { status: { in: [...SOLD_SUB_ORDER_STATUSES] } } },
    select: { productId: true, quantity: true },
  });

  const units = new Map<string, number>();
  for (const item of sold) {
    units.set(item.productId, (units.get(item.productId) ?? 0) + item.quantity);
  }

  // Every product is written, not just those with sales, so a re-seed cannot
  // leave a stale count behind on a product whose orders have gone.
  const products = await prisma.product.findMany({ select: { id: true } });
  for (const product of products) {
    await prisma.product.update({
      where: { id: product.id },
      data: { salesCount: units.get(product.id) ?? 0 },
    });
  }
}

function apportion(total: number, weights: number[]): number[] {
  if (weights.length === 0) return [];
  if (total === 0) return weights.map(() => 0);

  const sum = weights.reduce((acc, w) => acc + w, 0);
  if (sum <= 0) return weights.map(() => 0);

  const exact = weights.map((w) => (total * w) / sum);
  const parts = exact.map(Math.floor);
  let remainder = total - parts.reduce((acc, p) => acc + p, 0);

  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction);

  for (let i = 0; remainder > 0; i = (i + 1) % order.length, remainder--) {
    parts[order[i].index] += 1;
  }

  return parts;
}

async function discountFor(
  prisma: PrismaClient,
  code: string,
  subtotal: number,
): Promise<number> {
  const coupon = await prisma.coupon.findUnique({ where: { code } });
  if (!coupon || subtotal < coupon.minOrderValue) return 0;

  switch (coupon.discountType) {
    case "PERCENTAGE":
      return Math.min(
        Math.round((subtotal * coupon.discountValue) / 100),
        coupon.maxDiscount ?? Number.MAX_SAFE_INTEGER,
        subtotal,
      );
    case "FIXED":
      return Math.min(coupon.discountValue, subtotal);
    default:
      return 0;
  }
}

function daysBefore(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  // Fixed clock time so re-seeding on the same day produces identical rows.
  date.setHours(11, 30, 0, 0);
  return date;
}
