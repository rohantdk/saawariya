import "server-only";
import { prisma } from "@/lib/prisma";
import { CUSTOMER_TYPE, ORDER_STATUS } from "@/lib/constants";
import { computeDiscount, type AppliedCoupon } from "@/lib/commerce/totals";
import { formatPaise } from "@/lib/utils";

/**
 * Coupon validation — SRS §43, §125.
 *
 * Every rule the Coupon row can express is checked here, on the server, at the
 * moment the order is written as well as when the code is typed. A coupon that
 * was valid when it was applied and expired while the customer filled in their
 * address must not survive to the order, so checkout re-validates rather than
 * trusting what the cart said.
 *
 * Failures return a reason the shopper can act on. "Invalid coupon" for six
 * different causes is the sort of thing that generates support tickets.
 */

export type CouponCheck =
  | { ok: true; coupon: AppliedCoupon; discount: number; message: string }
  | { ok: false; error: string };

export async function validateCoupon(
  rawCode: string,
  context: {
    customerId: string;
    customerType: string;
    subtotal: number;
  },
): Promise<CouponCheck> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, error: "Enter a coupon code." };

  const coupon = await prisma.coupon.findUnique({ where: { code } });

  if (!coupon || !coupon.isActive) {
    return { ok: false, error: `“${code}” is not a valid coupon code.` };
  }

  const now = new Date();
  if (coupon.startsAt > now) {
    return { ok: false, error: `“${code}” is not active yet.` };
  }
  if (coupon.endsAt < now) {
    return { ok: false, error: `“${code}” has expired.` };
  }

  if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) {
    return { ok: false, error: `“${code}” has been fully redeemed.` };
  }

  if (context.subtotal < coupon.minOrderValue) {
    return {
      ok: false,
      error: `“${code}” applies to orders over ${formatPaise(coupon.minOrderValue)}. Add ${formatPaise(coupon.minOrderValue - context.subtotal)} more to use it.`,
    };
  }

  const eligibility = await checkEligibility(coupon.eligibility, context);
  if (!eligibility.ok) return eligibility;

  // Per-customer limit counts orders that survived — a cancelled order gives
  // the customer their use back, which is what a shopper expects.
  const used = await prisma.order.count({
    where: {
      customerId: context.customerId,
      couponCode: code,
      status: { not: ORDER_STATUS.CANCELLED },
    },
  });

  if (used >= coupon.perCustomerLimit) {
    return {
      ok: false,
      error:
        coupon.perCustomerLimit === 1
          ? `You have already used “${code}”.`
          : `“${code}” can only be used ${coupon.perCustomerLimit} times per account.`,
    };
  }

  const applied: AppliedCoupon = {
    code: coupon.code,
    discountType: coupon.discountType as AppliedCoupon["discountType"],
    discountValue: coupon.discountValue,
    maxDiscount: coupon.maxDiscount,
  };

  const discount = computeDiscount(context.subtotal, applied);

  return {
    ok: true,
    coupon: applied,
    discount,
    message:
      applied.discountType === "FREE_SHIPPING"
        ? `“${code}” applied — free shipping.`
        : `“${code}” applied — you saved ${formatPaise(discount)}.`,
  };
}

async function checkEligibility(
  eligibility: string,
  context: { customerId: string; customerType: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  switch (eligibility) {
    case "WHOLESALE":
      return context.customerType === CUSTOMER_TYPE.WHOLESALE
        ? { ok: true }
        : {
            ok: false,
            error: "This code is for registered wholesale accounts only.",
          };

    case "NEW_CUSTOMERS": {
      const previous = await prisma.order.count({
        where: {
          customerId: context.customerId,
          status: { not: ORDER_STATUS.CANCELLED },
        },
      });
      return previous === 0
        ? { ok: true }
        : { ok: false, error: "This code is for first orders only." };
    }

    case "RETURNING": {
      const previous = await prisma.order.count({
        where: {
          customerId: context.customerId,
          status: { not: ORDER_STATUS.CANCELLED },
        },
      });
      return previous > 0
        ? { ok: true }
        : {
            ok: false,
            error: "This code unlocks after your first order.",
          };
    }

    default:
      return { ok: true };
  }
}

/** Coupons a signed-in customer could plausibly use, for the cart's hint list. */
export async function getOfferableCoupons(customerType: string) {
  const now = new Date();
  return prisma.coupon.findMany({
    where: {
      isActive: true,
      startsAt: { lte: now },
      endsAt: { gte: now },
      eligibility:
        customerType === CUSTOMER_TYPE.WHOLESALE
          ? { in: ["ALL", "WHOLESALE", "NEW_CUSTOMERS", "RETURNING"] }
          : { in: ["ALL", "NEW_CUSTOMERS", "RETURNING"] },
    },
    orderBy: { minOrderValue: "asc" },
    select: {
      code: true,
      discountType: true,
      discountValue: true,
      minOrderValue: true,
      maxDiscount: true,
      eligibility: true,
      endsAt: true,
    },
  });
}
