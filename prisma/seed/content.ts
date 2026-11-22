import type { PrismaClient } from "../../src/generated/prisma/client";
import {
  FLAT_SHIPPING_PAISE,
  FREE_SHIPPING_THRESHOLD_PAISE,
  GST_PERCENT,
} from "../../src/lib/constants";
import { CATALOGUE_IMAGES } from "./images";

/**
 * Storefront content: banners, coupons, campaigns, CMS pages, platform
 * settings and newsletter subscribers.
 *
 * These matter more than they look. The hard rule for this build is no dead
 * links and no placeholder screens — every footer link the client clicks has to
 * open a real page backed by a real row, and the marketing panel has to list
 * campaigns that actually exist.
 */

const DAY = 24 * 60 * 60 * 1000;
/**
 * Relative to when the seed runs, not to a date written into the file.
 *
 * This was pinned to 2026-08-01 and that is a bug in a deliverable the client
 * unzips and runs on their own machine some weeks later: every "live" coupon and
 * banner would have expired, the scheduled campaign would have started without
 * anyone starting it, and the storefront would render its promotional slots
 * empty. A demo whose seeded promotions have all lapsed reads as a broken build,
 * not as old data.
 */
const now = new Date();
const daysFromNow = (n: number) => new Date(now.getTime() + n * DAY);

// ---------------------------------------------------------------------------
// Banners — SRS §125
// ---------------------------------------------------------------------------

/**
 * Editorial photography, in public/editorial/. Distinct from CATALOGUE_IMAGES:
 * those are product shots tied to a specific listing, these are styled set
 * pieces used only in the hero and the marketing bands, where the frame carries
 * a mood rather than a SKU. Credits are in public/editorial/CREDITS.md.
 *
 * Each is matched to copy it actually depicts — the block-print slide keeps a
 * real block-print photograph rather than borrowing a silk one.
 */
const EDITORIAL = {
  bridalHero: "/editorial/hero-bridal.jpg",
  sheerSilk: "/editorial/silk-sanctuary.jpg",
  atelier: "/editorial/bridal-atelier.jpg",
  loom: "/editorial/handloom-craft.jpg",
  banarasiDetail: "/editorial/banarasi-heritage.jpg",
  // Added 2026-08-21 from the same prototype site as the five above, and
  // under the same unresolved licence — see public/editorial/CREDITS.md.
  zariTexture: "/editorial/zari-brocade-texture.jpg",
  festive: "/editorial/festive-diwali.jpg",
  // From the prototype site's "Our Story" / login section ("A saree is not worn. It
  // is inherited."). Landscape (1344×768), staged since 2026-08-21 but
  // unused until now — see public/editorial/CREDITS.md.
  bridalStory: "/editorial/bridal-story.jpg",
  // Client-supplied (not from the prototype) — see public/editorial/CREDITS.md.
  clientHeroSaree: "/editorial/client-hero-saree.jpg",
  weaverAtLoom: "/editorial/weaver-pit-loom.jpg",
} as const;

