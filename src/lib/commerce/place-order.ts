import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { getCart, availableFor } from "@/lib/commerce/cart";
import { getCommerceSettings } from "@/lib/commerce/settings";
import { validateCoupon } from "@/lib/commerce/coupons";
import { apportion, computeTotals, type AppliedCoupon } from "@/lib/commerce/totals";
import { deriveOrderStatus } from "@/lib/fulfilment/order-rollup";
import {
  ORDER_STATUS,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  SUB_ORDER_STATUS,
  type PaymentMethod,
  type PriceTier,
} from "@/lib/constants";
import { formatPaise } from "@/lib/utils";

/**
 * Placing an order — the one write in this application that must be all or
 * nothing.
 *
 * It creates an Order, one SubOrder per seller, the OrderItems, a Payment, the
 * opening OrderEvents, the stock reservations and the notifications, then
 * empties the cart. Any of those succeeding without the others leaves the
 * marketplace in a state no screen can explain: stock reserved against an order
 * that does not exist, or an order nobody is fulfilling. So it all happens in
 * one interactive transaction.
 *
 * Three things are worth knowing before changing this file:
 *
 *  1. Everything is re-validated inside the transaction. The cart page checked
 *     stock a minute ago; between then and now another customer may have taken
 *     the last piece. The check that counts is the one holding the write lock.
 *
 *  2. Double submission is stopped by Payment.idempotencyKey, which is UNIQUE.
 *     The Payment is written inside the same transaction as the Order, so a
 *     second submit of the same checkout form fails on that constraint and
 *     rolls the whole duplicate order back rather than charging twice.
 *
 *  3. There is no payment gateway. This is a demo build; online payments are
 *     recorded as successful with a clearly synthetic reference, and the
 *     checkout UI says so. The alternative — a fake gateway screen — would be
 *     the sort of thing this build has ruled out.
 */

export type PlaceOrderInput = {
  userId: string;
  customerId: string;
  customerType: string;
  tier: PriceTier;
  addressId: string;
  billingAddressId: string | null;
  paymentMethod: PaymentMethod;
  couponCode: string | null;
  idempotencyKey: string;
  customerNote?: string | null;
};

export type PlaceOrderResult =
  | { ok: true; orderNumber: string; orderId: string }
  | { ok: false; error: string };

class OrderError extends Error {}

/** The client handed to the `$transaction` callback. */
type TransactionClient = Prisma.TransactionClient;

