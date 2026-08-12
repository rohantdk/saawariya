import { z } from "zod";
import {
  FABRICS,
  INDIAN_STATES,
  OCCASIONS,
  PATTERNS,
  SELLER_BUSINESS_TYPES,
  WORK_TYPES,
} from "@/lib/constants";

/**
 * Input schemas for everything the seller panel writes — SRS §53-60.
 *
 * Same rule as the customer schemas: these run server-side inside Server
 * Actions, which are public HTTP endpoints. The form that posts to them is a
 * convenience, not a gate, so prices, quantities and status values are all
 * re-checked here whatever the UI allowed.
 *
 * Zod 4 syntax throughout (`z.email()`, no `.flatten()`).
 */

/**
 * Rupees in, paise out.
 *
 * Money is integer paise everywhere in this codebase, but a seller types
 * rupees. Doing the conversion in the schema means no action can forget it, and
 * `Math.round` after ×100 is what stops "1799.99" becoming 179998.99999999997 —
 * a float that far from an integer is exactly the drift the paise model exists
 * to prevent.
 */
const rupeesToPaise = (fieldLabel: string) =>
  z.coerce
    .number({ error: `${fieldLabel} must be a number.` })
    .min(0, `${fieldLabel} cannot be negative.`)
    .max(10_000_000, `${fieldLabel} is too large.`)
    .transform((rupees) => Math.round(rupees * 100));

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : null));

/** A dropdown that may legitimately be left blank, but must otherwise be known. */
const optionalEnum = (values: readonly string[], label: string) =>
  z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : null))
    .refine((value) => value === null || values.includes(value), {
      message: `Choose a valid ${label}.`,
    });

// ---------------------------------------------------------------------------
// PRODUCTS — SRS §58, §59
// ---------------------------------------------------------------------------

export const productSchema = z
  .object({
    id: z.string().trim().optional(),
    name: z
      .string()
      .trim()
      .min(3, "Product name must be at least 3 characters.")
      .max(160, "Product name is too long."),
    sku: z
      .string()
      .trim()
      .min(3, "SKU must be at least 3 characters.")
      .max(48, "SKU is too long.")
      .regex(
        /^[A-Za-z0-9-]+$/,
        "SKU can contain only letters, numbers and hyphens.",
      ),
    description: z
      .string()
      .trim()
      .min(20, "Give buyers at least a sentence or two — 20 characters minimum.")
      .max(4000, "Description is too long."),
    categoryId: z.string().min(1, "Choose a category."),
    brand: optionalText,
    collection: optionalText,

    fabric: optionalEnum(FABRICS, "fabric"),
    pattern: optionalEnum(PATTERNS, "pattern"),
    occasion: optionalEnum(OCCASIONS, "occasion"),
    workType: optionalEnum(WORK_TYPES, "work type"),
    color: optionalText,
    weightGrams: z.coerce
      .number()
      .int("Weight must be a whole number of grams.")
      .min(0, "Weight cannot be negative.")
      .max(100_000, "Weight is too large.")
      .optional(),

    priceRetail: rupeesToPaise("Retail price"),
    priceWholesale: z
      .string()
      .trim()
      .optional()
      .transform((value) =>
        value ? Math.round(Number(value) * 100) : null,
      )
      .refine((value) => value === null || Number.isFinite(value), {
        message: "Wholesale price must be a number.",
      }),
    priceOffer: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value ? Math.round(Number(value) * 100) : null))
      .refine((value) => value === null || Number.isFinite(value), {
        message: "Offer price must be a number.",
      }),

    minOrderQty: z.coerce
      .number()
      .int("Minimum order quantity must be a whole number.")
      .min(1, "Minimum order quantity must be at least 1.")
      .max(10_000, "Minimum order quantity is too large."),
    maxOrderQty: z.coerce
      .number()
      .int("Maximum order quantity must be a whole number.")
      .min(1, "Maximum order quantity must be at least 1.")
      .max(10_000, "Maximum order quantity is too large."),
  })
  // A retail price of ₹0 is almost certainly a mistyped form, not a giveaway.
  .refine((data) => data.priceRetail > 0, {
    message: "Retail price must be more than zero.",
    path: ["priceRetail"],
  })
  /**
   * The offer price is what a shopper actually pays, and Phase 3 denormalises it
   * into `priceEffective` to sort listings. An offer above the retail price
   * would sort the product as if it were dearer while displaying it as a
   * discount — so it is rejected rather than silently ignored.
   */
  .refine(
    (data) => data.priceOffer === null || data.priceOffer < data.priceRetail,
    {
      message: "The offer price must be below the retail price.",
      path: ["priceOffer"],
    },
  )
  .refine((data) => data.maxOrderQty >= data.minOrderQty, {
    message: "Maximum order quantity cannot be below the minimum.",
    path: ["maxOrderQty"],
  });