const BANNERS = [
  // hero-carousel.tsx cross-fades every live HOME_HERO row in sortOrder, so
  // this is the slide the homepage opens on rather than the only one it shows.
  {
    title: "The Vivaah Bridal Edit",
    subtitle:
      "Handwoven Banarasi and Kanjivaram for the wedding season, direct from the loom.",
    // Swapped again 2026-08-24: the client supplied their own hero
    // photograph (herosareepic.png, landscape 1881×836 — see
    // EDITORIAL.clientHeroSaree and public/editorial/CREDITS.md), replacing
    // the prototype's bridal-chaise portrait this had before.
    imageUrl: EDITORIAL.clientHeroSaree,
    linkUrl: "/shop/sarees",
    position: "HOME_HERO",
    sortOrder: 0,
  },
  // "Chanderi, Woven Light" and "Block Print, Natural Dye" removed
  // 2026-08-24: both linked to sub-categories now switched off (see
  // prisma/seed/categories.ts) — chanderi-sarees and fabric-by-the-metre —
  // and their copy names a craft with no live listing left to open on.
  {
    title: "Dressed for the Season",
    subtitle: "Silk and zari for Diwali, weddings and the nights in between.",
    imageUrl: EDITORIAL.festive,
    // Was "?occasion=Festive" — none of the 5 sarees left public (see
    // prisma/seed/products.ts) carry that occasion value, all 5 are "Party",
    // so the facet filter resolved to an empty listing. Points at the sarees
    // category itself instead.
    linkUrl: "/shop/sarees",
    position: "HOME_HERO",
    sortOrder: 3,
  },
  {
    title: "Buying for a boutique?",
    subtitle: "Wholesale pricing, GST invoicing and MOQ from 10 metres.",
    imageUrl: EDITORIAL.atelier,
    linkUrl: "/register?type=wholesale",
    position: "HOME_STRIP",
    sortOrder: 0,
  },
  {
    // Was "Fabric by the Metre", linking to a category switched off
    // 2026-08-24 (see prisma/seed/categories.ts). shop/page.tsx renders the
    // first CATEGORY_TOP banner unconditionally at the top of /shop — the
    // one listing page left standing — so this now describes what's actually
    // there rather than a department that no longer has a live listing.
    title: "Sarees, Shot on the Client's Own Pieces",
    subtitle: "Real product photography, not stock imagery — five sarees, six frames each.",
    imageUrl: "/catalogue/client-sarees/saree1-1.jpg",
    linkUrl: "/shop/sarees",
    position: "CATEGORY_TOP",
    sortOrder: 0,
  },
  {
    title: "Free shipping over ₹2,000",
    subtitle: "On every order, everywhere in India.",
    imageUrl: CATALOGUE_IMAGES.cotton[0],
    linkUrl: "/shop",
    position: "PROMO",
    sortOrder: 0,
  },
  /**
   * One scheduled and one switched off, so the Phase 8 banner screen shows all
   * three states it can derive rather than a wall of identical "live" rows —
   * and so an evaluator can see that a banner not on the homepage is not a bug.
   */
  {
    title: "Handloom Week",
    subtitle: "Seven days of weaver-direct pricing across every loom region.",
    imageUrl: EDITORIAL.weaverAtLoom,
    linkUrl: "/shop",
    position: "HOME_STRIP",
    sortOrder: 1,
    isActive: true,
    startsAt: daysFromNow(9),
    endsAt: daysFromNow(16),
  },
  {
    title: "Summer Cottons Clearance",
    subtitle: "Last season's cottons and linens, while they last.",
    imageUrl: CATALOGUE_IMAGES.cotton[1],
    // Was "/shop/fabric-by-the-metre" — that category is switched off by the
    // 2026-08-24 sarees-only request (prisma/seed/categories.ts), so the URL
    // 404s. The banner is expired and inactive, but the admin marketing list
    // still renders its target as a link, so a dead URL is reachable from the
    // console even though no shopper can see the banner.
    linkUrl: "/shop/sarees",
    position: "PROMO",
    sortOrder: 1,
    isActive: false,
    startsAt: daysFromNow(-150),
    endsAt: daysFromNow(-30),
  },
];

// ---------------------------------------------------------------------------
// Coupons — SRS §126. discountValue is a percentage for PERCENTAGE coupons and
// PAISE for FIXED ones; maxDiscount caps percentage coupons and is also PAISE.
// ---------------------------------------------------------------------------

type CouponSeed = {
  code: string;
  discountType: "PERCENTAGE" | "FIXED" | "FREE_SHIPPING";
  discountValue: number;
  minOrderValue: number;
  maxDiscount: number | null;
  usageLimit: number | null;
  usageCount: number;
  perCustomerLimit: number;
  eligibility: string;
  isActive?: boolean;
  startsAt: Date;
  endsAt: Date;
};

