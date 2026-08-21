import type { PrismaClient } from "../../src/generated/prisma/client";
import { PRODUCT_STATUS } from "../../src/lib/constants";
import { effectiveRetailPaise } from "../../src/lib/catalogue/pricing";
import { slugify } from "../../src/lib/utils";
import { CATALOGUE_IMAGES, type ImagePool } from "./images";
import { SELLERS } from "./sellers";

/**
 * The product catalogue.
 *
 * Money is in PAISE throughout (see src/lib/utils.ts) — ₹12,500 is 1_250_000.
 * Wholesale prices sit 25-35% under retail with a real MOQ, because the dual
 * retail/wholesale pricing in SRS §14 is only demonstrable if the two tiers
 * actually differ on a product a reviewer can open.
 *
 * `minOrderQty` is >1 only on running fabric sold by the metre, which is where
 * a minimum genuinely applies — the seeded HOME_STRIP banner advertises "MOQ
 * from 10 metres" and the FAQ says each product sets its own, so the data has
 * to back that up. A bridal lehenga has no MOQ and must stay at 1; printing
 * "minimum 1" on a one-off piece reads as a restriction where there is none.
 *
 * Statuses are mixed on purpose: the admin product-approval queue (SRS §75)
 * needs pending items to review, and a seller needs to see their own draft and
 * rejected products, or those screens ship empty.
 */

type ProductSeed = {
  name: string;
  seller: string; // SellerSeed.key
  category: string; // Category.slug
  imagePool: ImagePool;
  description: string;
  fabric: string;
  pattern: string;
  occasion: string;
  workType: string;
  color: string;
  weightGrams: number;
  priceRetail: number;
  priceWholesale: number;
  priceOffer?: number;
  minOrderQty?: number;
  maxOrderQty?: number;
  stockQty: number;
  status?: string;
  rejectionReason?: string;
  isFeatured?: boolean;
  isNewArrival?: boolean;
  collection?: string;
  variants?: Array<{ name: string; value: string; priceDeltaPaise?: number; stockQty: number }>;
  /** Spec-block overrides. Left unset, each is derived — see specsFor(). */
  zariType?: string;
  blousePieceCm?: number;
  washCare?: string;
  /** Woven to order. loomWeeks is required alongside it. */
  isMadeToOrder?: boolean;
  loomWeeks?: number;
  /**
   * Extra frames appended after the pool images — see EXTRA_FRAMES below for
   * where they come from and why only a few products carry them.
   */
  extraImages?: Array<{ url: string; alt: string; kind: string }>;
};

const SILKS = new Set([
  "Banarasi Silk",
  "Kanjivaram Silk",
  "Mulberry Silk",
  "Tussar Silk",
]);

/** Fabrics that cannot be washed at home whatever the dye. */
const DRY_CLEAN_ONLY = new Set([
  ...SILKS,
  "Velvet",
  "Organza",
  "Chiffon",
  "Crepe",
  "Georgette",
]);

/**
 * The specification block, derived rather than typed out forty times.
 *
 * Deriving it is not laziness: these three answers follow from the fabric and
 * the work already recorded on the product, and hand-authoring them would let
 * a cotton saree quietly acquire silver zari on a typo. Any product that needs
 * to differ says so explicitly and the override wins.
 */
function specsFor(seed: ProductSeed) {
  const isSilk = SILKS.has(seed.fabric);

  const zariType =
    seed.zariType ??
    (seed.workType === "Zari"
      ? // Real metal zari is wound on a silk core, so it is only claimed where
        // the ground is silk; the same weave on cotton or blends is art silk.
        isSilk
        ? "Pure silver zari, gold gilt"
        : "Art silk zari"
      : "None");

  const washCare =
    seed.washCare ??
    (DRY_CLEAN_ONLY.has(seed.fabric)
      ? "Dry clean only"
      : seed.fabric === "Chanderi"
        ? "Dry clean recommended. Hand wash cold if required."
        : // Cotton and linen, much of it naturally dyed — the platform's own
          // published review describes exactly this first-wash behaviour.
          "Hand wash cold, separately for the first three washes.");

  // Only a saree carries an unstitched blouse piece.
  const blousePieceCm =
    seed.blousePieceCm ?? (seed.category.endsWith("-sarees") ? 80 : null);

  return { zariType, washCare, blousePieceCm };
}

/** Sarees run 5.5m with an unstitched blouse piece; fabric sells by the metre. */
const SAREE_LENGTHS = [
  { name: "Length", value: "5.5 m + blouse piece", stockQty: 0 },
  { name: "Length", value: "6.3 m + blouse piece", priceDeltaPaise: 45_000, stockQty: 0 },
];

const METRE_CUTS = [
  { name: "Cut", value: "1 metre", stockQty: 0 },
  { name: "Cut", value: "2.5 metres", priceDeltaPaise: 0, stockQty: 0 },
  { name: "Cut", value: "5 metres", priceDeltaPaise: 0, stockQty: 0 },
];

const APPAREL_SIZES = [
  { name: "Size", value: "S", stockQty: 0 },
  { name: "Size", value: "M", stockQty: 0 },
  { name: "Size", value: "L", stockQty: 0 },
  { name: "Size", value: "XL", priceDeltaPaise: 15_000, stockQty: 0 },
];

