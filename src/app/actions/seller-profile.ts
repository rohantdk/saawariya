"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/dal";
import { sellerProfileSchema } from "@/lib/validations/seller";
import { fieldErrors, type ActionState } from "@/lib/validations/commerce";
import {
  DEFAULT_COMMISSION_PERCENT,
  ROLES,
  SELLER_VERIFICATION,
} from "@/lib/constants";

/**
 * Seller onboarding and business profile — SRS §54, §57.
 *
 * Gated on the SELLER *role* rather than on `requireSeller()`, because the whole
 * point of these two actions is to serve a seller who has no Seller row yet or
 * whose verification has not come through. The approved-only context would lock
 * them out of the one screen that could unlock them.
 */

function readProfileForm(formData: FormData) {
  return sellerProfileSchema.safeParse({
    businessName: formData.get("businessName"),
    ownerName: formData.get("ownerName"),
    businessType: formData.get("businessType"),
    description: formData.get("description") ?? undefined,
    gstNumber: formData.get("gstNumber") ?? undefined,
    panNumber: formData.get("panNumber") ?? undefined,
    addressLine: formData.get("addressLine") ?? undefined,
    city: formData.get("city") ?? undefined,
    state: formData.get("state") ?? undefined,
    pinCode: formData.get("pinCode") ?? undefined,
    pickupAddress: formData.get("pickupAddress") ?? undefined,
    bankAccountName: formData.get("bankAccountName") ?? undefined,
    bankAccountNumber: formData.get("bankAccountNumber") ?? undefined,
    bankIfsc: formData.get("bankIfsc") ?? undefined,
  });
}

/**
 * Creates the Seller row on first submission, updates it thereafter.
 *
 * One rule enforced here that the form cannot enforce for itself: **a seller
 * cannot change their own verification status or commission rate.** Both are
 * absent from the schema and never written from this action, so a crafted POST
 * carrying `verificationStatus=APPROVED` does nothing. Approval is an admin
 * action (SRS §75) and commission is a commercial term (SRS §119).
 */
export async function saveSellerProfile(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRole([ROLES.SELLER]);

  const parsed = readProfileForm(formData);
  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error) };
  }
  const input = parsed.data;

  const existing = await prisma.seller.findUnique({
    where: { userId: user.id },
    select: { id: true, verificationStatus: true },
  });

  if (!existing) {
    await prisma.seller.create({
      data: {
        userId: user.id,
        businessName: input.businessName,
        ownerName: input.ownerName,
        businessType: input.businessType,
        description: input.description,
        gstNumber: input.gstNumber,
        panNumber: input.panNumber,
        addressLine: input.addressLine || null,
        city: input.city || null,
        state: input.state,
        pinCode: input.pinCode,
        pickupAddress: input.pickupAddress,
        bankAccountName: input.bankAccountName,
        bankAccountNumber: input.bankAccountNumber,
        bankIfsc: input.bankIfsc,
        verificationStatus: SELLER_VERIFICATION.PENDING,
        commissionPercent: DEFAULT_COMMISSION_PERCENT,
      },
    });

    revalidatePath("/seller/pending");
    return {
      status: "success",
      message: "Application submitted. Our team will verify your details.",
    };
  }

  /**
   * Editing a rejected application puts it back in the queue. Leaving it
   * REJECTED would mean a seller could fix everything asked of them and still
   * never be looked at again — the reviewer has no signal that anything changed.
   * An approved seller editing their address does *not* lose their approval.
   */
  const returnsToQueue =
    existing.verificationStatus === SELLER_VERIFICATION.REJECTED;

  await prisma.seller.update({
    where: { id: existing.id },
    data: {
      businessName: input.businessName,
      ownerName: input.ownerName,
      businessType: input.businessType,
      description: input.description,
      gstNumber: input.gstNumber,
      panNumber: input.panNumber,
      addressLine: input.addressLine || null,
      city: input.city || null,
      state: input.state,
      pinCode: input.pinCode,
      pickupAddress: input.pickupAddress,
      bankAccountName: input.bankAccountName,
      bankAccountNumber: input.bankAccountNumber,
      bankIfsc: input.bankIfsc,
      ...(returnsToQueue
        ? {
            verificationStatus: SELLER_VERIFICATION.PENDING,
            verificationNote: null,
          }
        : {}),
    },
  });

  revalidatePath("/seller/profile");
  revalidatePath("/seller/pending");

  return {
    status: "success",
    message: returnsToQueue
      ? "Details updated and resubmitted for verification."
      : "Business details updated.",
  };
}