const COUPONS: CouponSeed[] = [
  {
    code: "WELCOME10",
    discountType: "PERCENTAGE",
    discountValue: 10,
    minOrderValue: 150_000,
    maxDiscount: 100_000,
    usageLimit: 1000,
    usageCount: 214,
    perCustomerLimit: 1,
    eligibility: "NEW_CUSTOMERS",
    startsAt: daysFromNow(-60),
    endsAt: daysFromNow(120),
  },
  {
    code: "VIVAAH15",
    discountType: "PERCENTAGE",
    discountValue: 15,
    minOrderValue: 1_000_000,
    maxDiscount: 500_000,
    usageLimit: 300,
    usageCount: 88,
    perCustomerLimit: 2,
    eligibility: "ALL",
    startsAt: daysFromNow(-20),
    endsAt: daysFromNow(45),
  },
  {
    code: "FESTIVE500",
    discountType: "FIXED",
    discountValue: 50_000,
    minOrderValue: 300_000,
    maxDiscount: null,
    usageLimit: 500,
    usageCount: 176,
    perCustomerLimit: 1,
    eligibility: "ALL",
    startsAt: daysFromNow(-10),
    endsAt: daysFromNow(30),
  },
  {
    code: "BULK20",
    discountType: "PERCENTAGE",
    discountValue: 20,
    minOrderValue: 5_000_000,
    maxDiscount: 2_000_000,
    usageLimit: 100,
    usageCount: 12,
    perCustomerLimit: 5,
    eligibility: "WHOLESALE",
    startsAt: daysFromNow(-90),
    endsAt: daysFromNow(180),
  },
  {
    code: "FREESHIP",
    discountType: "FREE_SHIPPING",
    discountValue: 0,
    minOrderValue: 100_000,
    maxDiscount: null,
    usageLimit: null,
    usageCount: 431,
    perCustomerLimit: 3,
    eligibility: "ALL",
    startsAt: daysFromNow(-120),
    endsAt: daysFromNow(60),
  },
  {
    // Not started yet, so the coupon list has a "scheduled" row and the cart
    // has a code it will refuse with "not active yet" rather than "invalid".
    code: "HANDLOOM12",
    discountType: "PERCENTAGE",
    discountValue: 12,
    minOrderValue: 250_000,
    maxDiscount: 100_000,
    usageLimit: 500,
    usageCount: 0,
    perCustomerLimit: 1,
    eligibility: "ALL",
    startsAt: daysFromNow(9),
    endsAt: daysFromNow(16),
  },
  {
    /**
     * Left switched **on** but past its end date, which is a different state
     * from SUMMER25 below and the more interesting one: nobody turned it off,
     * so it looks live on a careless list and the cart rejects it as expired.
     * The coupon screen derives the same three conditions the cart applies, so
     * this row is what proves the two agree.
     */
    code: "MONSOON10",
    discountType: "PERCENTAGE",
    discountValue: 10,
    minOrderValue: 100_000,
    maxDiscount: 50_000,
    usageLimit: 300,
    usageCount: 118,
    perCustomerLimit: 1,
    eligibility: "ALL",
    startsAt: daysFromNow(-80),
    endsAt: daysFromNow(-20),
  },
  {
    // Expired on purpose: the coupon list needs an inactive row so a reviewer
    // can see how expiry is presented, not just the happy path.
    code: "SUMMER25",
    discountType: "PERCENTAGE",
    discountValue: 25,
    minOrderValue: 200_000,
    maxDiscount: 150_000,
    usageLimit: 400,
    usageCount: 400,
    perCustomerLimit: 1,
    eligibility: "ALL",
    isActive: false,
    startsAt: daysFromNow(-150),
    endsAt: daysFromNow(-30),
  },
];

// ---------------------------------------------------------------------------
// Campaigns — SRS §127, §129
//
// **The performance counters are all zero here, deliberately.** They used to
// carry figures like 48,210 views on a platform with eleven seeded customers,
// which is the kind of number a demo cannot account for — and the marketing
// screens now state that reach counts the notifications a broadcast actually
// wrote. Seeded copy commits the software to something, the same way the "MOQ
// from 10 metres" banner did in Phase 3 and the "inclusive of all taxes" line
// did in Phase 4. So the counters start at zero and `seedCampaignBroadcasts`
// below moves them by writing real notifications to real people.
//
// Clicks and conversions stay at zero and nothing in this build moves them:
// there is no analytics pipeline, the columns exist because SRS §129 specifies
// them, and inventing values would be worse than showing none.
// ---------------------------------------------------------------------------

