"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/dal";
import {
  addressSchema,
  fieldErrors,
  type ActionState,
} from "@/lib/validations/commerce";

/**
 * Address book — SRS §38.
 *
 * Addresses hang off User, not Customer, so the same code will serve sellers'
 * pickup addresses in Phase 5 without a second implementation.
 *
 * The one subtlety is defaults. `isDefaultShipping` and `isDefaultBilling` are
 * booleans on every row rather than a pointer on the customer, so "make this
 * the default" has to clear the flag everywhere else in the same transaction —
 * otherwise two rows claim it and which one wins depends on row order.
 */

export async function saveAddress(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = addressSchema.safeParse({
    id: formData.get("id") ?? undefined,
    label: formData.get("label"),
    fullName: formData.get("fullName"),
    mobile: formData.get("mobile"),
    line1: formData.get("line1"),
    line2: formData.get("line2") ?? undefined,
    landmark: formData.get("landmark") ?? undefined,
    city: formData.get("city"),
    state: formData.get("state"),
    pinCode: formData.get("pinCode"),
    isDefaultShipping: formData.get("isDefaultShipping") === "on",
    isDefaultBilling: formData.get("isDefaultBilling") === "on",
  });

  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error) };
  }

  const input = parsed.data;
  const existingCount = await prisma.address.count({ where: { userId: user.id } });

  // The first address a customer saves is their default whether they ticked the
  // box or not — otherwise checkout has addresses but no selection.
  const isFirst = existingCount === 0;
  const makeDefaultShipping = Boolean(input.isDefaultShipping) || isFirst;
  const makeDefaultBilling = Boolean(input.isDefaultBilling) || isFirst;

  const data = {
    label: input.label,
    fullName: input.fullName,
    mobile: input.mobile,
    line1: input.line1,
    line2: input.line2 || null,
    landmark: input.landmark || null,
    city: input.city,
    state: input.state,
    pinCode: input.pinCode,
    isDefaultShipping: makeDefaultShipping,
    isDefaultBilling: makeDefaultBilling,
  };

  if (input.id) {
    // Scoped update: an id belonging to someone else matches zero rows.
    const owned = await prisma.address.findFirst({
      where: { id: input.id, userId: user.id },
      select: { id: true },
    });
    if (!owned) return { status: "error", message: "Address not found." };
  }

  await prisma.$transaction(async (tx) => {
    if (makeDefaultShipping) {
      await tx.address.updateMany({
        where: { userId: user.id },
        data: { isDefaultShipping: false },
      });
    }
    if (makeDefaultBilling) {
      await tx.address.updateMany({
        where: { userId: user.id },
        data: { isDefaultBilling: false },
      });
    }

    if (input.id) {
      await tx.address.update({ where: { id: input.id }, data });
    } else {
      await tx.address.create({ data: { ...data, userId: user.id } });
    }
  });

  revalidatePath("/account/addresses");
  revalidatePath("/checkout");

  return {
    status: "success",
    message: input.id ? "Address updated." : "Address saved.",
  };
}

export async function deleteAddress(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return { status: "error", message: "Address not found." };

  const address = await prisma.address.findFirst({
    where: { id, userId: user.id },
    select: { id: true, isDefaultShipping: true, isDefaultBilling: true },
  });
  if (!address) return { status: "error", message: "Address not found." };

  await prisma.$transaction(async (tx) => {
    await tx.address.delete({ where: { id: address.id } });

    // Deleting the default leaves the account with none. Promote the oldest
    // remaining address rather than leaving checkout with nothing selected.
    if (address.isDefaultShipping || address.isDefaultBilling) {
      const next = await tx.address.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      if (next) {
        await tx.address.update({
          where: { id: next.id },
          data: {
            isDefaultShipping: address.isDefaultShipping || undefined,
            isDefaultBilling: address.isDefaultBilling || undefined,
          },
        });
      }
    }
  });

  revalidatePath("/account/addresses");
  revalidatePath("/checkout");

  return { status: "success", message: "Address removed." };
}

export async function setDefaultAddress(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const kind = String(formData.get("kind") ?? "shipping");

  const address = await prisma.address.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!address) return { status: "error", message: "Address not found." };

  const field = kind === "billing" ? "isDefaultBilling" : "isDefaultShipping";

  await prisma.$transaction([
    prisma.address.updateMany({
      where: { userId: user.id },
      data: { [field]: false },
    }),
    prisma.address.update({
      where: { id: address.id },
      data: { [field]: true },
    }),
  ]);

  revalidatePath("/account/addresses");
  revalidatePath("/checkout");

  return {
    status: "success",
    message: `Default ${kind} address updated.`,
  };
}
