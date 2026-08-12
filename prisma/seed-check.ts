/**
 * Post-seed sanity check.
 *
 *   npx tsx prisma/seed-check.ts
 *
 * Verifies the invariants that are easy to break silently while editing seed
 * data: every product resolvable through its category and seller, every image
 * file actually present on disk, rating rollups matching the reviews they were
 * computed from, and variant stock reconciling against Inventory.
 */
import "dotenv/config";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
// The real roll-up rule, not a copy — the point of the check is that the seeded
// order statuses agree with the function the running software applies.
import { deriveOrderStatus } from "../src/lib/fulfilment/order-rollup";
import { SOLD_SUB_ORDER_STATUSES } from "../src/lib/constants";

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" }),
});

const problems: string[] = [];
const check = (ok: boolean, message: string) => {
  if (!ok) problems.push(message);
};

/** Count occurrences, for the "is every tab of this queue non-empty" checks. */
const tally = (values: string[]): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
};

async function main() {
  const counts = {
    users: await prisma.user.count(),
    sellers: await prisma.seller.count(),
    sellerDocuments: await prisma.sellerDocument.count(),
    categories: await prisma.category.count(),
    products: await prisma.product.count(),
    productImages: await prisma.productImage.count(),
    variants: await prisma.productVariant.count(),
    inventory: await prisma.inventory.count(),
    stockMovements: await prisma.stockMovement.count(),
    reviews: await prisma.review.count(),
    banners: await prisma.banner.count(),
    coupons: await prisma.coupon.count(),
    campaigns: await prisma.campaign.count(),
    cmsPages: await prisma.cmsPage.count(),
    settings: await prisma.setting.count(),
    subscribers: await prisma.newsletterSubscriber.count(),
  };
  console.log("\nRow counts");
  console.table(counts);

  // --- catalogue shape ---------------------------------------------------
  const products = await prisma.product.findMany({
    include: {
      category: true,
      seller: true,
      images: true,
      variants: true,
      inventory: true,
    },
  });

  const publicDir = join(process.cwd(), "public");
  const missingImages = new Set<string>();

  for (const p of products) {
    check(!!p.category, `${p.sku}: no category`);
    check(!!p.seller, `${p.sku}: no seller`);
    check(p.images.length > 0, `${p.sku}: no images`);
    check(p.images.some((i) => i.isMain), `${p.sku}: no main image`);
    check(!!p.inventory, `${p.sku}: no inventory row`);
    check(p.priceRetail > 0, `${p.sku}: retail price is not positive`);
    check(
      p.priceWholesale === null || p.priceWholesale < p.priceRetail,
      `${p.sku}: wholesale price is not below retail`,
    );
    check(
      p.priceOffer === null || p.priceOffer < p.priceRetail,
      `${p.sku}: offer price is not below retail`,
    );

    for (const image of p.images) {
      if (!existsSync(join(publicDir, image.url))) missingImages.add(image.url);
    }

    // A gallery that shows the same photograph twice looks broken, and it is an
    // easy thing to reintroduce when a pool shrinks.
    const distinct = new Set(p.images.map((i) => i.url));
    check(
      distinct.size === p.images.length,
      `${p.sku}: gallery repeats an image (${p.images.length} images, ${distinct.size} distinct)`,
    );

    if (p.variants.length > 0 && p.inventory) {
      const variantTotal = p.variants.reduce((n, v) => n + v.stockQty, 0);
      check(
        variantTotal === p.inventory.stockQty,
        `${p.sku}: variant stock ${variantTotal} != inventory ${p.inventory.stockQty}`,
      );
    }
  }

  for (const url of missingImages) problems.push(`missing image file: public${url}`);

  // --- category tree -----------------------------------------------------
  const categories = await prisma.category.findMany({ include: { products: true } });
  const leaves = categories.filter((c) => c.parentId !== null);
  const emptyLeaves = leaves.filter((c) => c.products.length === 0);
  console.log(
    `\nCategories: ${categories.length - leaves.length} top-level, ${leaves.length} sub-categories` +
      ` (${emptyLeaves.length} with no products yet)`,
  );

  // --- rating rollup -----------------------------------------------------
  const grouped = await prisma.review.groupBy({
    by: ["productId"],
    where: { status: "APPROVED" },
    _avg: { rating: true },
    _count: { _all: true },
  });
  const expected = new Map(
    grouped.map((g) => [
      g.productId,
      { avg: Math.round((g._avg.rating ?? 0) * 10), count: g._count._all },
    ]),
  );
  for (const p of products) {
    const want = expected.get(p.id) ?? { avg: 0, count: 0 };
    check(
      p.ratingAvg === want.avg && p.ratingCount === want.count,
      `${p.sku}: rating rollup is ${p.ratingAvg}/${p.ratingCount}, reviews say ${want.avg}/${want.count}`,
    );
  }

  /**
   * Every review is a verified purchase.
   *
   * `submitReview` refuses a review for a product the customer has not received,
   * `/account/reviews` builds its list from delivered order lines, and the
   * homepage testimonials band tells visitors the quotes come from verified
   * purchases. The seed used to contradict all three — 14 of 18 rows were
   * written by customers who had never been sent the product — so this is the
   * check that keeps the claim on the homepage true.
   */
  const allReviews = await prisma.review.findMany({
    select: {
      createdAt: true,
      userId: true,
      user: { select: { email: true } },
      product: { select: { sku: true, status: true } },
      productId: true,
    },
  });
  const deliveredPairs = await prisma.orderItem.findMany({
    where: { subOrder: { status: "DELIVERED" } },
    select: {
      productId: true,
      subOrder: {
        select: {
          deliveredAt: true,
          order: { select: { customer: { select: { userId: true } } } },
        },
      },
    },
  });
  const deliveredAtByPair = new Map<string, Date | null>();
  for (const line of deliveredPairs) {
    const key = `${line.productId}:${line.subOrder.order.customer.userId}`;
    const existing = deliveredAtByPair.get(key);
    const at = line.subOrder.deliveredAt;
    // Keep the earliest delivery — the first date the review could have existed.
    if (existing === undefined || (at && existing && at < existing)) {
      deliveredAtByPair.set(key, at);
    }
  }

  for (const review of allReviews) {
    const key = `${review.productId}:${review.userId}`;
    const deliveredAt = deliveredAtByPair.get(key);
    check(
      deliveredAtByPair.has(key),
      `${review.product.sku}: reviewed by ${review.user.email}, who has no delivered order for it — the app would refuse to write this row`,
    );
    check(
      review.product.status === "APPROVED",
      `${review.product.sku}: has a review but is ${review.product.status}, so nobody could have bought it`,
    );
    if (deliveredAt) {
      check(
        review.createdAt >= deliveredAt,
        `${review.product.sku}: reviewed by ${review.user.email} before it was delivered`,
      );
    }
  }

  // Two reviews with the same wording on one product read as fabricated, which
  // is exactly what a reviewer looks for. Across the catalogue some reuse is
  // unavoidable from a fixed pool; on a single listing it is not.
  const bodiesByProduct = new Map<string, Set<string>>();
  const rawBodies = await prisma.review.findMany({
    select: { productId: true, body: true, product: { select: { sku: true } } },
  });
  for (const row of rawBodies) {
    const set = bodiesByProduct.get(row.productId) ?? new Set<string>();
    check(
      !set.has(row.body),
      `${row.product.sku}: the same review wording appears twice on this product`,
    );
    set.add(row.body);
    bodiesByProduct.set(row.productId, set);
  }

  const reviewedProducts = new Set(allReviews.map((r) => r.productId));
  const approvedProductCount = products.filter((p) => p.status === "APPROVED").length;
  console.log(
    `\nReviews: ${allReviews.length} across ${reviewedProducts.size} of ${approvedProductCount} approved products, all verified purchases`,
  );
  check(
    reviewedProducts.size >= approvedProductCount - 2,
    `${approvedProductCount - reviewedProducts.size} approved products carry no review at all — most listings would show no rating`,
  );

  // --- workflow queues have something in them ----------------------------
  const pendingProducts = await prisma.product.count({ where: { status: "PENDING" } });
  const pendingSellers = await prisma.seller.count({
    where: { verificationStatus: { in: ["PENDING", "UNDER_REVIEW"] } },
  });
  const pendingReviews = await prisma.review.count({ where: { status: "PENDING" } });
  console.log(
    `\nApproval queues: ${pendingProducts} products, ${pendingSellers} sellers, ${pendingReviews} reviews`,
  );
  check(pendingProducts > 0, "product approval queue is empty");
  check(pendingSellers > 0, "seller approval queue is empty");
  check(pendingReviews > 0, "review moderation queue is empty");

  // --- orders: the money has to add up --------------------------------------
  //
  // The one invariant an integer-paise model exists to guarantee. If a
  // multi-seller order's parts do not sum to its total, seller settlement and
  // the finance reports will disagree with what the customer paid, and the
  // difference is unrecoverable once it is written.
  const orders = await prisma.order.findMany({
    include: { subOrders: { include: { items: true } }, payments: true },
  });

  for (const order of orders) {
    const subOrderSum = order.subOrders.reduce(
      (sum, s) => sum + s.subtotal - s.discountAmount + s.shippingAmount,
      0,
    );
    check(
      subOrderSum === order.totalAmount,
      `${order.orderNumber}: sub-orders sum to ${subOrderSum}, order total is ${order.totalAmount}`,
    );

    const lineSum = order.subOrders.reduce(
      (sum, s) => sum + s.items.reduce((acc, i) => acc + i.lineTotal, 0),
      0,
    );
    check(
      lineSum === order.subtotal,
      `${order.orderNumber}: line totals sum to ${lineSum}, order subtotal is ${order.subtotal}`,
    );

    for (const subOrder of order.subOrders) {
      const own = subOrder.items.reduce((acc, i) => acc + i.lineTotal, 0);
      check(
        own === subOrder.subtotal,
        `${subOrder.subOrderNumber}: items sum to ${own}, sub-order subtotal is ${subOrder.subtotal}`,
      );
      check(
        subOrder.items.every((i) => i.unitPrice * i.quantity === i.lineTotal),
        `${subOrder.subOrderNumber}: a line total is not unitPrice x quantity`,
      );
    }

    check(
      order.payments.length > 0,
      `${order.orderNumber}: no payment row`,
    );
    check(
      order.payments.every((p) => p.amount === order.totalAmount),
      `${order.orderNumber}: a payment amount does not match the order total`,
    );
  }

  // --- reservations are derived, not accumulated ----------------------------
  // Re-seeding must not leave stock progressively more "reserved". reservedQty
  // has to equal what live sub-orders are actually holding.
  const liveItems = await prisma.orderItem.findMany({
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
  for (const item of liveItems) {
    held.set(item.productId, (held.get(item.productId) ?? 0) + item.quantity);
  }

  const inventories = await prisma.inventory.findMany();
  for (const inventory of inventories) {
    const expectedReserved = Math.min(
      held.get(inventory.productId) ?? 0,
      inventory.stockQty,
    );
    check(
      inventory.reservedQty === expectedReserved,
      `inventory ${inventory.productId}: reservedQty is ${inventory.reservedQty}, live sub-orders hold ${expectedReserved}`,
    );
    check(
      inventory.reservedQty <= inventory.stockQty,
      `inventory ${inventory.productId}: reserved ${inventory.reservedQty} exceeds stock ${inventory.stockQty}`,
    );
  }

  // --- Order.status is a summary, and must agree with what it summarises -----
  //
  // `Order.status` is derived from its sub-orders everywhere in the running
  // software (`deriveOrderStatus`), and the seed writes both. Checking them
  // against the same function is what stops the demo data describing a state
  // the software itself would never produce.
  for (const order of orders) {
    const derived = deriveOrderStatus(order.subOrders.map((s) => s.status));
    check(
      order.status === derived,
      `${order.orderNumber}: status is ${order.status}, its sub-orders roll up to ${derived}`,
    );
  }

  // --- every operations queue has work in it --------------------------------
  //
  // Phase 7 built three panels over eight queues and found seven of them empty.
  // Same rule as the Phase 2 approval queues: a queue with nothing in it cannot
  // be evaluated, and a panel of empty queues looks broken rather than quiet.
  const byStatus = await prisma.subOrder.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const subOrderCounts = new Map(byStatus.map((r) => [r.status, r._count._all]));
  const countOf = (...statuses: string[]) =>
    statuses.reduce((sum, s) => sum + (subOrderCounts.get(s) ?? 0), 0);

  const OPERATIONS_QUEUES: [string, number][] = [
    ["warehouse inbound (CONFIRMED)", countOf("CONFIRMED")],
    [
      "warehouse picking",
      countOf("WAREHOUSE_QUEUE", "PICKING", "PICKED", "RETURNED_TO_WAREHOUSE"),
    ],
    ["warehouse packing", countOf("QC_PASSED", "PACKING")],
    ["QC awaiting inspection", countOf("QC_PENDING")],
    ["QC failed", countOf("QC_FAILED")],
    ["logistics dispatch", countOf("READY_FOR_DISPATCH")],
    [
      "logistics in transit",
      countOf("DISPATCHED", "IN_TRANSIT", "OUT_FOR_DELIVERY"),
    ],
  ];

  console.log("\nOperations queues");
  console.table(Object.fromEntries(OPERATIONS_QUEUES));

  for (const [label, count] of OPERATIONS_QUEUES) {
    check(count > 0, `the ${label} queue is empty`);
  }

  // --- QC and shipment records ----------------------------------------------
  const inspections = await prisma.qcInspection.findMany({
    select: { result: true, rejectionReason: true, isReinspection: true },
  });

  check(
    inspections.length > 0,
    "no QC inspections — the QC reports would render an empty page",
  );
  check(
    inspections.some((i) => i.result === "FAILED"),
    "no failed inspections — the rejection-reason breakdown would be empty",
  );
  check(
    inspections.some((i) => i.isReinspection),
    "no re-inspections — the QC loop would be unproven by the data",
  );
  // The same rule the admin console enforces everywhere: a rejection with no
  // reason is a dead end telling someone they failed and not why.
  check(
    inspections.every((i) => i.result !== "FAILED" || Boolean(i.rejectionReason)),
    "a failed inspection has no rejection reason",
  );

  const DISPATCHED_ONWARD = [
    "DISPATCHED",
    "IN_TRANSIT",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
  ];
  const shipped = await prisma.subOrder.findMany({
    where: { status: { in: DISPATCHED_ONWARD } },
    select: {
      subOrderNumber: true,
      shipment: { select: { trackingNumber: true, _count: { select: { events: true } } } },
    },
  });

  for (const subOrder of shipped) {
    check(
      Boolean(subOrder.shipment),
      `${subOrder.subOrderNumber}: dispatched with no shipment — the customer has no tracking number`,
    );
    check(
      (subOrder.shipment?._count.events ?? 0) > 0,
      `${subOrder.subOrderNumber}: shipment has no events`,
    );
  }

  // --- Phase 8: finance, marketing and support queues ------------------------
  //
  // Same rule, third time of asking. Phase 5 found the seller's primary queue
  // empty, Phase 7 found seven of eight operations queues empty, and these three
  // desks add fourteen more. A tab that is always empty cannot be evaluated, and
  // several of these states — a held payout, a rejected return, a cancelled
  // campaign — cannot arise from the happy path at all, so only the seed can put
  // them there.

  const settlements = await prisma.settlement.findMany();
  const settlementByStatus = tally(settlements.map((s) => s.status));

  const refunds = await prisma.refund.findMany();
  const refundByStatus = tally(refunds.map((r) => r.status));

  const payments = await prisma.payment.findMany();
  const paymentByStatus = tally(payments.map((p) => p.status));

  console.log("\nFinance");
  console.table({
    settlements: settlementByStatus,
    refunds: refundByStatus,
    payments: paymentByStatus,
  });

  for (const status of ["PENDING", "UNDER_REVIEW", "RELEASED", "FAILED"]) {
    check(
      (settlementByStatus[status] ?? 0) > 0,
      `no ${status} settlements — that tab of the payout queue would be empty`,
    );
  }
  // REJECTED is deliberately absent: a refund is only rejected by a person, and
  // seeding one would mean seeding a customer who was refused their money back
  // with no story attached to it.
  for (const status of ["PENDING", "UNDER_REVIEW", "APPROVED", "PROCESSED"]) {
    check(
      (refundByStatus[status] ?? 0) > 0,
      `no ${status} refunds — that tab of the refund queue would be empty`,
    );
  }
  for (const status of ["SUCCESS", "PENDING", "FAILED", "REFUNDED"]) {
    check(
      (paymentByStatus[status] ?? 0) > 0,
      `no ${status} payments — that tab of the transaction log would be empty`,
    );
  }

  // The settlement arithmetic, which is the whole reason money is integer paise.
  for (const settlement of settlements) {
    const commission = Math.round(
      (settlement.grossAmount * settlement.commissionPercent) / 100,
    );
    check(
      settlement.commissionAmount === commission,
      `settlement ${settlement.id}: commission is ${settlement.commissionAmount}, ${settlement.commissionPercent}% of ${settlement.grossAmount} is ${commission}`,
    );
    check(
      settlement.grossAmount - settlement.commissionAmount ===
        settlement.netAmount,
      `settlement ${settlement.id}: gross - commission != net`,
    );
    check(
      settlement.status !== "RELEASED" || Boolean(settlement.releasedAt),
      `settlement ${settlement.id}: released with no releasedAt`,
    );
  }

  /**
   * A delivered parcel with no settlement is money a seller is owed that appears
   * in no queue at all — the failure the finance dashboard exists to catch, and
   * exactly what Phase 5 found in the seed.
   */
  const deliveredWithoutSettlement = await prisma.subOrder.count({
    where: { status: "DELIVERED", settlement: { is: null } },
  });
  check(
    deliveredWithoutSettlement === 0,
    `${deliveredWithoutSettlement} delivered sub-order(s) have no settlement raised`,
  );

  // --- returns ---------------------------------------------------------------
  const returns = await prisma.returnRequest.findMany({
    select: { status: true, reviewNote: true, subOrder: { select: { subOrderNumber: true, status: true } } },
  });
  const returnByStatus = tally(returns.map((r) => r.status));

  console.log("\nReturns");
  console.table(returnByStatus);

  for (const status of ["REQUESTED", "APPROVED", "RECEIVED", "REFUNDED", "REJECTED"]) {
    check(
      (returnByStatus[status] ?? 0) > 0,
      `no ${status} returns — that part of the returns desk would be empty`,
    );
  }
  // Same rule as every other rejection in this build: the note is what the other
  // side reads, and one without it is a dead end.
  check(
    returns.every((r) => r.status !== "REJECTED" || Boolean(r.reviewNote)),
    "a rejected return has no explanation on it",
  );

  const returningSubOrders = await prisma.subOrder.findMany({
    where: { status: { in: ["RETURN_REQUESTED", "RETURNED"] } },
    select: { subOrderNumber: true, returnRequest: { select: { id: true } } },
  });
  for (const subOrder of returningSubOrders) {
    check(
      Boolean(subOrder.returnRequest),
      `${subOrder.subOrderNumber}: in a return state with no ReturnRequest — the desk would have nothing to decide`,
    );
  }

  // --- support tickets -------------------------------------------------------
  const tickets = await prisma.supportTicket.findMany({
    select: {
      ticketNumber: true,
      status: true,
      priority: true,
      priorityRank: true,
      assigneeId: true,
      raisedBy: { select: { roleCode: true } },
    },
  });
  const ticketByStatus = tally(tickets.map((t) => t.status));

  console.log("\nSupport tickets");
  console.table(ticketByStatus);

  for (const status of [
    "OPEN",
    "ASSIGNED",
    "IN_PROGRESS",
    "WAITING_CUSTOMER",
    "RESOLVED",
    "CLOSED",
  ]) {
    check(
      (ticketByStatus[status] ?? 0) > 0,
      `no ${status} tickets — that tab of the helpdesk queue would be empty`,
    );
  }
  check(
    tickets.some((t) => !t.assigneeId && t.status !== "CLOSED"),
    "every open ticket is assigned — the unassigned queue would be empty",
  );
  check(
    tickets.some((t) => t.priority === "CRITICAL" || t.priority === "HIGH"),
    "no high-priority tickets — the priority sort would be unproven",
  );
  check(
    tickets.some((t) => t.raisedBy.roleCode === "SELLER"),
    "no seller-raised tickets — sellers hold ticket.raise and the queue should show one",
  );

  /**
   * `priorityRank` is a denormalised mirror of `priority` and the queue sorts on
   * it, so a stale value is invisible until an escalated ticket silently stays at
   * the bottom of the list. Same class of check as the rating rollup above.
   */
  const RANK: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
  for (const ticket of tickets) {
    check(
      ticket.priorityRank === RANK[ticket.priority],
      `${ticket.ticketNumber}: priority ${ticket.priority} but priorityRank ${ticket.priorityRank}`,
    );
  }

  /**
   * `salesCount` is a denormalised mirror of the order lines that actually
   * sold, and three things sort on it: the homepage best sellers rail, the
   * listing page's "Best selling" option, and the "Units sold" figure on the
   * seller and admin product pages.
   *
   * It was seeded merchandising fiction until Phase 9 — one product claimed 207
   * units against a database of 39 sub-orders — so this asserts the number
   * against the rows behind it, exactly as the campaign reach check does.
   */
  const soldLines = await prisma.orderItem.findMany({
    where: { subOrder: { status: { in: [...SOLD_SUB_ORDER_STATUSES] } } },
    select: { productId: true, quantity: true },
  });
  const soldUnits = new Map<string, number>();
  for (const line of soldLines) {
    soldUnits.set(line.productId, (soldUnits.get(line.productId) ?? 0) + line.quantity);
  }
  const productsWithSales = await prisma.product.findMany({
    select: { id: true, sku: true, salesCount: true },
  });
  for (const product of productsWithSales) {
    const expected = soldUnits.get(product.id) ?? 0;
    check(
      product.salesCount === expected,
      `${product.sku}: salesCount is ${product.salesCount} but delivered order lines total ${expected}`,
    );
  }
  check(
    productsWithSales.some((p) => p.salesCount > 0),
    "no product has a sale — the best sellers rail would be empty",
  );

  // --- marketing -------------------------------------------------------------
  const nowAt = new Date();
  const allCoupons = await prisma.coupon.findMany();
  const couponState = (c: (typeof allCoupons)[number]) =>
    !c.isActive
      ? "switched off"
      : c.startsAt > nowAt
        ? "scheduled"
        : c.endsAt < nowAt
          ? "finished"
          : "live";

  const allBanners = await prisma.banner.findMany();
  const bannerState = (b: (typeof allBanners)[number]) =>
    !b.isActive
      ? "switched off"
      : b.startsAt && b.startsAt > nowAt
        ? "scheduled"
        : b.endsAt && b.endsAt < nowAt
          ? "finished"
          : "live";

  const allCampaigns = await prisma.campaign.findMany();

  console.log("\nMarketing");
  console.table({
    coupons: tally(allCoupons.map(couponState)),
    banners: tally(allBanners.map(bannerState)),
    campaigns: tally(allCampaigns.map((c) => c.status)),
  });

  for (const state of ["live", "scheduled", "finished", "switched off"]) {
    check(
      allCoupons.some((c) => couponState(c) === state),
      `no ${state} coupons — that tab would be empty`,
    );
  }
  for (const state of ["live", "scheduled", "switched off"]) {
    check(
      allBanners.some((b) => bannerState(b) === state),
      `no ${state} banners — the banner screen would show one state only`,
    );
  }
  for (const status of ["DRAFT", "SCHEDULED", "ACTIVE", "COMPLETED", "CANCELLED"]) {
    check(
      allCampaigns.some((c) => c.status === status),
      `no ${status} campaigns — that tab would be empty`,
    );
  }
  check(
    allBanners.some((b) => b.position === "HOME_HERO" && bannerState(b) === "live"),
    "no live HOME_HERO banner — the homepage carousel would be empty",
  );

  /**
   * The honesty invariant for campaign reach.
   *
   * `Campaign.viewCount` used to be a fabricated figure — 48,210 views against
   * eleven seeded customers — while the marketing screens now say the number
   * counts the notifications a broadcast actually wrote. This check is what
   * keeps that claim true: reach must equal the rows that produced it.
   */
  const promoNotifications = await prisma.notification.groupBy({
    by: ["title"],
    where: { category: "PROMOTION" },
    _count: { _all: true },
  });
  const reachByTitle = new Map(
    promoNotifications.map((row) => [row.title, row._count._all]),
  );
  for (const campaign of allCampaigns) {
    check(
      campaign.viewCount === (reachByTitle.get(campaign.name) ?? 0),
      `campaign "${campaign.name}": reach says ${campaign.viewCount} but ${reachByTitle.get(campaign.name) ?? 0} notifications carry that title` +
        " (expected right after a seed — a broadcast sent from the panel under its own subject legitimately moves reach past this, so re-seed before reading it as a failure)",
    );
  }

  check(
    counts.subscribers > 0,
    "no newsletter subscribers — the audience screen would be empty",
  );

  // --- the customer panel has something in it -------------------------------
  const deliveredOrders = await prisma.order.count({
    where: { status: "DELIVERED" },
  });
  const multiSellerOrders = orders.filter((o) => o.subOrders.length > 1).length;
  const internalNotes = await prisma.ticketMessage.count({
    where: { isInternalNote: true },
  });

  console.log(
    `\nOrders: ${orders.length} (${deliveredOrders} delivered, ${multiSellerOrders} multi-seller), ${internalNotes} internal ticket note(s)`,
  );
  check(orders.length > 0, "no orders — the customer panel would be empty");
  check(
    deliveredOrders > 0,
    "no delivered orders — nothing would be reviewable",
  );
  check(
    multiSellerOrders > 0,
    "no multi-seller order — the SubOrder model would be untested by the data",
  );
  check(
    internalNotes > 0,
    "no internal ticket notes — the customer-visibility filter would be unproven",
  );

  /**
   * The demo baskets.
   *
   * Two things are being asserted. First that the bags exist at all: /cart and
   * /checkout were the only screens a reviewer reached empty. Second — and this
   * is the one that bites — that every line would render *clean*. A cart line is
   * a live pointer, not a snapshot, so `getCart` re-checks availability, MOQ and
   * the variant on every read; a line that fails any of them comes back as an
   * issue and blocks checkout. Seeding a broken line would be worse than seeding
   * nothing, and the way it breaks is silent: the products seed recreates
   * ProductVariant on every run, and CartItem.variantId has no foreign key.
   *
   * The rules below mirror src/lib/commerce/cart.ts deliberately rather than
   * importing it — that module is server-only and pulls in its own Prisma client.
   */
  const carts = await prisma.cartItem.findMany({
    select: {
      quantity: true,
      variantId: true,
      customer: { select: { user: { select: { email: true } } } },
      product: {
        select: {
          sku: true,
          status: true,
          minOrderQty: true,
          maxOrderQty: true,
          sellerId: true,
          seller: { select: { verificationStatus: true } },
          inventory: { select: { status: true, stockQty: true, reservedQty: true } },
          variants: { select: { id: true, stockQty: true } },
        },
      },
    },
  });

  const bags = new Map<string, { lines: number; sellers: Set<string> }>();
  for (const line of carts) {
    const email = line.customer.user.email;
    const bag = bags.get(email) ?? { lines: 0, sellers: new Set<string>() };
    bag.lines++;
    bag.sellers.add(line.product.sellerId);
    bags.set(email, bag);

    const p = line.product;
    const variant = line.variantId
      ? (p.variants.find((v) => v.id === line.variantId) ?? null)
      : null;
    const where = `${email}'s bag: ${p.sku}`;

    check(
      p.status === "APPROVED" && p.seller.verificationStatus === "APPROVED",
      `${where} is not publicly buyable, so the line renders as unavailable`,
    );
    check(
      !line.variantId || variant !== null,
      `${where} points at a variant that no longer exists — the line renders as unavailable`,
    );
    check(
      line.variantId !== "" || p.variants.length === 0,
      `${where} has variants but the cart line names none`,
    );
    check(
      line.quantity >= p.minOrderQty,
      `${where} is below its MOQ (${line.quantity} < ${p.minOrderQty}) and blocks checkout`,
    );
    check(
      line.quantity <= p.maxOrderQty,
      `${where} is above its per-order maximum (${line.quantity} > ${p.maxOrderQty})`,
    );

    const available = Math.min(
      Math.max(0, (p.inventory?.stockQty ?? 0) - (p.inventory?.reservedQty ?? 0)),
      variant ? variant.stockQty : Number.MAX_SAFE_INTEGER,
    );
    check(
      line.quantity <= available,
      `${where} asks for ${line.quantity} with ${available} available`,
    );
    check(
      p.inventory?.status !== "OUT_OF_STOCK" && p.inventory?.status !== "DISCONTINUED",
      `${where} is ${p.inventory?.status}`,
    );
  }

  /**
   * Saved items. No quantity to get wrong, but every card links to a product
   * page, so a saved row pointing at a withdrawn product is a dead link on a
   * screen the customer owns.
   */
  const wishlists = await prisma.wishlistItem.findMany({
    select: {
      customer: { select: { user: { select: { email: true } } } },
      product: {
        select: {
          sku: true,
          status: true,
          seller: { select: { verificationStatus: true } },
        },
      },
    },
  });
  const savedByEmail = new Map<string, number>();
  for (const item of wishlists) {
    const email = item.customer.user.email;
    savedByEmail.set(email, (savedByEmail.get(email) ?? 0) + 1);
    check(
      item.product.status === "APPROVED" &&
        item.product.seller.verificationStatus === "APPROVED",
      `${email}'s wishlist holds ${item.product.sku}, which is not publicly buyable — the card links to a 404`,
    );
  }

  console.log("\nDemo baskets");
  console.table(
    Object.fromEntries(
      [...bags].map(([email, bag]) => [
        email,
        { lines: bag.lines, sellers: bag.sellers.size, saved: savedByEmail.get(email) ?? 0 },
      ]),
    ),
  );

  for (const email of ["customer@saawariya.test", "wholesale@saawariya.test"]) {
    check(
      (bags.get(email)?.lines ?? 0) > 0,
      `${email} has an empty bag — /cart and /checkout would be unreachable for them`,
    );
    check(
      (savedByEmail.get(email) ?? 0) > 0,
      `${email} has an empty wishlist — /account/wishlist would render its empty state`,
    );
  }
  check(
    [...bags.values()].some((bag) => bag.sellers.size > 1),
    "no demo bag spans more than one seller — the cart's per-seller grouping would be invisible",
  );

  if (problems.length) {
    console.error(`\n${problems.length} problem(s):`);
    for (const p of problems) console.error("  - " + p);
    process.exitCode = 1;
  } else {
    console.log("\nAll checks passed.\n");
  }

  await prisma.$disconnect();
}

main();
