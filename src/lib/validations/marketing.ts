import { z } from "zod";
import {
  BANNER_POSITION,
  CAMPAIGN_AUDIENCE,
  CAMPAIGN_STATUS,
  COUPON_ELIGIBILITY,
  DISCOUNT_TYPE,
} from "@/lib/constants";

/**
 * Input schemas for the marketing desk — SRS §123-129.
 *
 * Two things here are load-bearing and not obvious.
 *
 * **Money arrives from the form in rupees and is stored in paise.** Every other
 * panel in this build takes paise straight from a seeded row; this is the first
 * screen where a person *types* an amount, and asking a marketer to enter
 * "50000" for ₹500 is how a coupon ends up a hundred times too generous. The
 * transform is here, once, so the action never sees a rupee figure.
 *
 * **A percentage coupon and a fixed coupon validate differently**, because
 * `discountValue` means a different thing in each — 0-100 for a percentage,
 * paise for a fixed amount. A single numeric range covering both would let
 * "500% off" through.
 */

const cuid = z.string().trim().min(1, "Missing identifier.");

/** Rupees in the form, paise in the database. Never the other way round. */
const rupeesToPaise = (label: string, max = 10_000_000) =>
  z.coerce
    .number({ message: `Enter ${label} as a number.` })
    .min(0, `${label} cannot be negative.`)
    .max(max / 100, `${label} is implausibly large.`)
    .transform((rupees) => Math.round(rupees * 100));

const dateField = (label: string) =>
  z.coerce.date({ message: `Choose ${label}.` });

// ---------------------------------------------------------------------------
// COUPONS — SRS §126
// ---------------------------------------------------------------------------

export const couponSchema = z
  .object({
    id: z.string().trim().optional(),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .min(3, "A code needs at least 3 characters.")
      .max(24, "Keep the code under 24 characters.")
      .regex(
        /^[A-Z0-9]+$/,
        "Use capital letters and numbers only — the cart uppercases whatever is typed.",
      ),
    discountType: z.enum(
      Object.values(DISCOUNT_TYPE) as [string, ...string[]],
      { message: "Choose a discount type." },
    ),
    percentValue: z.coerce.number().min(0).max(100).optional(),
    fixedValue: rupeesToPaise("the discount", 10_000_000).optional(),
    minOrderValue: rupeesToPaise("the minimum order value").optional(),
    maxDiscount: rupeesToPaise("the cap").optional(),
    usageLimit: z.coerce
      .number()
      .int("Use a whole number.")
      .min(0, "A usage limit cannot be negative.")
      .max(1_000_000)
      .optional(),
    perCustomerLimit: z.coerce
      .number()
      .int("Use a whole number.")
      .min(1, "Allow at least one use per customer.")
      .max(100),
    eligibility: z.enum(
      Object.values(COUPON_ELIGIBILITY) as [string, ...string[]],
      { message: "Choose who can use this code." },
    ),
    isActive: z.coerce.boolean().optional(),
    startsAt: dateField("a start date"),
    endsAt: dateField("an end date"),
  })
  .refine((data) => data.endsAt > data.startsAt, {
    message: "The end date has to be after the start date.",
    path: ["endsAt"],
  })
  .refine(
    (data) =>
      data.discountType !== DISCOUNT_TYPE.PERCENTAGE ||
      (data.percentValue !== undefined && data.percentValue > 0),
    { message: "Enter a percentage between 1 and 100.", path: ["percentValue"] },
  )
  .refine(
    (data) =>
      data.discountType !== DISCOUNT_TYPE.FIXED ||
      (data.fixedValue !== undefined && data.fixedValue > 0),
    { message: "Enter the amount to take off.", path: ["fixedValue"] },
  );

export type CouponInput = z.infer<typeof couponSchema>;

export const couponToggleSchema = z.object({
  id: cuid,
  isActive: z.enum(["true", "false"]),
});

// ---------------------------------------------------------------------------
// BANNERS — SRS §125
// ---------------------------------------------------------------------------

