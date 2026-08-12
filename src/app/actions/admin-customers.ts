"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminAction } from "@/lib/admin/context";
import { AUDIT_ACTIONS, writeAudit } from "@/lib/admin/audit";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  customerStatusSchema,
  customerTierSchema,
} from "@/lib/validations/admin";
import { fieldErrors, type ActionState } from "@/lib/validations/commerce";
import { CUSTOMER_TYPE, ROLES, USER_STATUS } from "@/lib/constants";

/**
 * Customer administration — SRS §73.
 *
 * Suspension writes `User.status`, which is the column `getCurrentUser()`
 * checks on every request, so a suspended customer loses access on their next
 * page load rather than at their next sign-in. That is the whole point of the
 * DAL re-reading the database instead of trusting the session cookie, and this
 * is the action that makes it matter.
 */

async function loadCustomerUser(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      fullName: true,
      email: true,
      roleCode: true,
      status: true,
      customer: { select: { id: true } },
    },
  });
}

function revalidateCustomer(customerId: string) {
  revalidatePath("/admin/customers");
  revalidatePath(`/admin/customers/${customerId}`);
}

export async function setCustomerStatus(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireAdminAction(PERMISSIONS.CUSTOMER_MANAGE);
  if (!auth.ok) return { status: "error", message: auth.error };

  const parsed = customerStatusSchema.safeParse({
    userId: formData.get("userId"),
    action: formData.get("action"),
    reason: formData.get("reason") ?? undefined,
  });
  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error) };
  }

  const user = await loadCustomerUser(parsed.data.userId);
  if (!user?.customer) {
    return { status: "error", message: "Customer not found." };
  }

  /**
   * This action is reachable directly, and `CUSTOMER_MANAGE` is not "manage
   * every account". Without this check a posted admin id would suspend an
   * administrator through a screen that only ever lists customers. Staff
   * accounts are managed in Roles & access, not here.
   */
  if (user.roleCode !== ROLES.CUSTOMER) {
    return {
      status: "error",
      message: "That account is not a customer account.",
    };
  }

  const suspending = parsed.data.action === "SUSPEND";
  const reason = parsed.data.reason?.trim() || null;

  if (suspending && !reason) {
    return {
      status: "error",
      errors: { reason: ["Say why this account is being suspended."] },
    };
  }

  const nextStatus = suspending ? USER_STATUS.SUSPENDED : USER_STATUS.ACTIVE;
  if (user.status === nextStatus) {
    return {
      status: "error",
      message: suspending
        ? "That account is already suspended."
        : "That account is already active.",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { status: nextStatus },
    });

    // Written whether or not they can read it right now: a reinstated customer
    // sees the history, and the row is the record that they were told.
    await tx.notification.create({
      data: {
        userId: user.id,
        title: suspending
          ? "Your account has been suspended"
          : "Your account has been reinstated",
        body: suspending
          ? (reason as string)
          : "You can sign in and shop as usual again.",
        category: "SYSTEM",
        linkUrl: "/account",
      },
    });

    await writeAudit(
      {
        userId: auth.admin.userId,
        action: suspending
          ? AUDIT_ACTIONS.CUSTOMER_SUSPENDED
          : AUDIT_ACTIONS.CUSTOMER_REINSTATED,
        entityType: "User",
        entityId: user.id,
        summary: `Customer ${user.fullName} (${user.email}) ${
          suspending ? `suspended — ${reason}` : "reinstated"
        }`,
        meta: { customerId: user.customer!.id, from: user.status },
      },
      tx,
    );
  });

  revalidateCustomer(user.customer.id);

  return {
    status: "success",
    message: suspending
      ? "Suspended. They lose access on their next request, not at their next sign-in."
      : "Reinstated.",
  };
}

/**
 * Move a customer between the retail and wholesale tiers — SRS §14.
 *
 * The tier is not a role: retail and wholesale hold identical permissions and
 * differ only in pricing, MOQ and GST treatment (see docs/ROLES.md). So this
 * writes `Customer.customerType` and nothing else — and the change is visible
 * immediately, because `resolvePrice()` reads the tier per request.
 *
 * A GSTIN is required going up, because wholesale pricing is a B2B tax
 * position rather than a discount. It is deliberately **kept** on the way down:
 * a customer demoted by mistake should not have to re-enter it.
 */
export async function setCustomerTier(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireAdminAction(PERMISSIONS.CUSTOMER_MANAGE);
  if (!auth.ok) return { status: "error", message: auth.error };

  const parsed = customerTierSchema.safeParse({
    customerId: formData.get("customerId"),
    customerType: formData.get("customerType"),
    gstNumber: formData.get("gstNumber") ?? undefined,
  });
  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error) };
  }

  const customer = await prisma.customer.findUnique({
    where: { id: parsed.data.customerId },
    select: {
      id: true,
      customerType: true,
      gstNumber: true,
      user: { select: { id: true, fullName: true } },
    },
  });
  if (!customer) return { status: "error", message: "Customer not found." };

  const goingWholesale = parsed.data.customerType === CUSTOMER_TYPE.WHOLESALE;
  const gstNumber = parsed.data.gstNumber ?? customer.gstNumber;

  if (goingWholesale) {
    if (!gstNumber) {
      return {
        status: "error",
        errors: { gstNumber: ["A wholesale account needs a GSTIN."] },
      };
    }
    if (!/^\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z][A-Z\d]$/.test(gstNumber)) {
      return {
        status: "error",
        errors: { gstNumber: ["Enter a valid 15-character GSTIN."] },
      };
    }
  }

  if (customer.customerType === parsed.data.customerType && !parsed.data.gstNumber) {
    return { status: "error", message: "That is already their tier." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.customer.update({
      where: { id: customer.id },
      data: { customerType: parsed.data.customerType, gstNumber },
    });

    await tx.notification.create({
      data: {
        userId: customer.user.id,
        title: goingWholesale
          ? "Wholesale pricing enabled"
          : "Your account is now a retail account",
        body: goingWholesale
          ? "You now see wholesale prices and minimum order quantities across the catalogue."
          : "Your account has been moved back to retail pricing.",
        category: "SYSTEM",
        linkUrl: "/account/settings",
      },
    });

    await writeAudit(
      {
        userId: auth.admin.userId,
        action: AUDIT_ACTIONS.CUSTOMER_TIER_CHANGED,
        entityType: "Customer",
        entityId: customer.id,
        summary: `${customer.user.fullName} moved from ${customer.customerType} to ${parsed.data.customerType}${
          goingWholesale ? ` (GSTIN ${gstNumber})` : ""
        }`,
        meta: { from: customer.customerType, to: parsed.data.customerType },
      },
      tx,
    );
  });

  revalidateCustomer(customer.id);

  return {
    status: "success",
    message: goingWholesale
      ? "Wholesale pricing and MOQs now apply to this account."
      : "Moved to retail pricing.",
  };
}