/**
 * Extra gallery frames taken from the client's prototype, 2026-08-21.
 *
 * These are **of undocumented origin** (every source filename on that CDN is
 * the original file names) and their licence is unsettled — the same caveat
 * that governs `public/editorial/`. See `public/catalogue/CREDITS.md` and
 * `assets/frame-reference/README.md` before launch.
 *
 * Two rules were applied when placing them, and both matter if more are added:
 *
 * 1. **The frame has to agree with the listing it hangs on.** Each one is
 *    attached only to a product whose stated `color`, `fabric` and `workType`
 *    actually match what the picture shows — an emerald-and-gold booti frame
 *    goes on the Emerald Green zari georgette, the contrast-border drape goes
 *    on the Mustard & Maroon korvai Kanjivaram. A frame whose colour argued
 *    with the spec block would make the listing contradict itself.
 * 2. **`kind` has to describe what the frame actually shows**, for the same
 *    reason no REVERSE is seeded (see the note at the createMany below). The
 *    two macros are DETAIL; the two shot-on-a-form pieces are DRAPE, which is
 *    a frame type the seeded catalogue otherwise has none of.
 *
 * They are appended to the pool images rather than replacing them, so every
 * product keeps its CC0 museum photography and this is one delete away from
 * being undone.
 */
const EXTRA_FRAMES = {
  banarasiZari: {
    url: "/catalogue/frame-banarasi-zari-detail.jpg",
    alt: "Macro of gold zari floral work woven into deep maroon silk.",
    kind: "DETAIL",
  },
  organzaSequin: {
    url: "/catalogue/frame-organza-sequin-detail.jpg",
    alt: "Close-up of dense gold sequin and thread work on a champagne ground.",
    kind: "DETAIL",
  },
  emeraldBooti: {
    url: "/catalogue/frame-georgette-emerald-booti.jpg",
    alt: "Emerald green cloth folded to show gold booti and a broad zari pallu.",
    kind: "DETAIL",
  },
  korvaiDrape: {
    url: "/catalogue/frame-kanjivaram-korvai-drape.jpg",
    alt: "The saree draped on a form, showing the contrast maroon korvai border against the mustard body.",
    kind: "DRAPE",
  },
  blushDrape: {
    url: "/catalogue/frame-chanderi-blush-drape.jpg",
    alt: "The saree draped, showing the sheer blush body scattered with gold booti and the fall of the pallu.",
    kind: "DRAPE",
  },
} as const;

