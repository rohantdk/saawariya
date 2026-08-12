"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/dal";
import { getCustomerContext } from "@/lib/commerce/context";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { CUSTOMER_TYPE } from "@/lib/constants";
import {
  fieldErrors,
  passwordChangeSchema,
  profileSchema,
  wholesaleUpgradeSchema,
  type ActionState,
} from "@/lib/validations/commerce";

/**
 * Profile, password, notifications and the wholesale upgrade — SRS §38, §50.
 */

// ---------------------------------------------------------------------------
// PROFILE
// ---------------------------------------------------------------------------

export async function updateProfile(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = profileSchema.safeParse({
    fullName: formData.get("fullName"),
    mobile: formData.get("mobile"),
    dateOfBirth: formData.get("dateOfBirth") ?? undefined,
    preferredLang: formData.get("preferredLang") ?? undefined,
  });

  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error) };
  }

  const { fullName, mobile, dateOfBirth, preferredLang } = parsed.data;

  // User.mobile is UNIQUE, so a clash has to be reported as a field error
  // rather than allowed to surface as a raw constraint violation.
  if (mobile !== user.mobile) {
    const taken = await prisma.user.findFirst({
      where: { mobile, id: { not: user.id } },
      select: { id: true },
    });
    if (taken) {
      return {
        status: "error",
        errors: { mobile: ["Another account already uses this number."] },
      };
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      fullName,
      mobile,
      // Changing the number invalidates the verification that was done against
      // the old one. Phase 1 already models this; leaving it true would be a
      // quiet security regression.
      mobileVerified: mobile === user.mobile ? undefined : false,
      customer: {
        update: {
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
          preferredLang: preferredLang ?? "en",
        },
      },
    },
  });

  revalidatePath("/account/settings");
  revalidatePath("/account", "layout");

  return { status: "success", message: "Your details have been updated." };
}

// ---------------------------------------------------------------------------
// PASSWORD
// ---------------------------------------------------------------------------

export async function changePassword(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = passwordChangeSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error) };
  }

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!record) return { status: "error", message: "Account not found." };

  const valid = await verifyPassword(
    parsed.data.currentPassword,
    record.passwordHash,
  );
  if (!valid) {
    return {
      status: "error",
      errors: { currentPassword: ["That is not your current password."] },
    };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data.newPassword) },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "PASSWORD_CHANGED",
      entityType: "User",
      entityId: user.id,
      summary: "User changed their password",
    },
  });

  await prisma.notification.create({
    data: {
      userId: user.id,
      title: "Your password was changed",
      body: "If this was not you, contact Saawariya support immediately.",
      category: "SYSTEM",
      linkUrl: "/account/settings",
    },
  });

  return { status: "success", message: "Your password has been changed." };
}

// ---------------------------------------------------------------------------
// WHOLESALE
// ---------------------------------------------------------------------------

/**
 * Retail → wholesale.
 *
 * A tier, not a role — retail and wholesale customers hold identical
 * permissions and differ only in pricing, MOQ and GST (see docs/ROLES.md). So
 * this writes `Customer.customerType` and nothing touches the RBAC matrix.
 */
export async function upgradeToWholesale(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getCustomerContext();
  if (!context) return { status: "error", message: "Sign in to continue." };

  const parsed = wholesaleUpgradeSchema.safeParse({
    gstNumber: formData.get("gstNumber"),
  });

  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error) };
  }

  await prisma.customer.update({
    where: { id: context.customerId },
    data: {
      customerType: CUSTOMER_TYPE.WHOLESALE,
      gstNumber: parsed.data.gstNumber,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: context.userId,
      action: "CUSTOMER_TIER_CHANGED",
      entityType: "Customer",
      entityId: context.customerId,
      summary: `Customer upgraded to WHOLESALE (GSTIN ${parsed.data.gstNumber})`,
    },
  });

  // Trade prices and MOQs now apply everywhere, including anything already in
  // the bag, so the whole tree has to be revalidated.
  revalidatePath("/", "layout");

  return {
    status: "success",
    message:
      "Trade pricing is now active on your account. Minimum order quantities apply on some pieces.",
  };
}

// ---------------------------------------------------------------------------
// NOTIFICATIONS
// ---------------------------------------------------------------------------

/**
 * Notifications are keyed on `userId`, not on customer or seller, so one pair of
 * actions serves every panel. Both panels therefore have to be revalidated: the
 * unread count is a sidebar badge in each, and revalidating only `/account`
 * left a seller's badge showing a number they had just cleared. Revalidating a
 * path the caller is not currently on costs nothing.
 */
function revalidateNotificationViews() {
  revalidatePath("/account/notifications");
  revalidatePath("/account", "layout");
  revalidatePath("/seller/notifications");
  revalidatePath("/seller", "layout");
}

export async function markNotificationRead(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const id = String(formData.get("notificationId") ?? "");

  await prisma.notification.updateMany({
    where: { id, userId: user.id, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });

  revalidateNotificationViews();
  return { status: "success" };
}

export async function markAllNotificationsRead(): Promise<ActionState> {
  const user = await requireUser();

  await prisma.notification.updateMany({
    where: { userId: user.id, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });

  revalidateNotificationViews();
  return { status: "success", message: "All caught up." };
}