const CAMPAIGNS = [
  {
    name: "Vivaah Bridal Season 2026",
    description:
      "Wedding-season push across email and WhatsApp for the bridal Banarasi and Kanjivaram collection.",
    bannerUrl: CATALOGUE_IMAGES.banarasi[0],
    offerDetail: "15% off orders above ₹10,000 with code VIVAAH15",
    audience: "ALL",
    status: "ACTIVE",
    viewCount: 0,
    clickCount: 0,
    conversionCount: 0,
    startsAt: daysFromNow(-20),
    endsAt: daysFromNow(45),
  },
  {
    name: "Wholesale Boutique Outreach",
    description:
      "Targeted campaign to registered wholesale buyers introducing the fabric-by-the-metre range.",
    bannerUrl: CATALOGUE_IMAGES.brocade[1],
    offerDetail: "20% off bulk orders above ₹50,000 with code BULK20",
    audience: "WHOLESALE",
    status: "ACTIVE",
    viewCount: 0,
    clickCount: 0,
    conversionCount: 0,
    startsAt: daysFromNow(-90),
    endsAt: daysFromNow(180),
  },
  {
    name: "First Purchase Welcome Series",
    description:
      "Three-email onboarding sequence for newly registered customers who have not yet ordered.",
    bannerUrl: CATALOGUE_IMAGES.chanderi[0],
    offerDetail: "10% off the first order with code WELCOME10",
    audience: "NEW_CUSTOMERS",
    status: "ACTIVE",
    viewCount: 0,
    clickCount: 0,
    conversionCount: 0,
    startsAt: daysFromNow(-60),
    endsAt: daysFromNow(120),
  },
  {
    name: "Handloom Week Feature",
    description:
      "Editorial feature on the Chanderi and Pochampally weaving clusters, scheduled for National Handloom Day.",
    bannerUrl: CATALOGUE_IMAGES.ikat[0],
    offerDetail: "Free shipping on all handloom sarees",
    audience: "ALL",
    status: "SCHEDULED",
    viewCount: 0,
    clickCount: 0,
    conversionCount: 0,
    startsAt: daysFromNow(4),
    endsAt: daysFromNow(11),
  },
  {
    name: "Summer Cottons Clearance",
    description: "End-of-season clearance on printed cotton sarees and dress materials.",
    bannerUrl: CATALOGUE_IMAGES.blockprint[0],
    offerDetail: "25% off with code SUMMER25",
    audience: "ALL",
    status: "COMPLETED",
    viewCount: 0,
    clickCount: 0,
    conversionCount: 0,
    startsAt: daysFromNow(-150),
    endsAt: daysFromNow(-30),
  },
  /**
   * A draft whose window has already opened, and a cancelled one. Neither state
   * arises without a person, so without these two the campaign list would have
   * empty "Drafts" and "Cancelled" tabs — and the marketing dashboard's
   * "should have started by now" warning, which is the one thing on that screen
   * nothing else surfaces, would have nothing to warn about.
   */
  {
    name: "Republic Day Weaves",
    description:
      "Planned feature on regional handloom traditions, still being written.",
    bannerUrl: CATALOGUE_IMAGES.ikat[1],
    offerDetail: "To be confirmed",
    audience: "ALL",
    status: "DRAFT",
    viewCount: 0,
    clickCount: 0,
    conversionCount: 0,
    startsAt: daysFromNow(-2),
    endsAt: daysFromNow(12),
  },
  {
    name: "Monsoon Linen Edit",
    description:
      "Cancelled before launch — the linen range did not arrive from the mill in time.",
    bannerUrl: CATALOGUE_IMAGES.cotton[1],
    offerDetail: "Was to be 15% off linen by the metre",
    audience: "RETURNING",
    status: "CANCELLED",
    viewCount: 0,
    clickCount: 0,
    conversionCount: 0,
    startsAt: daysFromNow(-45),
    endsAt: daysFromNow(-15),
  },
];

// ---------------------------------------------------------------------------
// CMS pages — every one of these is linked from the footer, so every one of
// them must exist. SRS §146, §153.
// ---------------------------------------------------------------------------

const P = (...paras: string[]) => paras.map((t) => `<p>${t}</p>`).join("\n");