export const PRODUCTS: ProductSeed[] = [
  // ---- Banarasi (Anil Textiles, Varanasi) --------------------------------
  {
    name: "Pure Zari Banarasi Silk Saree",
    seller: "anil",
    category: "banarasi-sarees",
    imagePool: "banarasi",
    description:
      "A kadhwa-woven Banarasi in pure mulberry silk, with real gold-tested zari carried across the body in scattered booti motifs and a broad pallu of jangla vine. Woven on a pit loom over eleven days. Comes with an unstitched blouse piece cut from the same warp.",
    fabric: "Banarasi Silk",
    pattern: "Woven",
    occasion: "Bridal",
    workType: "Zari",
    color: "Deep Maroon",
    extraImages: [EXTRA_FRAMES.banarasiZari],
    weightGrams: 850,
    priceRetail: 2_450_000,
    priceWholesale: 1_690_000,
    priceOffer: 1_960_000,
    minOrderQty: 1,
    stockQty: 14,
    isFeatured: true,
    collection: "Vivaah Bridal",
    variants: SAREE_LENGTHS,
  },
  {
    name: "Banarasi Katan Silk Saree with Jangla Weave",
    seller: "anil",
    category: "banarasi-sarees",
    imagePool: "banarasi",
    description:
      "Katan silk woven in the jangla tradition — a continuous creeping vine across the full body rather than scattered motifs. Silver zari on a rani pink ground, finished with a scalloped selvedge.",
    fabric: "Banarasi Silk",
    pattern: "Woven",
    occasion: "Wedding",
    workType: "Zari",
    color: "Rani Pink",
    weightGrams: 780,
    priceRetail: 1_875_000,
    priceWholesale: 1_290_000,
    minOrderQty: 1,
    // Nothing on the shelf, but the loom is free: this is the pair to the
    // Kanjivaram below, so both made-to-order states are visible in the demo —
    // one that can only be commissioned, one that can be bought today or
    // commissioned in another colour.
    stockQty: 0,
    isMadeToOrder: true,
    loomWeeks: 8,
    isFeatured: true,
    collection: "Vivaah Bridal",
    variants: SAREE_LENGTHS,
  },
  {
    name: "Banarasi Georgette Saree with Cutwork Booti",
    seller: "anil",
    category: "banarasi-sarees",
    imagePool: "banarasi",
    description:
      "Lightweight khaddi georgette with cutwork booti — the floats are clipped by hand after weaving, leaving a crisp motif and a fabric light enough for a full day. Ideal for receptions in warm weather.",
    fabric: "Georgette",
    pattern: "Woven",
    occasion: "Party",
    workType: "Zari",
    color: "Emerald Green",
    extraImages: [EXTRA_FRAMES.emeraldBooti],
    weightGrams: 480,
    priceRetail: 985_000,
    priceWholesale: 665_000,
    priceOffer: 788_000,
    stockQty: 22,
    isNewArrival: true,
    variants: SAREE_LENGTHS,
  },
  {
    name: "Banarasi Brocade Fabric — Gold Zari",
    seller: "anil",
    category: "brocade-fabric",
    imagePool: "brocade",
    description:
      "Supplementary-weft brocade yardage in the Benares tradition, 44 inches wide. Sold by the metre for lehenga panels, jacket bodies and upholstery. Colour-matched cuts available on bulk orders.",
    fabric: "Banarasi Silk",
    pattern: "Woven",
    occasion: "Ceremonial",
    workType: "Zari",
    color: "Antique Gold",
    weightGrams: 320,
    priceRetail: 285_000,
    priceWholesale: 178_000,
    minOrderQty: 10,
    maxOrderQty: 500,
    stockQty: 240,
    variants: METRE_CUTS,
  },
  {
    name: "Banarasi Zari Dupatta",
    seller: "anil",
    category: "banarasi-dupattas",
    imagePool: "brocade",
    description:
      "A 2.5-metre Banarasi dupatta with a dense zari pallu at both ends and a plain body, cut to layer over a plain suit or a lehenga.",
    fabric: "Banarasi Silk",
    pattern: "Woven",
    occasion: "Festive",
    workType: "Zari",
    color: "Ivory & Gold",
    weightGrams: 260,
    priceRetail: 445_000,
    priceWholesale: 298_000,
    stockQty: 36,
  },
  {
    name: "Banarasi Silk Nehru Jacket Fabric Set",
    seller: "anil",
    category: "nehru-jackets",
    imagePool: "brocade",
    description:
      "A 2-metre brocade cut sized for a bandhgala or Nehru jacket, with matching lining. Tailoring not included.",
    fabric: "Banarasi Silk",
    pattern: "Woven",
    occasion: "Wedding",
    workType: "Zari",
    color: "Midnight Blue",
    weightGrams: 420,
    priceRetail: 385_000,
    priceWholesale: 255_000,
    stockQty: 18,
    isNewArrival: true,
  },

  // ---- Kanjivaram (Meenakshi Silks, Kanchipuram) -------------------------
  {
    name: "Kanjivaram Silk Saree with Korvai Border",
    seller: "meenakshi",
    category: "kanjivaram-sarees",
    imagePool: "kanjivaram",
    description:
      "A true korvai Kanjivaram: body and border are woven on separate warps and interlocked by hand, which is why the contrast border does not bleed into the body. Pure mulberry silk with tested zari, carrying the Silk Mark.",
    fabric: "Kanjivaram Silk",
    pattern: "Woven",
    occasion: "Bridal",
    workType: "Zari",
    color: "Mustard & Maroon",
    extraImages: [EXTRA_FRAMES.korvaiDrape],
    weightGrams: 920,
    priceRetail: 3_250_000,
    priceWholesale: 2_280_000,
    priceOffer: 2_760_000,
    stockQty: 8,
    isFeatured: true,
    collection: "Vivaah Bridal",
    variants: SAREE_LENGTHS,
  },
  {
    name: "Kanjivaram Temple Border Silk Saree",
    seller: "meenakshi",
    category: "kanjivaram-sarees",
    imagePool: "kanjivaram",
    description:
      "Classic gopuram temple-tower border in three-ply silk, with a rudraksham motif running the body and a contrast pallu in traditional arakku red.",
    fabric: "Kanjivaram Silk",
    pattern: "Woven",
    occasion: "Ceremonial",
    workType: "Zari",
    color: "Arakku Red",
    weightGrams: 890,
    priceRetail: 2_890_000,
    priceWholesale: 1_995_000,
    stockQty: 11,
    isMadeToOrder: true,
    loomWeeks: 6,
    isFeatured: true,
    variants: SAREE_LENGTHS,
  },
  {
    name: "Mulberry Silk Saree — Plain Body, Zari Border",
    seller: "meenakshi",
    category: "silk-sarees",
    imagePool: "silk",
    description:
      "A restrained everyday silk: plain body in a single shot colour with a two-inch zari border. The saree to own when the occasion does not call for a bridal weave.",
    fabric: "Mulberry Silk",
    pattern: "Solid",
    occasion: "Office",
    workType: "Zari",
    color: "Teal",
    weightGrams: 620,
    priceRetail: 1_150_000,
    priceWholesale: 780_000,
    priceOffer: 920_000,
    stockQty: 27,
    variants: SAREE_LENGTHS,
  },
  {
    name: "Tussar Silk Saree with Hand-Painted Pallu",
    seller: "meenakshi",
    category: "silk-sarees",
    imagePool: "silk",
    description:
      "Wild tussar with its characteristic dull gold slub, finished with a hand-painted kalamkari pallu. Each pallu differs slightly — the painting is drawn freehand with a kalam.",
    fabric: "Tussar Silk",
    pattern: "Printed",
    occasion: "Festive",
    workType: "Handloom",
    color: "Natural Gold",
    weightGrams: 540,
    priceRetail: 1_385_000,
    priceWholesale: 940_000,
    stockQty: 16,
    isNewArrival: true,
    variants: SAREE_LENGTHS,
  },
  {
    name: "Pure Silk Fabric by the Metre",
    seller: "meenakshi",
    category: "silk-fabric",
    imagePool: "silk",
    description:
      "Undyed-to-order mulberry silk yardage, 45 inches wide, 80 gsm. Minimum ten metres on wholesale. Shade cards despatched free on request.",
    fabric: "Mulberry Silk",
    pattern: "Solid",
    occasion: "Casual",
    workType: "None",
    color: "Shell White",
    weightGrams: 180,
    priceRetail: 138_000,
    priceWholesale: 82_000,
    minOrderQty: 10,
    maxOrderQty: 1000,
    stockQty: 620,
    variants: METRE_CUTS,
  },
  {
    name: "Kashmir Weave Silk Stole with Boteh Motif",
    seller: "meenakshi",
    category: "silk-stoles",
    imagePool: "shawl",
    description:
      "A fine-weave stole carrying the boteh — the curved almond figure that travelled from Kashmir to Paisley and took that town's name. 70 × 200 cm.",
    fabric: "Mulberry Silk",
    pattern: "Woven",
    occasion: "Casual",
    workType: "Handloom",
    color: "Charcoal & Rust",
    weightGrams: 210,
    priceRetail: 325_000,
    priceWholesale: 215_000,
    stockQty: 42,
  },

  // ---- Chanderi (Chanderi Handloom Collective) ---------------------------
  {
    name: "Chanderi Silk-Cotton Saree with Nakshi Border",
    seller: "chanderi",
    category: "chanderi-sarees",
    imagePool: "chanderi",
    description:
      "Chanderi's signature transparency comes from an unbleached, untwisted yarn that is never degummed. Sheer, feather-light and traditionally finished with a nakshi border in fine zari.",
    fabric: "Chanderi",
    pattern: "Woven",
    occasion: "Festive",
    workType: "Handloom",
    color: "Powder Blue",
    weightGrams: 380,
    priceRetail: 685_000,
    priceWholesale: 448_000,
    priceOffer: 548_000,
    stockQty: 31,
    isFeatured: true,
    variants: SAREE_LENGTHS,
  },
  {
    name: "Chanderi Saree with Gold Booti",
    seller: "chanderi",
    category: "chanderi-sarees",
    imagePool: "chanderi",
    description:
      "Hand-woven Chanderi scattered with small gold booti across the body. Light enough to fold into a matchbox, as the weave is traditionally described.",
    fabric: "Chanderi",
    pattern: "Woven",
    occasion: "Party",
    workType: "Zari",
    color: "Blush Pink",
    extraImages: [EXTRA_FRAMES.blushDrape],
    weightGrams: 360,
    priceRetail: 595_000,
    priceWholesale: 385_000,
    stockQty: 24,
    variants: SAREE_LENGTHS,
  },
  {
    name: "Chanderi Unstitched Dress Material Set",
    seller: "chanderi",
    category: "dress-materials",
    imagePool: "chanderi",
    description:
      "Three-piece unstitched set — 2.5 m top, 2.5 m bottom and a 2.25 m dupatta — in matched Chanderi. Cut to fit rather than bought to fit.",
    fabric: "Chanderi",
    pattern: "Woven",
    occasion: "Festive",
    workType: "Handloom",
    color: "Sage Green",
    weightGrams: 640,
    priceRetail: 425_000,
    priceWholesale: 278_000,
    stockQty: 38,
    isNewArrival: true,
  },
  {
    name: "Chanderi Cotton-Silk Fabric",
    seller: "chanderi",
    category: "cotton-fabric",
    imagePool: "chanderi",
    description:
      "Running Chanderi in a 60/40 silk-cotton blend, 44 inches wide. The wholesale staple for boutique kurta lines.",
    fabric: "Chanderi",
    pattern: "Solid",
    occasion: "Casual",
    workType: "Handloom",
    color: "Ecru",
    weightGrams: 150,
    priceRetail: 62_000,
    priceWholesale: 38_000,
    minOrderQty: 20,
    maxOrderQty: 800,
    stockQty: 480,
    variants: METRE_CUTS,
  },

  // ---- Rajwadi Prints (Jaipur, block print & wholesale) ------------------
  {
    name: "Bagru Hand Block Print Cotton Saree",
    seller: "rajwadi",
    category: "cotton-sarees",
    imagePool: "blockprint",
    description:
      "Printed at Bagru with hand-carved teak blocks in natural dyes — indigo, madder root and pomegranate rind. Slight registration shifts between block impressions are inherent to the process, not defects.",
    fabric: "Cotton",
    pattern: "Block Print",
    occasion: "Casual",
    workType: "Handloom",
    color: "Indigo & Madder",
    weightGrams: 420,
    priceRetail: 285_000,
    priceWholesale: 172_000,
    priceOffer: 228_000,
    stockQty: 56,
    isFeatured: true,
    variants: SAREE_LENGTHS,
  },
  {
    name: "Sanganeri Block Print Cotton Fabric",
    seller: "rajwadi",
    category: "block-print-fabric",
    imagePool: "blockprint",
    description:
      "Fine Sanganeri floral repeats on a white ground, 44 inches wide. The mainstay of summer kurta and dress production. Bulk pricing from 50 metres.",
    fabric: "Cotton",
    pattern: "Block Print",
    occasion: "Casual",
    workType: "None",
    color: "White & Red",
    weightGrams: 130,
    priceRetail: 42_000,
    priceWholesale: 24_000,
    minOrderQty: 25,
    maxOrderQty: 1000,
    stockQty: 850,
    variants: METRE_CUTS,
  },
  {
    name: "Bandhani Cotton Saree — Gujarati Tie-Dye",
    seller: "rajwadi",
    category: "bandhani-ikat-sarees",
    imagePool: "ikat",
    description:
      "Bandhani is tied dot by dot before dyeing — a single saree can carry tens of thousands of individually knotted points. Arrives with the ties still in place; open them by pulling the fabric on the bias.",
    fabric: "Cotton",
    pattern: "Bandhani",
    occasion: "Festive",
    workType: "None",
    color: "Red & Yellow",
    weightGrams: 390,
    priceRetail: 345_000,
    priceWholesale: 215_000,
    stockQty: 43,
    variants: SAREE_LENGTHS,
  },
  {
    name: "Pochampally Ikat Silk Saree",
    seller: "rajwadi",
    category: "bandhani-ikat-sarees",
    imagePool: "ikat",
    description:
      "Double-ikat from Pochampally, where warp and weft are both resist-dyed before weaving so the pattern is built from yarn rather than printed on cloth. The soft feathered edges are the signature of true ikat.",
    fabric: "Mulberry Silk",
    pattern: "Ikat",
    occasion: "Wedding",
    workType: "Handloom",
    color: "Vermilion",
    weightGrams: 660,
    priceRetail: 1_450_000,
    priceWholesale: 975_000,
    priceOffer: 1_160_000,
    stockQty: 12,
    isFeatured: true,
    variants: SAREE_LENGTHS,
  },
  {
    name: "Kalamkari Hand-Painted Cotton Fabric",
    seller: "rajwadi",
    category: "kalamkari-fabric",
    imagePool: "kalamkari",
    description:
      "Srikalahasti kalamkari drawn with a bamboo kalam and set with natural mordants over a seventeen-stage process. Each metre is drawn by hand and no two repeats match exactly.",
    fabric: "Cotton",
    pattern: "Printed",
    occasion: "Casual",
    workType: "Handloom",
    color: "Natural & Indigo",
    weightGrams: 160,
    priceRetail: 118_000,
    priceWholesale: 68_000,
    minOrderQty: 10,
    maxOrderQty: 600,
    stockQty: 310,
    variants: METRE_CUTS,
  },
  {
    name: "Block Print Cotton Cushion Cover — Set of 4",
    seller: "rajwadi",
    category: "cushion-covers",
    imagePool: "blockprint",
    description:
      "Four 16 × 16 inch covers in coordinated Bagru prints, with concealed zips and piped edges. Inserts not included.",
    fabric: "Cotton",
    pattern: "Block Print",
    occasion: "Casual",
    workType: "None",
    color: "Indigo",
    weightGrams: 480,
    priceRetail: 148_000,
    priceWholesale: 88_000,
    stockQty: 64,
    isNewArrival: true,
  },
  {
    name: "Kalamkari Table Runner with Napkins",
    seller: "rajwadi",
    category: "table-linen",
    imagePool: "kalamkari",
    description:
      "A 14 × 72 inch runner with six matching napkins, block-printed in madder and iron-black on cotton.",
    fabric: "Cotton",
    pattern: "Printed",
    occasion: "Casual",
    workType: "None",
    color: "Rust & Cream",
    weightGrams: 560,
    priceRetail: 132_000,
    priceWholesale: 79_000,
    stockQty: 47,
  },
  {
    name: "Handloom Cotton Kurta for Men",
    seller: "rajwadi",
    category: "mens-kurtas",
    imagePool: "mens",
    description:
      "A straight-cut kurta in handloom cotton with a mandarin collar and side slits. Pre-washed, so it will not shrink further.",
    fabric: "Cotton",
    pattern: "Solid",
    occasion: "Casual",
    workType: "Handloom",
    color: "Off White",
    weightGrams: 340,
    priceRetail: 189_000,
    priceWholesale: 112_000,
    priceOffer: 151_000,
    stockQty: 88,
    variants: APPAREL_SIZES,
  },
  {
    name: "Block Print Cotton Dhoti with Temple Border",
    seller: "rajwadi",
    category: "dhoti-angavastram",
    imagePool: "cotton",
    description:
      "A 4.5-metre fine cotton dhoti with a woven temple border and matching angavastram.",
    fabric: "Cotton",
    pattern: "Solid",
    occasion: "Ceremonial",
    workType: "Handloom",
    color: "Cream & Gold",
    weightGrams: 300,
    priceRetail: 96_000,
    priceWholesale: 58_000,
    stockQty: 72,
  },

  // ---- Bengal Loom House (UNDER_REVIEW seller — products stay unpublished)
  {
    name: "Dhakai Jamdani Cotton Saree",
    seller: "bengal",
    category: "cotton-sarees",
    imagePool: "jamdani",
    description:
      "Jamdani is a supplementary-weft figuring technique worked entirely by hand at the loom, with no jacquard and no punch cards — the weaver counts every thread. Recognised by UNESCO as intangible cultural heritage.",
    fabric: "Cotton",
    pattern: "Woven",
    occasion: "Festive",
    workType: "Handloom",
    color: "Off White & Grey",
    weightGrams: 450,
    priceRetail: 1_250_000,
    priceWholesale: 845_000,
    stockQty: 6,
    // The seller is still under review, so nothing of theirs can be public yet.
    status: PRODUCT_STATUS.PENDING,
    variants: SAREE_LENGTHS,
  },
  {
    name: "Bengal Tant Cotton Saree",
    seller: "bengal",
    category: "cotton-sarees",
    imagePool: "cotton",
    description:
      "The everyday Bengali tant — crisp, airy handloom cotton with a broad contrast border, woven at Phulia and Shantipur.",
    fabric: "Cotton",
    pattern: "Woven",
    occasion: "Casual",
    workType: "Handloom",
    color: "White & Red",
    weightGrams: 400,
    priceRetail: 168_000,
    priceWholesale: 98_000,
    stockQty: 40,
    status: PRODUCT_STATUS.PENDING,
    variants: SAREE_LENGTHS,
  },
  {
    name: "Jamdani Woven Cotton Bedcover",
    seller: "bengal",
    category: "bed-linen",
    imagePool: "jamdani",
    description:
      "A double-bed cover in handloom cotton with jamdani figuring along the borders. 108 × 108 inches.",
    fabric: "Cotton",
    pattern: "Woven",
    occasion: "Casual",
    workType: "Handloom",
    color: "Ivory",
    weightGrams: 1_400,
    priceRetail: 385_000,
    priceWholesale: 240_000,
    stockQty: 15,
    status: PRODUCT_STATUS.PENDING,
  },

  // ---- Items exercising the rest of the approval workflow ----------------
  {
    name: "Phulkari Bagh Dupatta — Punjab Darn Stitch",
    seller: "chanderi",
    category: "phulkari-dupattas",
    imagePool: "phulkari",
    description:
      "Phulkari is worked from the reverse of the cloth in floss silk, the stitch length alone creating the sheen. In a full bagh the ground cloth is covered entirely — this piece follows that older, denser tradition.",
    fabric: "Cotton",
    pattern: "Embroidered",
    occasion: "Festive",
    workType: "Thread Work",
    color: "Crimson & Gold",
    weightGrams: 420,
    priceRetail: 545_000,
    priceWholesale: 365_000,
    stockQty: 19,
    isFeatured: true,
  },
  {
    name: "Phulkari Embroidered Wall Panel",
    seller: "chanderi",
    category: "wall-hangings",
    imagePool: "phulkari",
    description:
      "A framed 30 × 40 inch phulkari panel worked in the sainchi style, which records village scenes rather than geometric florals.",
    fabric: "Cotton",
    pattern: "Embroidered",
    occasion: "Casual",
    workType: "Thread Work",
    color: "Multicolour",
    weightGrams: 900,
    priceRetail: 425_000,
    priceWholesale: 285_000,
    stockQty: 8,
    isNewArrival: true,
  },
  {
    name: "Georgette Anarkali Suit with Zardozi Yoke",
    seller: "meenakshi",
    category: "anarkali-suits",
    imagePool: "suits",
    description:
      "A floor-length anarkali with a hand-worked zardozi yoke in metal coil and sequin, on a georgette flare with a full-circle ghera. Includes churidar and a net dupatta.",
    fabric: "Georgette",
    pattern: "Embroidered",
    occasion: "Wedding",
    workType: "Zardozi",
    color: "Wine",
    weightGrams: 980,
    priceRetail: 1_285_000,
    priceWholesale: 860_000,
    priceOffer: 1_028_000,
    stockQty: 21,
    isFeatured: true,
    variants: APPAREL_SIZES,
  },
  {
    name: "Cotton Straight Suit Set with Dupatta",
    seller: "rajwadi",
    category: "straight-suits",
    imagePool: "suits",
    description:
      "A stitched straight-cut kameez with matching salwar and a mulmul dupatta, in a Bagru print. The everyday set.",
    fabric: "Cotton",
    pattern: "Block Print",
    occasion: "Office",
    workType: "None",
    color: "Mustard",
    weightGrams: 720,
    priceRetail: 245_000,
    priceWholesale: 148_000,
    stockQty: 54,
    variants: APPAREL_SIZES,
  },
  {
    name: "Printed Rayon Kurti",
    seller: "rajwadi",
    category: "kurtis",
    imagePool: "suits",
    description:
      "An A-line rayon kurti with side slits and three-quarter sleeves, cut for office wear and daily use.",
    fabric: "Crepe",
    pattern: "Printed",
    occasion: "Office",
    workType: "None",
    color: "Navy",
    weightGrams: 280,
    priceRetail: 89_000,
    priceWholesale: 52_000,
    priceOffer: 71_000,
    stockQty: 120,
    variants: APPAREL_SIZES,
  },
  {
    name: "Velvet Bridal Lehenga with Zardozi Work",
    seller: "meenakshi",
    category: "bridal-lehengas",
    imagePool: "lehenga",
    description:
      "A bridal set in silk velvet with dense zardozi across the ghera, a boned choli and a scalloped net dupatta. Made to order in six to eight weeks; the listed piece is the sample.",
    fabric: "Velvet",
    pattern: "Embroidered",
    occasion: "Bridal",
    workType: "Zardozi",
    color: "Deep Red",
    weightGrams: 3_200,
    priceRetail: 6_850_000,
    priceWholesale: 4_950_000,
    stockQty: 3,
    isFeatured: true,
    collection: "Vivaah Bridal",
    variants: APPAREL_SIZES,
  },
  {
    name: "Organza Party Lehenga with Sequin Work",
    seller: "meenakshi",
    category: "party-lehengas",
    imagePool: "lehenga",
    description:
      "A lighter organza lehenga with all-over sequin scatter, cut for sangeet and mehendi rather than the ceremony itself.",
    fabric: "Organza",
    pattern: "Embroidered",
    occasion: "Party",
    workType: "Sequin",
    color: "Champagne",
    extraImages: [EXTRA_FRAMES.organzaSequin],
    weightGrams: 1_450,
    priceRetail: 2_150_000,
    priceWholesale: 1_480_000,
    priceOffer: 1_720_000,
    stockQty: 9,
    isNewArrival: true,
    variants: APPAREL_SIZES,
  },
  {
    name: "Linen Saree with Silver Zari Border",
    seller: "chanderi",
    category: "cotton-sarees",
    imagePool: "cotton",
    description:
      "Pure linen in a 100-lea count with a fine silver zari border. Crisp when new, softening with every wash.",
    fabric: "Linen",
    pattern: "Solid",
    occasion: "Office",
    workType: "Zari",
    color: "Slate Grey",
    weightGrams: 430,
    priceRetail: 385_000,
    priceWholesale: 248_000,
    stockQty: 33,
    isNewArrival: true,
    variants: SAREE_LENGTHS,
  },
  {
    name: "Handloom Cotton Fabric — Natural Dye",
    seller: "chanderi",
    category: "cotton-fabric",
    imagePool: "cotton",
    description:
      "Khadi-spun handloom cotton dyed with indigo and harda, 42 inches wide. Sold by the metre; shade variation between lots is expected with natural dye.",
    fabric: "Cotton",
    pattern: "Solid",
    occasion: "Casual",
    workType: "Handloom",
    color: "Indigo",
    weightGrams: 140,
    priceRetail: 48_000,
    priceWholesale: 27_000,
    minOrderQty: 25,
    maxOrderQty: 1000,
    stockQty: 720,
    variants: METRE_CUTS,
  },

  // ---- Approval-workflow edge cases -------------------------------------
  {
    name: "Chiffon Saree with Digital Floral Print",
    seller: "rajwadi",
    category: "cotton-sarees",
    imagePool: "silk",
    description:
      "A printed chiffon saree in a contemporary floral, with a narrow satin border.",
    fabric: "Chiffon",
    pattern: "Printed",
    occasion: "Party",
    workType: "None",
    color: "Peach",
    weightGrams: 310,
    priceRetail: 165_000,
    priceWholesale: 98_000,
    stockQty: 25,
    // Waiting on a catalogue moderator — SRS §75.
    status: PRODUCT_STATUS.PENDING,
  },
  {
    name: "Crepe Silk Saree with Contrast Pallu",
    seller: "meenakshi",
    category: "silk-sarees",
    imagePool: "silk",
    description:
      "Soft crepe silk in a solid shade with a contrast pallu and a hand-rolled edge.",
    fabric: "Crepe",
    pattern: "Solid",
    occasion: "Office",
    workType: "None",
    color: "Olive",
    weightGrams: 470,
    priceRetail: 745_000,
    priceWholesale: 495_000,
    stockQty: 18,
    status: PRODUCT_STATUS.PENDING,
  },
  {
    name: "Art Silk Saree — Machine Woven",
    seller: "rajwadi",
    category: "silk-sarees",
    imagePool: "silk",
    description: "Machine-woven art silk saree with an all-over woven motif.",
    fabric: "Mulberry Silk",
    pattern: "Woven",
    occasion: "Festive",
    workType: "None",
    color: "Purple",
    weightGrams: 500,
    priceRetail: 225_000,
    priceWholesale: 135_000,
    stockQty: 30,
    // A rejection a reviewer can read the reason for, on the seller's screen.
    status: PRODUCT_STATUS.REJECTED,
    rejectionReason:
      "Listed as 'Art Silk' under Silk Sarees but the fabric declaration says polyester blend. Move to a synthetic category or correct the composition, and re-submit.",
  },
  {
    name: "Mysore Silk Saree with Gold Border",
    seller: "meenakshi",
    category: "silk-sarees",
    imagePool: "silk",
    description:
      "Mysore crepe silk with a plain body and a fine gold border. Photography and final pricing still to be confirmed.",
    fabric: "Mulberry Silk",
    pattern: "Solid",
    occasion: "Festive",
    workType: "Zari",
    color: "Turmeric",
    weightGrams: 520,
    priceRetail: 895_000,
    priceWholesale: 598_000,
    stockQty: 0,
    // Seller's own work-in-progress — visible to them, nobody else.
    status: PRODUCT_STATUS.DRAFT,
  },
];