export type ProductInput = z.infer<typeof productSchema>;

// ---------------------------------------------------------------------------
// INVENTORY — SRS §60, §97
// ---------------------------------------------------------------------------

/**
 * A stock correction is expressed as a *delta*, not a new total.
 *
 * `StockMovement` is an append-only ledger, so the change is the fact being
 * recorded; the resulting `Inventory.stockQty` is derived from it. Posting a new
 * absolute total instead would also lose a race — two sellers editing at once
 * would each overwrite the other, whereas two deltas both apply.
 *
 * The sign is carried by `direction`, submitted as the *value of the button the
 * seller pressed*, rather than by the seller typing a minus. That is plain HTML
 * — a submit button's value is included in the form data — and it avoids the
 * trap of trying to rewrite a controlled input's value inside the click handler
 * that is already submitting the form, where the old value wins the race.
 */
export const stockAdjustSchema = z
  .object({
    productId: z.string().min(1, "Missing product."),
    quantity: z.coerce
      .number({ error: "Enter a whole number." })
      .int("Enter a whole number.")
      .min(1, "Enter a quantity of at least 1.")
      .max(100_000, "That adjustment is too large."),
    direction: z.enum(["add", "remove"], { error: "Choose add or remove." }),
    reason: z.enum(["SELLER_RESTOCK", "ADJUSTMENT", "QC_DAMAGED"], {
      error: "Choose a reason.",
    }),
    note: z.string().trim().max(280, "Note is too long.").optional(),
  })
  .transform((data) => ({
    ...data,
    changeQty: data.direction === "remove" ? -data.quantity : data.quantity,
  }));

export const lowStockThresholdSchema = z.object({
  productId: z.string().min(1, "Missing product."),
  lowStockThreshold: z.coerce
    .number()
    .int("Threshold must be a whole number.")
    .min(0, "Threshold cannot be negative.")
    .max(10_000, "Threshold is too large."),
});

// ---------------------------------------------------------------------------
// ORDERS — the seller's half of the pipeline (SRS §61)
// ---------------------------------------------------------------------------

export const subOrderTransitionSchema = z.object({
  subOrderId: z.string().min(1, "Missing order."),
  to: z.string().min(1, "Missing target status."),
  note: z.string().trim().max(280, "Note is too long.").optional(),
});

// ---------------------------------------------------------------------------
// BUSINESS PROFILE & KYC — SRS §54, §57
// ---------------------------------------------------------------------------

export const sellerProfileSchema = z.object({
  businessName: z
    .string()
    .trim()
    .min(3, "Business name must be at least 3 characters.")
    .max(120, "Business name is too long."),
  ownerName: z
    .string()
    .trim()
    .min(3, "Owner name must be at least 3 characters.")
    .max(120, "Owner name is too long."),
  businessType: z.enum(SELLER_BUSINESS_TYPES, {
    error: "Choose a business type.",
  }),
  description: z
    .string()
    .trim()
    .max(1000, "Description is too long.")
    .optional()
    .transform((value) => (value ? value : null)),

  // GSTIN: 2-digit state code, 10-char PAN, entity digit, 'Z', checksum.
  gstNumber: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value.toUpperCase() : null))
    .refine(
      (value) =>
        value === null ||
        /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/.test(value),
      { message: "That is not a valid GSTIN." },
    ),
  panNumber: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value.toUpperCase() : null))
    .refine((value) => value === null || /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(value), {
      message: "That is not a valid PAN.",
    }),

  addressLine: z.string().trim().max(200, "Address is too long.").optional(),
  city: z.string().trim().max(80, "City is too long.").optional(),
  state: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : null))
    .refine(
      (value) => value === null || (INDIAN_STATES as readonly string[]).includes(value),
      { message: "Choose a valid state." },
    ),
  pinCode: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : null))
    .refine((value) => value === null || /^[1-9][0-9]{5}$/.test(value), {
      message: "PIN code must be 6 digits.",
    }),
  pickupAddress: z
    .string()
    .trim()
    .max(300, "Pickup address is too long.")
    .optional()
    .transform((value) => (value ? value : null)),

  bankAccountName: z
    .string()
    .trim()
    .max(120, "Account name is too long.")
    .optional()
    .transform((value) => (value ? value : null)),
  bankAccountNumber: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : null))
    .refine((value) => value === null || /^[0-9]{9,18}$/.test(value), {
      message: "Account number must be 9 to 18 digits.",
    }),
  bankIfsc: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value.toUpperCase() : null))
    .refine((value) => value === null || /^[A-Z]{4}0[A-Z0-9]{6}$/.test(value), {
      message: "That is not a valid IFSC code.",
    }),
});

export type SellerProfileInput = z.infer<typeof sellerProfileSchema>;