const CMS_PAGES = [
  {
    slug: "about-us",
    title: "About Saawariya",
    metaTitle: "About Saawariya — Handwoven Indian Textiles",
    metaDescription:
      "Saawariya connects India's weaving clusters directly to buyers, retail and wholesale, without the layers in between.",
    bodyHtml:
      P(
        "Saawariya exists to shorten the distance between a loom and the person who ends up wearing what came off it.",
        "Indian handloom passes through an unusual number of hands on its way to a buyer — the weaver, a master weaver, a regional agent, a wholesaler, a distributor, a retailer. Each takes a margin, and the weaver, who did the difficult part, takes the smallest one. We sell directly for the weaving units and co-operatives who make the cloth, and we publish who made each piece.",
      ) +
      "\n<h2>What we sell</h2>\n" +
      P(
        "Sarees, suits, lehengas, dupattas and running fabric from Varanasi, Kanchipuram, Chanderi, Bagru, Pochampally, Phulia and Srikalahasti. Everything is either handwoven, hand-printed or hand-embroidered, and the listing says which.",
        "We sell to individual buyers and to businesses. Wholesale buyers register with a GST number and see trade pricing with minimum order quantities on the same catalogue.",
      ) +
      "\n<h2>How we describe things</h2>\n" +
      P(
        "Handmade cloth is not uniform. Block prints shift slightly between impressions, natural dyes vary between lots, and a handloom saree will have small irregularities a power loom would not. We treat those as the point rather than as defects, and we say so on the listing instead of leaving a buyer to discover it.",
        "Where a piece is machine-made, we say that too.",
      ),
  },
  {
    slug: "contact-us",
    title: "Contact Us",
    metaTitle: "Contact Saawariya",
    metaDescription: "Get in touch with the Saawariya team.",
    bodyHtml:
      P("We answer email within one working day, and calls between 10am and 7pm IST, Monday to Saturday.") +
      "\n<h2>Customer support</h2>\n" +
      P(
        "Email: support@saawariya.example<br>Phone: +91 98100 00008",
        "For anything about an existing order, raising a ticket from your account gives us the order details automatically and is usually faster than email.",
      ) +
      "\n<h2>Seller enquiries</h2>\n" +
      P(
        "If you are a weaving unit, co-operative or textile business and want to sell on Saawariya, write to sellers@saawariya.example or register directly and upload your GST and PAN documents.",
      ) +
      "\n<h2>Registered office</h2>\n" +
      P("Saawariya Textiles Private Limited<br>Varanasi, Uttar Pradesh 221001<br>India"),
  },
  {
    slug: "shipping-policy",
    title: "Shipping Policy",
    metaTitle: "Shipping Policy — Saawariya",
    metaDescription: "Delivery timelines, charges and coverage for Saawariya orders.",
    bodyHtml:
      "<h2>Charges</h2>\n" +
      P(
        `Shipping is free on orders above ₹${(FREE_SHIPPING_THRESHOLD_PAISE / 100).toLocaleString("en-IN")}. Below that, a flat charge of ₹${(FLAT_SHIPPING_PAISE / 100).toLocaleString("en-IN")} applies, shown at checkout before you pay.`,
      ) +
      "\n<h2>Timelines</h2>\n" +
      P(
        "Ready-stock items are dispatched within two working days of payment clearing. Delivery then takes three to seven working days depending on the destination.",
        "Made-to-order pieces — bridal lehengas and anything woven to a specific requirement — carry their own timeline on the product page, typically six to eight weeks. These are stated per product because they cannot be generalised.",
      ) +
      "\n<h2>Coverage</h2>\n" +
      P(
        "We deliver to all serviceable PIN codes in India. Enter your PIN code on the product page to check before ordering.",
        "Every order ships with tracking. You will get the courier name and tracking number by email and SMS when the parcel is picked up.",
      ),
  },
  {
    slug: "return-policy",
    title: "Returns & Refunds",
    metaTitle: "Returns and Refunds — Saawariya",
    metaDescription: "How to return an order and how refunds are processed.",
    bodyHtml:
      "<h2>Return window</h2>\n" +
      P(
        "Returns are accepted within seven days of delivery, provided the item is unused, unwashed and still carries its tags.",
      ) +
      "\n<h2>What cannot be returned</h2>\n" +
      P(
        "Fabric cut to a length you specified, made-to-order and custom-stitched pieces, and items marked non-returnable on the product page. Cut fabric cannot be resold, which is why it is excluded — this is stated on the product page before you order, not only here.",
      ) +
      "\n<h2>If something arrives damaged</h2>\n" +
      P(
        "Raise a ticket within 48 hours with photographs. Damaged and incorrect items are collected at our cost and replaced or refunded in full, including the original shipping charge.",
      ) +
      "\n<h2>Refunds</h2>\n" +
      P(
        "Once a return reaches our warehouse and passes inspection, refunds are issued to the original payment method within five to seven working days. Cash-on-delivery orders are refunded by bank transfer to an account you nominate.",
      ),
  },
  {
    slug: "privacy-policy",
    title: "Privacy Policy",
    metaTitle: "Privacy Policy — Saawariya",
    metaDescription: "What data Saawariya collects and how it is used.",
    bodyHtml:
      P("This policy explains what we collect, why, and what you can ask us to do about it.") +
      "\n<h2>What we collect</h2>\n" +
      P(
        "Your name, email address, mobile number and delivery addresses. For wholesale accounts, your GST number and business details. For sellers, KYC documents required to verify a business.",
        "We record order history and the pages you view while signed in, which is what drives recommendations and your order tracking.",
      ) +
      "\n<h2>Payment data</h2>\n" +
      P(
        "We do not store card numbers, UPI PINs or bank credentials. Payments are handled by our payment gateway, and we receive only a transaction reference and a success or failure result.",
      ) +
      "\n<h2>Who we share it with</h2>\n" +
      P(
        "Courier partners receive the delivery address and contact number needed to deliver. Sellers receive the shipping details for their own orders only. We do not sell personal data.",
      ) +
      "\n<h2>Your rights</h2>\n" +
      P(
        "You can export or delete your account data from your account settings, or by writing to privacy@saawariya.example. Deletion removes personal data but retains invoices where tax law requires us to keep them.",
      ),
  },
  {
    slug: "terms-and-conditions",
    title: "Terms & Conditions",
    metaTitle: "Terms and Conditions — Saawariya",
    metaDescription: "The terms governing use of the Saawariya marketplace.",
    bodyHtml:
      "<h2>Marketplace model</h2>\n" +
      P(
        "Saawariya is a marketplace. Products are sold by independent verified sellers, and the seller of record is named on every product page and invoice. Saawariya facilitates the transaction, payment and delivery.",
      ) +
      "\n<h2>Pricing</h2>\n" +
      P(
        `All prices are in Indian rupees and include GST at ${GST_PERCENT}% on textiles unless stated otherwise. Wholesale pricing is available only to verified business accounts and is subject to the minimum order quantity shown on each product.`,
        "We try to keep prices and stock accurate. Where an obvious error occurs, we will contact you before dispatch and you may cancel for a full refund.",
      ) +
      "\n<h2>Seller obligations</h2>\n" +
      P(
        "Sellers must describe products accurately, hold the stock they list, and dispatch within the agreed window. Persistent inaccuracy, counterfeit goods or misdeclared composition results in delisting.",
      ) +
      "\n<h2>Governing law</h2>\n" +
      P("These terms are governed by Indian law, with jurisdiction in the courts of Varanasi, Uttar Pradesh."),
  },
  {
    slug: "faq",
    title: "Frequently Asked Questions",
    metaTitle: "FAQ — Saawariya",
    metaDescription: "Common questions about ordering, wholesale, returns and authenticity.",
    bodyHtml:
      "<h3>How do I know a saree is genuine handloom?</h3>\n" +
      P(
        "Every listing states whether a piece is handwoven, hand-printed or machine-made, and names the seller and the cluster it came from. Handloom pieces carry small irregularities and a reverse face that is finished as carefully as the front — we photograph both.",
      ) +
      "<h3>What is the difference between retail and wholesale pricing?</h3>\n" +
      P(
        "Wholesale pricing is 25–35% below retail and requires a verified business account with a GST number. Each product sets its own minimum order quantity. Register as a wholesale buyer and upload your GST certificate to see trade prices across the catalogue.",
      ) +
      "<h3>Can I order fabric in a specific length?</h3>\n" +
      P(
        "Yes. Fabric is sold by the metre and you choose the cut at checkout. Cut fabric cannot be returned, as it cannot be resold.",
      ) +
      "<h3>Do you ship outside India?</h3>\n" +
      P("Not currently. We deliver across India, and international shipping is planned."),

  },
];

