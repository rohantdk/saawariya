import { z } from "zod";
import {
  PAYMENT_METHOD,
  TICKET_CATEGORY_LABEL,
  TICKET_PRIORITY,
} from "@/lib/constants";

/**
 * Input schemas for everything the customer panel writes.
 *
 * Same rule as src/lib/validations/auth.ts: these run inside Server Actions, on
 * the server. A Server Action is a public HTTP endpoint — the form that calls
 * it is a convenience, not a gate — so quantity limits, address formats and
 * ratings are all re-checked here regardless of what the UI allowed.
 *
 * Zod 4 syntax throughout (`z.email()`, no `.flatten()`).
 */

/** Shape every commerce Server Action returns to `useActionState`. */
export type ActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  errors?: Record<string, string[]>;
  /**
   * Set by the wishlist toggle so the button can render the new state without
   * parsing its own success message — the server is the authority on whether
   * the item ended up saved or removed.
   */
  saved?: boolean;
  /**
   * Set when a create action produces a row the client needs to navigate to —
   * the seller product form redirects to the edit page after a create, and the
   * new id is only known server-side.
   */
  productId?: string;
};

export const IDLE_STATE: ActionState = { status: "idle" };

/**
 * Zod 4 removed `error.flatten()`. Same helper as the auth actions — kept
 * separate rather than imported so `src/app/actions/auth.ts` has no reason to
 * export internals.
 */
export function fieldErrors(error: {
  issues: { path: PropertyKey[]; message: string }[];
}): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    (result[key] ??= []).push(issue.message);
  }
  return result;
}

const cuid = z.string().min(1, "Missing identifier.");

// ---------------------------------------------------------------------------
// CART & WISHLIST — SRS §41, §42
// ---------------------------------------------------------------------------

export const addToCartSchema = z.object({
  productId: cuid,
  variantId: z
    .string()
    .trim()
    .optional()
    // An unselected <select> posts "", which is not a missing value to Zod.
    .transform((value) => (value ? value : null)),
  quantity: z.coerce
    .number()
    .int("Quantity must be a whole number.")
    .min(1, "Quantity must be at least 1.")
    .max(1000, "That quantity is too large."),
});

export const updateCartQuantitySchema = z.object({
  cartItemId: cuid,
  quantity: z.coerce.number().int().min(1).max(1000),
});

export const cartItemSchema = z.object({ cartItemId: cuid });

export const productRefSchema = z.object({ productId: cuid });

// ---------------------------------------------------------------------------
// ADDRESSES — SRS §38
// ---------------------------------------------------------------------------

const indianMobile = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number.");

export const addressSchema = z.object({
  id: z.string().trim().optional(),
  label: z.string().trim().min(1, "Give this address a name.").max(24),
  fullName: z.string().trim().min(2, "Enter the recipient's name.").max(80),
  mobile: indianMobile,
  line1: z.string().trim().min(5, "Enter the address.").max(160),
  line2: z.string().trim().max(160).optional(),
  landmark: z.string().trim().max(120).optional(),
  city: z.string().trim().min(2, "Enter the city.").max(60),
  state: z.string().trim().min(2, "Select the state.").max(60),
  // Indian PIN codes never begin with 0.
  pinCode: z
    .string()
    .trim()
    .regex(/^[1-9]\d{5}$/, "Enter a valid 6-digit PIN code."),
  isDefaultShipping: z.coerce.boolean().optional(),
  isDefaultBilling: z.coerce.boolean().optional(),
});

export type AddressInput = z.infer<typeof addressSchema>;

// ---------------------------------------------------------------------------
// CHECKOUT — SRS §43, §44
// ---------------------------------------------------------------------------

export const checkoutSchema = z.object({
  addressId: cuid.describe("Choose a delivery address."),
  billingAddressId: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : null)),
  paymentMethod: z.enum(
    Object.values(PAYMENT_METHOD) as [string, ...string[]],
    { message: "Choose a payment method." },
  ),
  couponCode: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .transform((value) => (value ? value : null)),
  // Generated per checkout render. Stops a double-submit becoming two orders —
  // see the idempotency note in src/lib/commerce/place-order.ts.
  idempotencyKey: z.string().min(8, "Reload the checkout page and try again."),
});