export async function placeOrder(
  input: PlaceOrderInput,
): Promise<PlaceOrderResult> {
  const settings = await getCommerceSettings();

  // ---- Validate the cart -------------------------------------------------
  const cart = await getCart(input.customerId, input.tier);
  if (cart.lines.length === 0) {
    return { ok: false, error: "Your bag is empty." };
  }
  if (!cart.isCheckoutable) {
    return {
      ok: false,
      error:
        "Some items in your bag need attention before you can check out. Review your bag and try again.",
    };
  }

  // ---- Validate the address ---------------------------------------------
  const [shipping, billing] = await Promise.all([
    prisma.address.findFirst({
      where: { id: input.addressId, userId: input.userId },
    }),
    input.billingAddressId
      ? prisma.address.findFirst({
          where: { id: input.billingAddressId, userId: input.userId },
        })
      : Promise.resolve(null),
  ]);

  if (!shipping) {
    return { ok: false, error: "Choose a delivery address." };
  }
  if (input.billingAddressId && !billing) {
    return { ok: false, error: "Choose a valid billing address." };
  }

  // ---- Validate the coupon ----------------------------------------------
  let coupon: AppliedCoupon | null = null;
  if (input.couponCode) {
    const check = await validateCoupon(input.couponCode, {
      customerId: input.customerId,
      customerType: input.customerType,
      subtotal: cart.subtotal,
    });
    if (!check.ok) return { ok: false, error: check.error };
    coupon = check.coupon;
  }

  const totals = computeTotals(cart.subtotal, coupon, settings);

  // ---- Validate the payment method --------------------------------------
  if (input.paymentMethod === PAYMENT_METHOD.COD) {
    if (!settings.codEnabled) {
      return { ok: false, error: "Cash on delivery is not available." };
    }
    if (totals.totalAmount > settings.codMaxOrderPaise) {
      return {
        ok: false,
        error: `Cash on delivery is available on orders up to ${formatPaise(settings.codMaxOrderPaise)}. Choose another payment method.`,
      };
    }
  }

  // ---- Shape the sub-orders ---------------------------------------------
  // Order of groups is fixed here and reused for every apportionment, so the
  // shipping split and the discount split line up with the same seller.
  const groups = cart.groups;
  const weights = groups.map((group) => group.subtotal);
  const shippingSplit = apportion(totals.shippingAmount, weights);
  const discountSplit = apportion(totals.discountAmount, weights);

  try {
    const result = await prisma.$transaction(async (tx) => {
      // ---- Re-check stock under the write lock ---------------------------
      for (const line of cart.lines) {
        const product = await tx.product.findUnique({
          where: { id: line.productId },
          select: {
            name: true,
            inventory: { select: { stockQty: true, reservedQty: true } },
            variants: {
              where: { id: line.variantId ?? "" },
              select: { stockQty: true },
            },
          },
        });

        if (!product) {
          throw new OrderError(
            `${line.name} is no longer available. Remove it from your bag.`,
          );
        }

        const variant = line.variantId ? (product.variants[0] ?? null) : null;
        if (line.variantId && !variant) {
          throw new OrderError(
            `The selected option for ${line.name} is no longer available.`,
          );
        }

        const available = availableFor(product.inventory, variant);
        if (available < line.quantity) {
          throw new OrderError(
            available === 0
              ? `${line.name} sold out while you were checking out.`
              : `Only ${available} of ${line.name} left. Reduce the quantity in your bag.`,
          );
        }
      }

      const orderNumber = await nextOrderNumber(tx);

      const order = await tx.order.create({
        data: {
          orderNumber,
          customerId: input.customerId,
          /**
           * Derived from the sub-orders about to be created — every one of them
           * PLACED — which makes this PENDING, "waiting on a seller".
           *
           * It used to be written as CONFIRMED, meaning "the payment went
           * through". That is `Payment.status`, and the two meanings collided:
           * `Order.status` is a *summary of fulfilment*, recomputed by
           * `deriveOrderStatus` on every later move, and that function can never
           * return CONFIRMED. So a freshly placed order sat in a status nothing
           * else in the system produced — invisible in the admin console's
           * "Awaiting seller" tab, which filters on PENDING — until a seller
           * touched it and the roll-up corrected it. Found in Phase 7 when the
           * rule was extracted for the seed to share.
           */
          status: deriveOrderStatus(groups.map(() => SUB_ORDER_STATUS.PLACED)),
          subtotal: totals.subtotal,
          discountAmount: totals.discountAmount,
          shippingAmount: totals.shippingAmount,
          taxAmount: totals.taxAmount,
          totalAmount: totals.totalAmount,
          couponCode: coupon?.code ?? null,
          // Snapshots. The order must not change when the customer later edits
          // or deletes the address it was shipped to.
          shipShippingName: shipping.fullName,
          shipMobile: shipping.mobile,
          shipLine1: shipping.line1,
          shipLine2: [shipping.line2, shipping.landmark]
            .filter(Boolean)
            .join(", ") || null,
          shipCity: shipping.city,
          shipState: shipping.state,
          shipPinCode: shipping.pinCode,
          shipCountry: shipping.country,
          billingSameAsShip: billing === null,
          billingJson: billing ? JSON.stringify(billing) : null,
        },
        select: { id: true, orderNumber: true },
      });

      // ---- One SubOrder per seller ---------------------------------------
      for (const [index, group] of groups.entries()) {
        const subShipping = shippingSplit[index];
        const subDiscount = discountSplit[index];

        const subOrder = await tx.subOrder.create({
          data: {
            subOrderNumber: `${order.orderNumber}-${suffixFor(index)}`,
            orderId: order.id,
            sellerId: group.sellerId,
            status: "PLACED",
            subtotal: group.subtotal,
            discountAmount: subDiscount,
            shippingAmount: subShipping,
            totalAmount: group.subtotal - subDiscount + subShipping,
            items: {
              create: group.lines.map((line) => ({
                productId: line.productId,
                variantId: line.variantId,
                productName: line.name,
                productSku: line.sku,
                imageUrl: line.imageUrl,
                unitPrice: line.unitPrice,
                priceTier: line.price.tier,
                quantity: line.quantity,
                lineTotal: line.lineTotal,
              })),
            },
          },
          select: { id: true, subOrderNumber: true },
        });

        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            subOrderId: subOrder.id,
            toStatus: "PLACED",
            actorUserId: input.userId,
            actorRole: "CUSTOMER",
            note: `Order placed with ${group.businessName}.`,
          },
        });

        // ---- Reserve stock ------------------------------------------------
        for (const line of group.lines) {
          const inventory = await tx.inventory.findUnique({
            where: { productId: line.productId },
            select: { id: true },
          });
          if (!inventory) continue;

          await tx.inventory.update({
            where: { id: inventory.id },
            data: { reservedQty: { increment: line.quantity } },
          });

          // Append-only ledger. Stock does not LEAVE until dispatch (Phase 7);
          // it is held, so changeQty is 0 and the reservation is the event.
          await tx.stockMovement.create({
            data: {
              inventoryId: inventory.id,
              changeQty: 0,
              reason: "ORDER_RESERVED",
              referenceId: subOrder.id,
              note: `${line.quantity} × ${line.sku} reserved for ${subOrder.subOrderNumber}`,
            },
          });
        }

        // Sellers are told there is work waiting — the seller panel (Phase 5)
        // reads these, and an order nobody was told about never ships.
        const sellerUser = await tx.seller.findUnique({
          where: { id: group.sellerId },
          select: { userId: true },
        });
        if (sellerUser) {
          await tx.notification.create({
            data: {
              userId: sellerUser.userId,
              title: `New order ${subOrder.subOrderNumber}`,
              body: `${group.lines.length} item${group.lines.length === 1 ? "" : "s"} — ${formatPaise(group.subtotal)}. Confirm and prepare for dispatch.`,
              category: "ORDER",
              linkUrl: `/seller/orders/${subOrder.subOrderNumber}`,
            },
          });
        }
      }

      // ---- Payment --------------------------------------------------------
      const isCod = input.paymentMethod === PAYMENT_METHOD.COD;
      await tx.payment.create({
        data: {
          orderId: order.id,
          method: input.paymentMethod,
          amount: totals.totalAmount,
          status: isCod ? PAYMENT_STATUS.PENDING : PAYMENT_STATUS.SUCCESS,
          // "SIM" is deliberate and visible in the admin finance screens: no
          // reference in this database should ever be mistaken for a real one.
          gatewayRef: isCod ? null : `SIM-${order.orderNumber}`,
          idempotencyKey: input.idempotencyKey,
          paidAt: isCod ? null : new Date(),
        },
      });

      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          toStatus: ORDER_STATUS.CONFIRMED,
          actorUserId: input.userId,
          actorRole: "CUSTOMER",
          note: isCod
            ? "Order confirmed. Payment due on delivery."
            : "Order confirmed. Payment received.",
        },
      });

      // ---- Counters -------------------------------------------------------
      if (coupon) {
        await tx.coupon.update({
          where: { code: coupon.code },
          data: { usageCount: { increment: 1 } },
        });
      }

      for (const line of cart.lines) {
        await tx.product.update({
          where: { id: line.productId },
          data: { salesCount: { increment: line.quantity } },
        });
      }

      await tx.notification.create({
        data: {
          userId: input.userId,
          title: `Order ${order.orderNumber} confirmed`,
          body: `We have your order for ${formatPaise(totals.totalAmount)}. We will let you know as soon as it is dispatched.`,
          category: "ORDER",
          linkUrl: `/account/orders/${order.orderNumber}`,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: input.userId,
          action: "ORDER_PLACED",
          entityType: "Order",
          entityId: order.id,
          summary: `Order ${order.orderNumber} placed — ${formatPaise(totals.totalAmount)} across ${groups.length} seller${groups.length === 1 ? "" : "s"}`,
        },
      });

      // ---- Empty the bag ---------------------------------------------------
      await tx.cartItem.deleteMany({ where: { customerId: input.customerId } });

      return { orderId: order.id, orderNumber: order.orderNumber };
    });

    return { ok: true, ...result };
  } catch (error) {
    if (error instanceof OrderError) {
      return { ok: false, error: error.message };
    }
    // A unique-constraint failure here is the double-submit case: the first
    // submission already created this order, so this is not an error state the
    // customer needs to see as a failure.
    if (isUniqueViolation(error)) {
      const existing = await prisma.payment.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        select: { order: { select: { id: true, orderNumber: true } } },
      });
      if (existing?.order) {
        return {
          ok: true,
          orderId: existing.order.id,
          orderNumber: existing.order.orderNumber,
        };
      }
    }

    console.error("placeOrder failed", error);
    return {
      ok: false,
      error: "We could not place your order. Nothing has been charged — please try again.",
    };
  }
}

/**
 * SAAW-2026-000123.
 *
 * Derived from the highest number already issued this year rather than from a
 * row count, so a deleted order cannot cause a duplicate. Called inside the
 * transaction, and `Order.orderNumber` is UNIQUE, so the worst a race can do is
 * fail the transaction rather than issue the same number twice.
 */
async function nextOrderNumber(tx: TransactionClient): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `SAAW-${year}-`;

  const latest = await tx.order.findFirst({
    where: { orderNumber: { startsWith: prefix } },
    orderBy: { orderNumber: "desc" },
    select: { orderNumber: true },
  });

  const lastSequence = latest
    ? Number.parseInt(latest.orderNumber.slice(prefix.length), 10)
    : 0;

  const next = (Number.isFinite(lastSequence) ? lastSequence : 0) + 1;
  return `${prefix}${String(next).padStart(6, "0")}`;
}

/** -A, -B ... -Z, then -AA. A cart spanning 26 sellers is not expected. */
function suffixFor(index: number): string {
  let value = index;
  let suffix = "";
  do {
    suffix = String.fromCharCode(65 + (value % 26)) + suffix;
    value = Math.floor(value / 26) - 1;
  } while (value >= 0);
  return suffix;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}