// ---------------------------------------------------------------------------
// Platform settings — SRS §87. Read by the admin Settings screen.
// ---------------------------------------------------------------------------

const SETTINGS = [
  { key: "platform.name", value: "Saawariya", category: "GENERAL", label: "Platform name", valueType: "STRING" },
  { key: "platform.tagline", value: "Handwoven, direct from the loom", category: "GENERAL", label: "Tagline", valueType: "STRING" },
  { key: "platform.support_email", value: "support@saawariya.example", category: "GENERAL", label: "Support email", valueType: "STRING" },
  { key: "platform.support_phone", value: "+91 98100 00008", category: "GENERAL", label: "Support phone", valueType: "STRING" },
  { key: "platform.currency", value: "INR", category: "CURRENCY", label: "Currency", valueType: "STRING" },
  { key: "platform.currency_symbol", value: "₹", category: "CURRENCY", label: "Currency symbol", valueType: "STRING" },
  { key: "tax.gst_percent", value: String(GST_PERCENT), category: "TAX", label: "GST on textiles (%)", valueType: "NUMBER" },
  { key: "tax.prices_include_gst", value: "true", category: "TAX", label: "Prices shown include GST", valueType: "BOOLEAN" },
  { key: "shipping.free_threshold_paise", value: String(FREE_SHIPPING_THRESHOLD_PAISE), category: "SHIPPING", label: "Free shipping above (paise)", valueType: "NUMBER" },
  { key: "shipping.flat_rate_paise", value: String(FLAT_SHIPPING_PAISE), category: "SHIPPING", label: "Flat shipping rate (paise)", valueType: "NUMBER" },
  { key: "shipping.dispatch_days", value: "2", category: "SHIPPING", label: "Dispatch window (working days)", valueType: "NUMBER" },
  { key: "payment.cod_enabled", value: "true", category: "PAYMENT", label: "Cash on delivery enabled", valueType: "BOOLEAN" },
  { key: "payment.cod_max_order_paise", value: "1000000", category: "PAYMENT", label: "COD limit (paise)", valueType: "NUMBER" },
  { key: "payment.commission_percent", value: "10", category: "PAYMENT", label: "Default seller commission (%)", valueType: "NUMBER" },
  { key: "feature.returns_enabled", value: "true", category: "GENERAL", label: "Returns enabled", valueType: "BOOLEAN" },
  { key: "feature.return_window_days", value: "7", category: "GENERAL", label: "Return window (days)", valueType: "NUMBER" },
  { key: "feature.reviews_moderated", value: "true", category: "GENERAL", label: "Reviews require approval", valueType: "BOOLEAN" },
  { key: "feature.wholesale_enabled", value: "true", category: "GENERAL", label: "Wholesale tier enabled", valueType: "BOOLEAN" },
  { key: "branding.primary_color", value: "#9E302F", category: "BRANDING", label: "Primary brand colour", valueType: "STRING" },
  { key: "branding.accent_color", value: "#F9F8DC", category: "BRANDING", label: "Accent brand colour", valueType: "STRING" },
  { key: "branding.logo_url", value: "/brand/logo-original.jpg", category: "BRANDING", label: "Logo", valueType: "STRING" },
  { key: "seo.default_title", value: "Saawariya — Handwoven Indian Textiles", category: "SEO", label: "Default page title", valueType: "STRING" },
  { key: "seo.default_description", value: "Sarees, suits, lehengas and fabric by the metre, sourced directly from India's weaving clusters.", category: "SEO", label: "Default meta description", valueType: "STRING" },
  { key: "notification.order_email", value: "true", category: "NOTIFICATION", label: "Email on order events", valueType: "BOOLEAN" },
  { key: "notification.order_sms", value: "true", category: "NOTIFICATION", label: "SMS on order events", valueType: "BOOLEAN" },
  { key: "notification.marketing_whatsapp", value: "false", category: "NOTIFICATION", label: "WhatsApp marketing", valueType: "BOOLEAN" },
];

