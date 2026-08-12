"use server";

import { revalidatePath } from "next/cache";
import { getCustomerContext } from "@/lib/commerce/context";
import { cancelOrder, requestReturn } from "@/lib/commerce/orders";
import {
  cancelOrderSchema,
  fieldErrors,
  returnRequestSchema,
  type ActionState,
} from "@/lib/validations/commerce";

/**
 * The two order state changes a customer can make — SRS §45, §111.
 *
 * As with checkout, the rules live in src/lib/commerce/orders.ts (which order
 * states can still be cancelled, whether the return window is open, what has to
 * happen to the stock reservation) so that the seller and admin panels act on
 * the same logic instead of a second copy.
 */

export async function cancelOrderAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getCustomerContext();
  if (!context) return { status: "error", message: "Sign in to manage orders." };

  const parsed = cancelOrderSchema.safeParse({
    orderNumber: formData.get("orderNumber"),
    reason: formData.get("reason"),
    detail: formData.get("detail") ?? undefined,
  });

  if (!parsed.success) {
    const errors = fieldErrors(parsed.error);
    return {
      status: "error",
      errors,
      message: errors.reason?.[0] ?? "Choose a reason for cancelling.",
    };
  }

  const result = await cancelOrder({
    userId: context.userId,
    customerId: context.customerId,
    orderNumber: parsed.data.orderNumber,
    // The free-text detail is appended to the chosen reason so the whole
    // explanation lands in one OrderEvent note rather than being split across
    // two columns that every reader would have to join back together.
    reason: parsed.data.detail
      ? `${parsed.data.reason} — ${parsed.data.detail}`
      : parsed.data.reason,
  });

  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath(`/account/orders/${parsed.data.orderNumber}`);
  revalidatePath("/account/orders");
  revalidatePath("/account");

  return {
    status: "success",
    message: "Your order has been cancelled.",
  };
}

export async function requestReturnAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getCustomerContext();
  if (!context) return { status: "error", message: "Sign in to manage orders." };

  const parsed = returnRequestSchema.safeParse({
    subOrderNumber: formData.get("subOrderNumber"),
    reason: formData.get("reason"),
    detail: formData.get("detail") ?? undefined,
  });

  if (!parsed.success) {
    const errors = fieldErrors(parsed.error);
    return {
      status: "error",
      errors,
      message: errors.reason?.[0] ?? "Choose a reason for the return.",
    };
  }

  const result = await requestReturn({
    userId: context.userId,
    customerId: context.customerId,
    subOrderNumber: parsed.data.subOrderNumber,
    reason: parsed.data.reason,
    detail: parsed.data.detail ?? null,
  });

  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath("/account/orders", "layout");

  return {
    status: "success",
    message:
      "Return requested. Our team will review it and arrange a pickup — you will see updates here and in your notifications.",
  };
}
