"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCustomerContext } from "@/lib/commerce/context";
import { placeOrder } from "@/lib/commerce/place-order";
import {
  checkoutSchema,
  fieldErrors,
  type ActionState,
} from "@/lib/validations/commerce";
import type { PaymentMethod } from "@/lib/constants";

/**
 * The checkout submit — SRS §43, §44.
 *
 * Thin on purpose. Everything that decides whether an order can exist lives in
 * src/lib/commerce/place-order.ts, because the seller panel and any future
 * admin "place order on behalf of" need the same rules and must not get a
 * second, drifting copy of them. This function's whole job is to authenticate,
 * shape the form, and turn the result into either a message or a redirect.
 */
export async function submitOrder(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getCustomerContext();
  if (!context) {
    return { status: "error", message: "Sign in to place an order." };
  }

  const parsed = checkoutSchema.safeParse({
    addressId: formData.get("addressId"),
    billingAddressId: formData.get("billingAddressId") ?? undefined,
    paymentMethod: formData.get("paymentMethod"),
    couponCode: formData.get("couponCode") ?? undefined,
    idempotencyKey: formData.get("idempotencyKey"),
  });

  if (!parsed.success) {
    const errors = fieldErrors(parsed.error);
    return {
      status: "error",
      errors,
      // Radio groups have no field to hang an error off visually, so the first
      // problem is also surfaced at the top of the form.
      message:
        errors.addressId?.[0] ??
        errors.paymentMethod?.[0] ??
        "Check the highlighted fields and try again.",
    };
  }

  const result = await placeOrder({
    userId: context.userId,
    customerId: context.customerId,
    customerType: context.customerType,
    tier: context.tier,
    addressId: parsed.data.addressId,
    // "Same as delivery" posts an empty value, which the schema turns into null.
    billingAddressId: parsed.data.billingAddressId,
    paymentMethod: parsed.data.paymentMethod as PaymentMethod,
    couponCode: parsed.data.couponCode,
    idempotencyKey: parsed.data.idempotencyKey,
  });

  if (!result.ok) {
    return { status: "error", message: result.error };
  }

  // The bag emptied and the header badge has to follow.
  revalidatePath("/", "layout");

  // redirect() throws internally — it must not sit inside a try/catch.
  redirect(`/checkout/success/${result.orderNumber}`);
}