const NEWSLETTER_EMAILS = [
  "priya.nair@saawariya.test",
  "ananya.bose@saawariya.test",
  "kavitha.reddy@saawariya.test",
  "ritu.malhotra@saawariya.test",
  "meera.krishnan@example.test",
  "shreya.pillai@example.test",
  "nandini.rao@example.test",
  "aarti.joshi@example.test",
  "tanvi.mehta@example.test",
  "ishita.ghosh@example.test",
];

export async function seedContent(prisma: PrismaClient) {
  // Banners and campaigns have no natural unique key, so they are replaced
  // wholesale rather than upserted — otherwise re-seeding stacks duplicates.
  await prisma.banner.deleteMany({});
  await prisma.banner.createMany({
    // Per-banner dates win where they are given, so a scheduled or finished
    // banner stays scheduled or finished — the earlier version overwrote every
    // row with the same window and made all three states identical.
    data: BANNERS.map((banner) => ({
      isActive: true,
      startsAt: daysFromNow(-30),
      endsAt: daysFromNow(120),
      ...banner,
    })),
  });

  for (const coupon of COUPONS) {
    const { code, isActive, ...rest } = coupon;
    await prisma.coupon.upsert({
      where: { code },
      update: { ...rest, isActive: isActive ?? true },
      create: { code, ...rest, isActive: isActive ?? true },
    });
  }

  await prisma.campaign.deleteMany({});
  await prisma.campaign.createMany({ data: CAMPAIGNS });
  const broadcasts = await seedCampaignBroadcasts(prisma);

  for (const page of CMS_PAGES) {
    const { slug, ...rest } = page;
    await prisma.cmsPage.upsert({
      where: { slug },
      update: { ...rest, isPublished: true },
      create: { slug, ...rest, isPublished: true },
    });
  }

  for (const setting of SETTINGS) {
    const { key, ...rest } = setting;
    await prisma.setting.upsert({ where: { key }, update: rest, create: { key, ...rest } });
  }

  for (const [i, email] of NEWSLETTER_EMAILS.entries()) {
    await prisma.newsletterSubscriber.upsert({
      where: { email },
      update: {},
      create: { email, subscribedAt: daysFromNow(-i * 6 - 3) },
    });
  }

  console.log(
    `  Content: ${BANNERS.length} banners, ${COUPONS.length} coupons, ` +
      `${CAMPAIGNS.length} campaigns, ${CMS_PAGES.length} pages, ` +
      `${SETTINGS.length} settings, ${NEWSLETTER_EMAILS.length} subscribers, ` +
      `${broadcasts} promotional notifications`,
  );
}