/** SKUs read SAAW-<SELLER>-<NNN> so they sort and group usefully in admin lists. */
function skuFor(sellerKey: string, index: number) {
  return `SAAW-${sellerKey.slice(0, 3).toUpperCase()}-${String(index + 1).padStart(3, "0")}`;
}

export async function seedProducts(
  prisma: PrismaClient,
  sellerIds: Map<string, string>,
) {
  const categories = await prisma.category.findMany({ select: { id: true, slug: true } });
  const categoryIds = new Map(categories.map((c) => [c.slug, c.id]));

  const admin = await prisma.user.findUnique({
    where: { email: "admin@saawariya.test" },
    select: { id: true },
  });

  const perSeller = new Map<string, number>();
  const productIds: string[] = [];

  for (const seed of PRODUCTS) {
    const sellerId = sellerIds.get(seed.seller);
    const categoryId = categoryIds.get(seed.category);
    if (!sellerId || !categoryId) {
      throw new Error(
        `Product "${seed.name}" references missing ${sellerId ? "category " + seed.category : "seller " + seed.seller}`,
      );
    }

    const n = perSeller.get(seed.seller) ?? 0;
    perSeller.set(seed.seller, n + 1);

    // On a marketplace the brand belongs to the seller, not the platform.
    const sellerName = SELLERS.find((s) => s.key === seed.seller)?.businessName ?? null;

    const status = seed.status ?? PRODUCT_STATUS.APPROVED;
    const isApproved = status === PRODUCT_STATUS.APPROVED;
    const slug = slugify(seed.name);

    const data = {
      name: seed.name,
      description: seed.description,
      sellerId,
      categoryId,
      brand: sellerName,
      collection: seed.collection ?? null,
      fabric: seed.fabric,
      pattern: seed.pattern,
      occasion: seed.occasion,
      workType: seed.workType,
      color: seed.color,
      weightGrams: seed.weightGrams,
      priceRetail: seed.priceRetail,
      priceWholesale: seed.priceWholesale,
      priceOffer: seed.priceOffer ?? null,
      // Denormalised sort/filter key. Derived, never authored — see the column
      // comment in prisma/schema.prisma.
      priceEffective: effectiveRetailPaise({
        priceRetail: seed.priceRetail,
        priceOffer: seed.priceOffer ?? null,
      }),
      minOrderQty: seed.minOrderQty ?? 1,
      maxOrderQty: seed.maxOrderQty ?? 100,
      status,
      rejectionReason: seed.rejectionReason ?? null,
      approvedById: isApproved ? (admin?.id ?? null) : null,
      approvedAt: isApproved ? new Date("2026-07-01T08:00:00Z") : null,
      isFeatured: seed.isFeatured ?? false,
      isNewArrival: seed.isNewArrival ?? false,
      ...specsFor(seed),
      isMadeToOrder: seed.isMadeToOrder ?? false,
      loomWeeks: seed.loomWeeks ?? null,
    };

    const product = await prisma.product.upsert({
      where: { sku: skuFor(seed.seller, n) },
      update: data,
      create: { sku: skuFor(seed.seller, n), slug, ...data },
    });
    productIds.push(product.id);

    // Images: pull a rotating window from the pool matching this textile type,
    // so two products in the same category do not open with the same photo.
    // Never take more than the pool holds — repeating an image inside a single
    // product's gallery is more obvious than simply showing fewer.
    const pool = CATALOGUE_IMAGES[seed.imagePool];
    const offset = n % pool.length;
    const picked = Array.from({ length: Math.min(3, pool.length) }, (_, k) => (
      pool[(offset + k) % pool.length]
    ));

    await prisma.productImage.deleteMany({ where: { productId: product.id } });
    await prisma.productImage.createMany({
      // No REVERSE frame is seeded, and that is deliberate. The catalogue
      // images are photographs of museum textile holdings shot from the front;
      // labelling one of them "the reverse" would put a claim on the product
      // page that the picture does not support. The seeded catalogue therefore
      // shows the honest state — reverse not yet supplied — which is also the
      // state the seller form and the approval checklist are built to chase.
      data: [
        ...picked.map((url, i) => ({
          productId: product.id,
          url,
          alt: `${seed.name} — view ${i + 1}`,
          sortOrder: i,
          isMain: i === 0,
          kind: i === 0 ? "FRONT" : "DETAIL",
        })),
        // Appended after the pool, never isMain: the CC0 museum photograph
        // stays the frame the product card opens with.
        ...(seed.extraImages ?? []).map((frame, i) => ({
          productId: product.id,
          url: frame.url,
          alt: frame.alt,
          sortOrder: picked.length + i,
          isMain: false,
          kind: frame.kind,
        })),
      ],
    });

    // Variants split the product's stock between them; the sum matches Inventory.
    if (seed.variants?.length) {
      const split = Math.floor(seed.stockQty / seed.variants.length);
      const remainder = seed.stockQty - split * seed.variants.length;
      await prisma.productVariant.deleteMany({ where: { productId: product.id } });
      await prisma.productVariant.createMany({
        data: seed.variants.map((v, i) => ({
          productId: product.id,
          name: v.name,
          value: v.value,
          sku: `${skuFor(seed.seller, n)}-V${i + 1}`,
          priceDeltaPaise: v.priceDeltaPaise ?? 0,
          stockQty: split + (i === 0 ? remainder : 0),
        })),
      });
    }

    const inventoryStatus =
      seed.stockQty === 0
        ? "OUT_OF_STOCK"
        : seed.stockQty <= 5
          ? "LOW_STOCK"
          : "IN_STOCK";

    const inventory = await prisma.inventory.upsert({
      where: { productId: product.id },
      update: { stockQty: seed.stockQty, status: inventoryStatus },
      create: {
        productId: product.id,
        stockQty: seed.stockQty,
        lowStockThreshold: 5,
        status: inventoryStatus,
      },
    });

    // Opening balance on the stock ledger, so movements have a starting point
    // rather than stock appearing from nowhere — SRS §97.
    await prisma.stockMovement.deleteMany({ where: { inventoryId: inventory.id } });
    if (seed.stockQty > 0) {
      await prisma.stockMovement.create({
        data: {
          inventoryId: inventory.id,
          changeQty: seed.stockQty,
          reason: "SELLER_RESTOCK",
          note: "Opening stock recorded at catalogue listing.",
        },
      });
    }
  }

  const byStatus = PRODUCTS.reduce<Record<string, number>>((acc, p) => {
    const s = p.status ?? PRODUCT_STATUS.APPROVED;
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});
  console.log(
    `  Products: ${PRODUCTS.length} (` +
      Object.entries(byStatus)
        .map(([k, v]) => `${v} ${k.toLowerCase()}`)
        .join(", ") +
      ")",
  );

  return productIds;
}
