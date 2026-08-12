import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import {
  FLAT_SHIPPING_PAISE,
  FREE_SHIPPING_THRESHOLD_PAISE,
  GST_PERCENT,
} from "@/lib/constants";

/**
 * Platform settings, read from the `Setting` table.
 *
 * The admin Settings screen (Phase 6) writes these rows, so checkout must read
 * them rather than the constants — a shipping threshold an admin can edit but
 * which no page obeys is a fake screen, and this build does not ship those. The
 * constants in src/lib/constants.ts stay as the *fallback* for a database that
 * has not been seeded, so nothing here can divide by an absent row.
 *
 * One query per render pass covers every caller (`cache()`), which matters
 * because the cart, the summary and the checkout form all want the same values.
 */

export type CommerceSettings = {
  gstPercent: number;
  /** True when the displayed price already contains GST — see extractGst(). */
  pricesIncludeGst: boolean;
  freeShippingThresholdPaise: number;
  flatShippingPaise: number;
  dispatchDays: number;
  codEnabled: boolean;
  codMaxOrderPaise: number;
  returnsEnabled: boolean;
  returnWindowDays: number;
  reviewsModerated: boolean;
  supportEmail: string;
  supportPhone: string;
};

const FALLBACK: CommerceSettings = {
  gstPercent: GST_PERCENT,
  pricesIncludeGst: true,
  freeShippingThresholdPaise: FREE_SHIPPING_THRESHOLD_PAISE,
  flatShippingPaise: FLAT_SHIPPING_PAISE,
  dispatchDays: 2,
  codEnabled: true,
  codMaxOrderPaise: 1_000_000,
  returnsEnabled: true,
  returnWindowDays: 7,
  reviewsModerated: true,
  supportEmail: "support@saawariya.example",
  supportPhone: "+91 98100 00008",
};

const KEYS = [
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
];

export const getCommerceSettings = cache(
  async (): Promise<CommerceSettings> => {
    const rows = await prisma.setting.findMany({
      where: { key: { in: KEYS } },
      select: { key: true, value: true },
    });

    const map = new Map(rows.map((row) => [row.key, row.value]));

    const num = (key: string, fallback: number) => {
      const parsed = Number(map.get(key));
      return Number.isFinite(parsed) ? parsed : fallback;
    };
    const bool = (key: string, fallback: boolean) => {
      const value = map.get(key);
      return value === undefined ? fallback : value === "true";
    };
    const str = (key: string, fallback: string) => map.get(key) ?? fallback;

    return {
      gstPercent: num("tax.gst_percent", FALLBACK.gstPercent),
      pricesIncludeGst: bool(
        "tax.prices_include_gst",
        FALLBACK.pricesIncludeGst,
      ),
      freeShippingThresholdPaise: num(
        "shipping.free_threshold_paise",
        FALLBACK.freeShippingThresholdPaise,
      ),
      flatShippingPaise: num("shipping.flat_rate_paise", FALLBACK.flatShippingPaise),
      dispatchDays: num("shipping.dispatch_days", FALLBACK.dispatchDays),
      codEnabled: bool("payment.cod_enabled", FALLBACK.codEnabled),
      codMaxOrderPaise: num(
        "payment.cod_max_order_paise",
        FALLBACK.codMaxOrderPaise,
      ),
      returnsEnabled: bool("feature.returns_enabled", FALLBACK.returnsEnabled),
      returnWindowDays: num(
        "feature.return_window_days",
        FALLBACK.returnWindowDays,
      ),
      reviewsModerated: bool(
        "feature.reviews_moderated",
        FALLBACK.reviewsModerated,
      ),
      supportEmail: str("platform.support_email", FALLBACK.supportEmail),
      supportPhone: str("platform.support_phone", FALLBACK.supportPhone),
    };
  },
);