/**
 * The campaign reach figures, produced the only honest way: by writing the
 * notifications they count.
 *
 * A campaign's `viewCount` is set to the number of `PROMOTION` notifications
 * actually created for it, which is exactly what `sendBroadcast` does at
 * runtime. So the number on the campaign screen is a row count, not an
 * assertion, and an evaluator can move it by sending a broadcast themselves.
 *
 * Only `ALL` and `WHOLESALE` audiences are broadcast here. `NEW_CUSTOMERS` and
 * `RETURNING` are defined by whether someone has ordered, and the order seed has
 * not run yet at this point — resolving them now would produce the wrong list
 * and quietly bake the wrong number into the counter.
 */
async function seedCampaignBroadcasts(prisma: PrismaClient): Promise<number> {
  /**
   * Cleared first. `Notification` hangs off `User`, not `Campaign`, so nothing
   * cascades to it — the accumulation that went unnoticed for four phases until
   * Phase 7. Each seed module clears the category it owns; PROMOTION is this
   * one's.
   */
  await prisma.notification.deleteMany({ where: { category: "PROMOTION" } });

  const campaigns = await prisma.campaign.findMany({
    where: {
      status: { in: ["ACTIVE", "COMPLETED"] },
      audience: { in: ["ALL", "WHOLESALE"] },
    },
    select: {
      id: true,
      name: true,
      audience: true,
      offerDetail: true,
      startsAt: true,
    },
  });

  let written = 0;

  for (const campaign of campaigns) {
    const recipients = await prisma.user.findMany({
      where: {
        roleCode: "CUSTOMER",
        status: "ACTIVE",
        ...(campaign.audience === "WHOLESALE"
          ? { customer: { customerType: "WHOLESALE" } }
          : {}),
      },
      select: { id: true },
    });
    if (recipients.length === 0) continue;

    const sentAt = new Date(
      Math.max(campaign.startsAt.getTime(), now.getTime() - 40 * DAY),
    );

    await prisma.notification.createMany({
      data: recipients.map((user) => ({
        userId: user.id,
        title: campaign.name,
        body: campaign.offerDetail ?? campaign.name,
        category: "PROMOTION",
        linkUrl: "/shop",
        // Older promotional messages read; the rest not, so the customer's
        // notification screen shows both states.
        isRead: sentAt.getTime() < now.getTime() - 20 * DAY,
        createdAt: sentAt,
      })),
    });

    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { viewCount: recipients.length },
    });

    written += recipients.length;
  }

  return written;
}