export const couponSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(3, "Enter a coupon code.")
    .max(32, "That is not a valid coupon code."),
});

// ---------------------------------------------------------------------------
// ORDERS — SRS §45, §46, §111
// ---------------------------------------------------------------------------

export const CANCEL_REASONS = [
  "Ordered by mistake",
  "Found a better price",
  "Delivery is taking too long",
  "Changed my mind",
  "Ordered the wrong item or size",
  "Other",
] as const;

export const cancelOrderSchema = z.object({
  orderNumber: z.string().trim().min(1),
  reason: z.enum(CANCEL_REASONS, { message: "Tell us why you are cancelling." }),
  detail: z.string().trim().max(500).optional(),
});

export const RETURN_REASONS = [
  "Damaged on arrival",
  "Wrong item delivered",
  "Colour differs from the photographs",
  "Fabric quality not as described",
  "Size or length is wrong",
  "No longer needed",
] as const;

export const returnRequestSchema = z.object({
  subOrderNumber: z.string().trim().min(1),
  reason: z.enum(RETURN_REASONS, { message: "Choose a reason for the return." }),
  detail: z
    .string()
    .trim()
    .max(500, "Keep the detail under 500 characters.")
    .optional(),
});

// ---------------------------------------------------------------------------
// REVIEWS — SRS §47
// ---------------------------------------------------------------------------

export const reviewSchema = z.object({
  productId: cuid,
  rating: z.coerce
    .number()
    .int()
    .min(1, "Choose a rating.")
    .max(5, "Choose a rating."),
  title: z.string().trim().max(90, "Keep the title under 90 characters.").optional(),
  body: z
    .string()
    .trim()
    .min(10, "Tell us a little more — at least 10 characters.")
    .max(2000, "Keep your review under 2000 characters."),
});

// ---------------------------------------------------------------------------
// SUPPORT — SRS §48, §132
// ---------------------------------------------------------------------------

/** Only the categories a customer can raise; PRODUCT_APPROVAL is a seller's. */
export const CUSTOMER_TICKET_CATEGORIES = [
  "ORDER_ISSUE",
  "DELIVERY_ISSUE",
  "PAYMENT_ISSUE",
  "PRODUCT_ISSUE",
  "RETURN_REQUEST",
  "REFUND_REQUEST",
  "TECHNICAL",
  "ACCOUNT",
  "GENERAL",
] as const satisfies readonly (keyof typeof TICKET_CATEGORY_LABEL)[];

export const ticketSchema = z.object({
  category: z.enum(CUSTOMER_TICKET_CATEGORIES, {
    message: "Choose what this is about.",
  }),
  subject: z
    .string()
    .trim()
    .min(5, "Give your request a subject.")
    .max(120, "Keep the subject under 120 characters."),
  description: z
    .string()
    .trim()
    .min(20, "Describe the problem in at least 20 characters.")
    .max(4000, "Keep the description under 4000 characters."),
  relatedOrderNumber: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : null)),
  priority: z
    .enum(Object.values(TICKET_PRIORITY) as [string, ...string[]])
    .optional(),
});

export const ticketReplySchema = z.object({
  ticketNumber: z.string().trim().min(1),
  body: z
    .string()
    .trim()
    .min(1, "Write a message.")
    .max(4000, "Keep the message under 4000 characters."),
});

// ---------------------------------------------------------------------------
// PROFILE — SRS §50
// ---------------------------------------------------------------------------

export const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(80),
  mobile: indianMobile,
  dateOfBirth: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : null)),
  preferredLang: z.enum(["en", "hi"]).optional(),
});

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .regex(/[a-zA-Z]/, "Password must contain a letter.")
      .regex(/[0-9]/, "Password must contain a number."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "Choose a password you have not used before.",
    path: ["newPassword"],
  });

export const wholesaleUpgradeSchema = z.object({
  // Standard GSTIN: 2 state digits, 10-char PAN, entity digit, Z, checksum.
  gstNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      /^\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z][A-Z\d]$/,
      "Enter a valid 15-character GSTIN.",
    ),
});
