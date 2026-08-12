/**
 * Presentation metadata for the `Setting` table — SRS §87.
 *
 * Deliberately a **pure module with no database import**, separate from
 * `src/lib/admin/settings.ts`, which is `server-only`. The settings form is a
 * Client Component and needs these constants to decide which control to render
 * and which values to flag; importing them from the server module pulled
 * `prisma` — and through it `better-sqlite3`, a native binding — into the
 * client bundle and failed the production build outright.
 *
 * The rule this encodes: a `server-only` module may export *types* to a client
 * component, because types are erased, but never a *value*. Anything a client
 * component needs at runtime belongs in a module with no server imports.
 */

/** Order the categories appear in, and what each group is for. */
export const SETTING_CATEGORIES: { key: string; label: string; blurb: string }[] =
  [
    {
      key: "GENERAL",
      label: "General",
      blurb: "Platform identity, support contacts and the feature switches.",
    },
    {
      key: "TAX",
      label: "Tax",
      blurb:
        "GST is extracted from the displayed price, not added on top — the storefront says prices include tax, so checkout must honour that.",
    },
    {
      key: "SHIPPING",
      label: "Shipping",
      blurb: "Read by the cart and checkout on every order.",
    },
    {
      key: "PAYMENT",
      label: "Payment",
      blurb:
        "Cash on delivery and the default seller commission. No payment gateway is connected in this build.",
    },
    {
      key: "CURRENCY",
      label: "Currency",
      blurb: "Money is stored as integer paise throughout; this is display only.",
    },
    {
      key: "BRANDING",
      label: "Branding",
      blurb: "Logo and palette references.",
    },
    {
      key: "SEO",
      label: "SEO",
      blurb: "Defaults for pages that do not set their own metadata.",
    },
    {
      key: "NOTIFICATION",
      label: "Notifications",
      blurb:
        "Channel switches. Email, SMS and WhatsApp delivery are not wired to a provider in this build — in-app notifications are.",
    },
  ];

export type SettingRow = {
  key: string;
  value: string;
  label: string;
  valueType: string;
  category: string;
  updatedAt: Date;
};

/**
 * Keys the storefront and checkout read on every request.
 *
 * Flagged on the screen so an admin can tell the difference between a setting
 * that changes what customers are charged and one that changes a label. This is
 * the same set `getCommerceSettings()` queries.
 */
export const LIVE_COMMERCE_KEYS = new Set([
  "tax.gst_percent",
  "tax.prices_include_gst",
  "shipping.free_threshold_paise",
  "shipping.flat_rate_paise",
  "shipping.dispatch_days",
  "payment.cod_enabled",
  "payment.cod_max_order_paise",
  "feature.returns_enabled",
  "feature.return_window_days",
  "feature.reviews_moderated",
  "platform.support_email",
  "platform.support_phone",
]);

/** Paise-valued settings, so the form can show rupees beside the raw integer. */
export const PAISE_KEYS = new Set([
  "shipping.free_threshold_paise",
  "shipping.flat_rate_paise",
  "payment.cod_max_order_paise",
]);