export const bannerSchema = z
  .object({
    id: z.string().trim().optional(),
    title: z
      .string()
      .trim()
      .min(2, "Give the banner a title.")
      .max(80, "Keep the title under 80 characters."),
    subtitle: z
      .string()
      .trim()
      .max(160, "Keep the subtitle under 160 characters.")
      .optional(),
    /**
     * A path or an absolute URL. Catalogue imagery is committed to the repo and
     * served from `/catalogue/…`, so this is normally a path — there is no
     * upload widget, because a file picker that has nowhere to put the file is a
     * fake control.
     */
    imageUrl: z
      .string()
      .trim()
      .min(1, "The banner needs an image.")
      .max(300, "That URL is too long."),
    linkUrl: z
      .string()
      .trim()
      .max(300, "That URL is too long.")
      .optional(),
    position: z.enum(
      Object.values(BANNER_POSITION) as [string, ...string[]],
      { message: "Choose where this banner appears." },
    ),
    sortOrder: z.coerce.number().int().min(0).max(999),
    isActive: z.coerce.boolean().optional(),
    startsAt: z.string().trim().optional(),
    endsAt: z.string().trim().optional(),
  })
  .refine(
    (data) =>
      !data.startsAt ||
      !data.endsAt ||
      new Date(data.endsAt) > new Date(data.startsAt),
    { message: "The end date has to be after the start date.", path: ["endsAt"] },
  );

export const bannerToggleSchema = z.object({
  id: cuid,
  isActive: z.enum(["true", "false"]),
});

// ---------------------------------------------------------------------------
// CAMPAIGNS — SRS §127
// ---------------------------------------------------------------------------

export const campaignSchema = z
  .object({
    id: z.string().trim().optional(),
    name: z
      .string()
      .trim()
      .min(3, "Give the campaign a name.")
      .max(80, "Keep the name under 80 characters."),
    description: z
      .string()
      .trim()
      .max(500, "Keep the description under 500 characters.")
      .optional(),
    bannerUrl: z.string().trim().max(300).optional(),
    offerDetail: z.string().trim().max(300).optional(),
    audience: z.enum(
      Object.values(CAMPAIGN_AUDIENCE) as [string, ...string[]],
      { message: "Choose an audience." },
    ),
    startsAt: dateField("a start date"),
    endsAt: dateField("an end date"),
  })
  .refine((data) => data.endsAt > data.startsAt, {
    message: "The end date has to be after the start date.",
    path: ["endsAt"],
  });

export const campaignStatusSchema = z.object({
  id: cuid,
  status: z.enum(Object.values(CAMPAIGN_STATUS) as [string, ...string[]], {
    message: "That is not a campaign status.",
  }),
});

// ---------------------------------------------------------------------------
// CMS — SRS §84
// ---------------------------------------------------------------------------

/**
 * The slug is absent on purpose. These pages are linked from the footer, the
 * login screen and seeded banner `linkUrl`s; renaming one would 404 every link
 * without anything reporting it, and this build's rule since Phase 3 has been no
 * dead links.
 */
export const cmsPageSchema = z.object({
  id: cuid,
  title: z
    .string()
    .trim()
    .min(2, "Give the page a title.")
    .max(120, "Keep the title under 120 characters."),
  bodyHtml: z
    .string()
    .trim()
    .min(20, "A page needs some content.")
    .max(40_000, "That page is very long — split it up."),
  metaTitle: z.string().trim().max(70).optional(),
  metaDescription: z.string().trim().max(180).optional(),
  isPublished: z.coerce.boolean().optional(),
});

// ---------------------------------------------------------------------------
// BROADCAST — SRS §128, §155
// ---------------------------------------------------------------------------

export const broadcastSchema = z.object({
  audience: z.enum(Object.values(CAMPAIGN_AUDIENCE) as [string, ...string[]], {
    message: "Choose who this goes to.",
  }),
  title: z
    .string()
    .trim()
    .min(4, "Give the message a subject.")
    .max(90, "Keep the subject under 90 characters — it is a list item."),
  body: z
    .string()
    .trim()
    .min(20, "Say something worth interrupting someone for.")
    .max(400, "Keep the message under 400 characters."),
  linkUrl: z.string().trim().max(300).optional(),
  campaignId: z.string().trim().optional(),
  /**
   * Typed confirmation rather than a checkbox. This is the only action in the
   * build that writes to thousands of other people's accounts at once and cannot
   * be undone — there is no "unsend". A checkbox is one careless click; typing
   * the audience size is a deliberate act.
   */
  confirm: z.string().trim(),
});
