import { z } from "zod";
import {
  CUSTOMER_TYPE,
  PRODUCT_STATUS,
  SELLER_DOC_TYPE,
  SUB_ORDER_STATUS,
} from "@/lib/constants";

/**
 * Input schemas for everything the admin console writes.
 *
 * Same rule as the customer and seller schemas: these run inside Server
 * Actions, and a Server Action is a public HTTP endpoint. The form that calls
 * it is a convenience, not a gate — so every id, status and note is re-checked
 * here regardless of what the UI allowed.
 *
 * The recurring shape below is "a decision plus its reason". Rejecting anything
 * — a seller, a document, a product, a review — **requires** a note, because
 * the note is what the other panel renders: `/seller/pending` shows
 * `verificationNote` and each document's `reviewNote`, and the seller product
 * list shows `rejectionReason`. A rejection with no reason produces a dead-end
 * screen telling someone they failed and not why, which is the one outcome the
 * approval workflow exists to prevent.
 */

const cuid = z.string().trim().min(1, "Missing identifier.");

const note = (max = 500) =>
  z.string().trim().max(max, `Keep this under ${max} characters.`);

const requiredNote = (label: string, max = 500) =>
  z
    .string()
    .trim()
    .min(10, `${label} — at least 10 characters.`)
    .max(max, `Keep this under ${max} characters.`);

// ---------------------------------------------------------------------------
// SELLER VERIFICATION — SRS §55, §74
// ---------------------------------------------------------------------------

export const sellerDecisionSchema = z.object({
  sellerId: cuid,
  note: note(500).optional(),
});

export const sellerRejectSchema = z.object({
  sellerId: cuid,
  note: requiredNote("Tell the seller what to correct"),
});

export const sellerDocumentReviewSchema = z.object({
  documentId: cuid,
  docType: z.enum(
    Object.values(SELLER_DOC_TYPE) as [string, ...string[]],
  ),
  decision: z.enum(["APPROVED", "REJECTED"], {
    message: "Choose approve or reject.",
  }),
  reviewNote: note(300).optional(),
});

export const sellerCommissionSchema = z.object({
  sellerId: cuid,
  commissionPercent: z.coerce
    .number()
    .int("Use a whole percentage.")
    .min(0, "Commission cannot be negative.")
    .max(50, "A commission above 50% is almost certainly a typo."),
});

// ---------------------------------------------------------------------------
// PRODUCT APPROVAL — SRS §75, §76
// ---------------------------------------------------------------------------

export const productDecisionSchema = z.object({
  productId: cuid,
  note: note(500).optional(),
});

export const productRejectSchema = z.object({
  productId: cuid,
  note: requiredNote("Tell the seller what to fix"),
});

/** Admin-only status moves. Deliberately a closed set — see admin-products.ts. */
export const productStatusSchema = z.object({
  productId: cuid,
  status: z.enum([PRODUCT_STATUS.HIDDEN, PRODUCT_STATUS.APPROVED], {
    message: "That is not a status an admin sets directly.",
  }),
});

// ---------------------------------------------------------------------------
// CATEGORIES — SRS §76
// ---------------------------------------------------------------------------

export const categorySchema = z.object({
  id: z.string().trim().optional(),
  name: z
    .string()
    .trim()
    .min(2, "Give the category a name.")
    .max(60, "Keep the name under 60 characters."),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Use lowercase letters, numbers and hyphens only.",
    )
    .max(80)
    .optional()
    .or(z.literal("")),
  description: note(300).optional(),
  imageUrl: note(300).optional(),
  // "" means top level. A real id nests it one deep; two levels is all the
  // storefront routes /shop/[category]/[sub] can address.
  parentId: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : null)),
  sortOrder: z.coerce.number().int().min(0).max(999).optional(),
  isActive: z.coerce.boolean().optional(),
});

export const categoryRefSchema = z.object({ id: cuid });

// ---------------------------------------------------------------------------
// CUSTOMERS — SRS §73
// ---------------------------------------------------------------------------

export const customerStatusSchema = z.object({
  userId: cuid,
  action: z.enum(["SUSPEND", "REINSTATE"], {
    message: "Choose an action.",
  }),
  reason: note(300).optional(),
});

export const customerTierSchema = z.object({
  customerId: cuid,
  customerType: z.enum(
    Object.values(CUSTOMER_TYPE) as [string, ...string[]],
    { message: "Choose a customer tier." },
  ),
  gstNumber: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .transform((value) => (value ? value : null)),
});

// ---------------------------------------------------------------------------
// ORDERS — SRS §78
// ---------------------------------------------------------------------------

export const subOrderTransitionSchema = z.object({
  subOrderId: cuid,
  to: z.enum(
    Object.values(SUB_ORDER_STATUS) as [string, ...string[]],
    { message: "That is not a known order status." },
  ),
  note: note(300).optional(),
});

// ---------------------------------------------------------------------------
// REVIEWS — SRS §47
// ---------------------------------------------------------------------------

export const reviewModerationSchema = z.object({
  reviewId: cuid,
  decision: z.enum(["APPROVED", "REJECTED"], {
    message: "Choose approve or reject.",
  }),
});

// ---------------------------------------------------------------------------
// SETTINGS — SRS §87
// ---------------------------------------------------------------------------

/**
 * Settings are validated against the row's own `valueType`, not against a
 * hard-coded per-key schema — the table is data, and a key added by a later
 * migration must not need a code change here to become editable. The bounds
 * that *are* key-specific live in `SETTING_BOUNDS` below, because a GST rate of
 * 900% is syntactically a number and semantically a disaster.
 */
export const SETTING_BOUNDS: Record<string, { min: number; max: number }> = {
  "tax.gst_percent": { min: 0, max: 28 },
  "shipping.dispatch_days": { min: 0, max: 30 },
  "shipping.flat_rate_paise": { min: 0, max: 500_000 },
  "shipping.free_threshold_paise": { min: 0, max: 10_000_000 },
  "payment.cod_max_order_paise": { min: 0, max: 10_000_000 },
  "payment.commission_percent": { min: 0, max: 50 },
  "feature.return_window_days": { min: 0, max: 90 },
};

export function validateSettingValue(
  key: string,
  valueType: string,
  raw: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const value = raw.trim();

  if (valueType === "NUMBER") {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return { ok: false, error: "Enter a number." };
    if (!Number.isInteger(parsed)) {
      return { ok: false, error: "Enter a whole number." };
    }
    const bounds = SETTING_BOUNDS[key];
    if (bounds && (parsed < bounds.min || parsed > bounds.max)) {
      return {
        ok: false,
        error: `Enter a value between ${bounds.min} and ${bounds.max}.`,
      };
    }
    return { ok: true, value: String(parsed) };
  }

  if (valueType === "BOOLEAN") {
    if (value !== "true" && value !== "false") {
      return { ok: false, error: "Choose on or off." };
    }
    return { ok: true, value };
  }

  if (valueType === "JSON") {
    try {
      JSON.parse(value);
    } catch {
      return { ok: false, error: "That is not valid JSON." };
    }
    return { ok: true, value };
  }

  if (value.length > 500) {
    return { ok: false, error: "Keep this under 500 characters." };
  }
  return { ok: true, value };
}
