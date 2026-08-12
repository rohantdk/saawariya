/**
 * Domain constants.
 *
 * The Prisma schema stores status fields as `String` rather than native enums,
 * so the database stays portable between SQLite (local) and PostgreSQL
 * (production) — see the note at the top of prisma/schema.prisma. These const
 * objects and their derived union types are what actually constrain those
 * columns, and they are the single source of truth for every label, badge and
 * dropdown in the UI.
 */

// ---------------------------------------------------------------------------
// ROLES — SRS §16, §17, §173
//
// SRS §16 lists ELEVEN role subsections; there are NINE role codes here. That is
// deliberate, not an omission — see docs/ROLES.md for the full rationale:
//   §16.1 Visitor            -> not a role; the absence of a session
//   §16.3 Wholesale Customer -> CUSTOMER with Customer.customerType = WHOLESALE,
//                               because retail and wholesale hold identical
//                               permissions and differ only in pricing, MOQ and GST
// ---------------------------------------------------------------------------

export const ROLES = {
  CUSTOMER: "CUSTOMER",
  SELLER: "SELLER",
  WAREHOUSE: "WAREHOUSE",
  QC: "QC",
  LOGISTICS: "LOGISTICS",
  FINANCE: "FINANCE",
  SUPPORT: "SUPPORT",
  MARKETING: "MARKETING",
  SUPER_ADMIN: "SUPER_ADMIN",
} as const;

export type RoleCode = (typeof ROLES)[keyof typeof ROLES];

/** Where each role lands after signing in. */
export const ROLE_HOME: Record<RoleCode, string> = {
  CUSTOMER: "/account",
  SELLER: "/seller",
  WAREHOUSE: "/operations/warehouse",
  QC: "/operations/qc",
  LOGISTICS: "/operations/logistics",
  FINANCE: "/admin/finance",
  SUPPORT: "/admin/support",
  MARKETING: "/admin/marketing",
  SUPER_ADMIN: "/admin",
};

export const ROLE_LABEL: Record<RoleCode, string> = {
  CUSTOMER: "Customer",
  SELLER: "Seller",
  WAREHOUSE: "Warehouse",
  QC: "Quality Control",
  LOGISTICS: "Logistics",
  FINANCE: "Finance",
  SUPPORT: "Customer Support",
  MARKETING: "Marketing",
  SUPER_ADMIN: "Super Admin",
};

/** Roles permitted into the /admin area (SRS §88). */
export const ADMIN_ROLES: RoleCode[] = [
  ROLES.SUPER_ADMIN,
  ROLES.FINANCE,
  ROLES.SUPPORT,
  ROLES.MARKETING,
];

/** Roles permitted into the /operations area (SRS §114). */
export const OPERATIONS_ROLES: RoleCode[] = [
  ROLES.WAREHOUSE,
  ROLES.QC,
  ROLES.LOGISTICS,
  ROLES.SUPER_ADMIN,
];

// ---------------------------------------------------------------------------
// USER & SELLER STATUS
// ---------------------------------------------------------------------------

export const USER_STATUS = {
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  PENDING: "PENDING",
} as const;
export type UserStatus = (typeof USER_STATUS)[keyof typeof USER_STATUS];

/** SRS §55 */
export const SELLER_VERIFICATION = {
  PENDING: "PENDING",
  UNDER_REVIEW: "UNDER_REVIEW",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  SUSPENDED: "SUSPENDED",
} as const;
export type SellerVerification =
  (typeof SELLER_VERIFICATION)[keyof typeof SELLER_VERIFICATION];

export const SELLER_VERIFICATION_LABEL: Record<string, string> = {
  PENDING: "Awaiting review",
  UNDER_REVIEW: "Under review",
  APPROVED: "Verified",
  REJECTED: "Rejected",
  SUSPENDED: "Suspended",
};

/** SRS §54 — the KYC set a seller must supply before they can trade. */
export const SELLER_DOC_TYPE = {
  GST_CERTIFICATE: "GST_CERTIFICATE",
  PAN_CARD: "PAN_CARD",
  CANCELLED_CHEQUE: "CANCELLED_CHEQUE",
  ADDRESS_PROOF: "ADDRESS_PROOF",
} as const;
export type SellerDocType =
  (typeof SELLER_DOC_TYPE)[keyof typeof SELLER_DOC_TYPE];

export const SELLER_DOC_LABEL: Record<string, string> = {
  GST_CERTIFICATE: "GST certificate",
  PAN_CARD: "PAN card",
  CANCELLED_CHEQUE: "Cancelled cheque",
  ADDRESS_PROOF: "Address proof",
};

/** SRS §53 — what kind of business the seller runs. */
export const SELLER_BUSINESS_TYPES = [
  "MANUFACTURER",
  "WHOLESALER",
  "DISTRIBUTOR",
  "RETAILER",
] as const;
export type SellerBusinessType = (typeof SELLER_BUSINESS_TYPES)[number];

export const SELLER_BUSINESS_TYPE_LABEL: Record<string, string> = {
  MANUFACTURER: "Manufacturer",
  WHOLESALER: "Wholesaler",
  DISTRIBUTOR: "Distributor",
  RETAILER: "Retailer",
};

export const CUSTOMER_TYPE = {
  RETAIL: "RETAIL",
  WHOLESALE: "WHOLESALE",
} as const;
export type CustomerType = (typeof CUSTOMER_TYPE)[keyof typeof CUSTOMER_TYPE];

// ---------------------------------------------------------------------------
// CATALOGUE — SRS §59, §75
// ---------------------------------------------------------------------------

export const PRODUCT_STATUS = {
  DRAFT: "DRAFT",
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  HIDDEN: "HIDDEN",
} as const;
export type ProductStatus =
  (typeof PRODUCT_STATUS)[keyof typeof PRODUCT_STATUS];

/** Review moderation — SRS §47. Only APPROVED reviews are ever public. */
export const REVIEW_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;
export type ReviewStatus = (typeof REVIEW_STATUS)[keyof typeof REVIEW_STATUS];

export const REVIEW_PUBLIC_STATUS = REVIEW_STATUS.APPROVED;

export const INVENTORY_STATUS = {
  IN_STOCK: "IN_STOCK",
  LOW_STOCK: "LOW_STOCK",
  OUT_OF_STOCK: "OUT_OF_STOCK",
  DISCONTINUED: "DISCONTINUED",
} as const;
export type InventoryStatus =
  (typeof INVENTORY_STATUS)[keyof typeof INVENTORY_STATUS];

/** Textile facets driving the listing filters — SRS §40, §58, §157. */
export const FABRICS = [
  "Banarasi Silk",
  "Mulberry Silk",
  "Chanderi",
  "Kanjivaram Silk",
  "Tussar Silk",
  "Georgette",
  "Chiffon",
  "Cotton",
  "Linen",
  "Organza",
  "Crepe",
  "Velvet",
] as const;

export const PATTERNS = [
  "Woven",
  "Printed",
  "Embroidered",
  "Solid",
  "Bandhani",
  "Ikat",
  "Block Print",
  "Zari Work",
] as const;

export const OCCASIONS = [
  "Bridal",
  "Wedding",
  "Festive",
  "Party",
  "Casual",
  "Office",
  "Ceremonial",
] as const;

export const WORK_TYPES = [
  "Zari",
  "Zardozi",
  "Mirror Work",
  "Sequin",
  "Thread Work",
  "Stone Work",
  "Handloom",
  "None",
] as const;

/**
 * Colour facet — SRS §157.
 *
 * `Product.color` is free text and the catalogue uses compound, dye-specific
 * names: "Arakku Red", "Charcoal & Rust", "Indigo & Madder". There are 33
 * distinct values across the live catalogue, so a facet built from the raw
 * column would be a list of one-product filters. Colours are grouped into
 * families instead, each matched by substring against `Product.color`.
 *
 * Terms are written in the same Title Case the catalogue uses, deliberately.
 * Prisma compiles `contains` to LIKE, and LIKE is case-insensitive on SQLite
 * but case-SENSITIVE on PostgreSQL — matching the stored casing is what makes
 * this facet behave identically after the Postgres switch described at the top
 * of prisma/schema.prisma. A colour may legitimately sit in two families
 * ("Teal" reads as both blue and green).
 */
export const COLOUR_FAMILIES = [
  { slug: "red", label: "Red & Maroon", swatch: "#9E302F", terms: ["Red", "Maroon", "Crimson", "Arakku", "Vermilion", "Wine"] },
  { slug: "pink", label: "Pink", swatch: "#cf7b9b", terms: ["Pink", "Blush", "Rani"] },
  { slug: "gold", label: "Gold", swatch: "#c8a96a", terms: ["Gold", "Champagne", "Antique"] },
  { slug: "cream", label: "Cream & Natural", swatch: "#ece0c8", terms: ["Cream", "Ivory", "Ecru", "Natural"] },
  { slug: "white", label: "White", swatch: "#f6f4f0", terms: ["White", "Shell"] },
  { slug: "blue", label: "Blue", swatch: "#33507f", terms: ["Blue", "Indigo", "Navy", "Teal"] },
  { slug: "green", label: "Green", swatch: "#3d6f53", terms: ["Green", "Sage", "Emerald", "Teal"] },
  { slug: "yellow", label: "Yellow & Mustard", swatch: "#d3a12c", terms: ["Yellow", "Mustard"] },
  { slug: "rust", label: "Rust & Orange", swatch: "#b05c2c", terms: ["Rust", "Orange", "Terracotta"] },
  { slug: "grey", label: "Grey & Charcoal", swatch: "#6a655f", terms: ["Grey", "Charcoal", "Slate", "Black"] },
  { slug: "multi", label: "Multicolour", swatch: "#9E302F", terms: ["Multicolour", "Multi"] },
] as const;

export type ColourFamily = (typeof COLOUR_FAMILIES)[number]["slug"];

/**
 * Price bands for the listing filter, in PAISE. `max` is exclusive; `null`
 * means unbounded. The live catalogue runs ₹420 to ₹68,500, so every band
 * below returns products — an empty filter option is worse than no option.
 */
export const PRICE_BANDS = [
  { slug: "under-1000", label: "Under ₹1,000", min: 0, max: 100_000 },
  { slug: "1000-5000", label: "₹1,000 – ₹5,000", min: 100_000, max: 500_000 },
  { slug: "5000-15000", label: "₹5,000 – ₹15,000", min: 500_000, max: 1_500_000 },
  { slug: "15000-40000", label: "₹15,000 – ₹40,000", min: 1_500_000, max: 4_000_000 },
  { slug: "over-40000", label: "Over ₹40,000", min: 4_000_000, max: null },
] as const;

export type PriceBand = (typeof PRICE_BANDS)[number]["slug"];

// ---------------------------------------------------------------------------
// ADDRESSES — SRS §38
// ---------------------------------------------------------------------------

/**
 * States and union territories, for the address form.
 *
 * A free-text state field is what turns "Maharashtra", "MH" and "maharashtra"
 * into three shipping zones nobody can report on, so this is a closed list and
 * `addressSchema` validates against it by length only — the <select> is what
 * constrains the value.
 */
export const INDIAN_STATES = [
  "Andaman & Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra & Nagar Haveli and Daman & Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu & Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
] as const;

export const ADDRESS_LABELS = ["Home", "Work", "Shop", "Warehouse", "Other"] as const;

// ---------------------------------------------------------------------------
// ORDERS — customer-facing status on Order (SRS §45)
// ---------------------------------------------------------------------------

export const ORDER_STATUS = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  PROCESSING: "PROCESSING",
  PARTIALLY_SHIPPED: "PARTIALLY_SHIPPED",
  SHIPPED: "SHIPPED",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
  RETURNED: "RETURNED",
} as const;
export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

// ---------------------------------------------------------------------------
// SUB-ORDERS — the fulfilment pipeline (SRS §92-110)
// ---------------------------------------------------------------------------

/**
 * The fourteen live pipeline states plus four terminal ones.
 *
 * These existed only as a comment in schema.prisma and as label maps in
 * src/lib/commerce/order-status.ts until Phase 5 needed to *transition* them.
 * Legal moves between these values live in src/lib/order-state-machine.ts —
 * this is only the vocabulary.
 */
export const SUB_ORDER_STATUS = {
  PLACED: "PLACED",
  CONFIRMED: "CONFIRMED",
  WAREHOUSE_QUEUE: "WAREHOUSE_QUEUE",
  PICKING: "PICKING",
  PICKED: "PICKED",
  QC_PENDING: "QC_PENDING",
  QC_PASSED: "QC_PASSED",
  QC_FAILED: "QC_FAILED",
  RETURNED_TO_WAREHOUSE: "RETURNED_TO_WAREHOUSE",
  PACKING: "PACKING",
  READY_FOR_DISPATCH: "READY_FOR_DISPATCH",
  DISPATCHED: "DISPATCHED",
  IN_TRANSIT: "IN_TRANSIT",
  OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
  RETURN_REQUESTED: "RETURN_REQUESTED",
  RETURNED: "RETURNED",
} as const;
export type SubOrderStatus =
  (typeof SUB_ORDER_STATUS)[keyof typeof SUB_ORDER_STATUS];

/**
 * The statuses at which goods count as **sold** — SRS §151.
 *
 * The parcel reached the customer and stayed there. `RETURN_REQUESTED` is in
 * the set because it did arrive — the customer has it while the support desk
 * decides — and `RETURNED` is out, because it came back. Everything earlier in
 * the pipeline is an order, not a sale: a cancelled order must not leave a
 * product at the top of the best sellers rail.
 *
 * Lives here, next to the statuses themselves, because `Product.salesCount` is
 * derived from it in three places — the running application
 * (`src/lib/catalogue/sales.ts`), the seed, and `seed-check` — and they must
 * not be able to disagree about what "sold" means. Same reasoning as
 * `deriveOrderStatus` and `deriveInventoryStatus` being shared.
 */
export const SOLD_SUB_ORDER_STATUSES: readonly string[] = [
  SUB_ORDER_STATUS.DELIVERED,
  SUB_ORDER_STATUS.RETURN_REQUESTED,
];

export const PRICE_TIER = {
  RETAIL: "RETAIL",
  WHOLESALE: "WHOLESALE",
} as const;
export type PriceTier = (typeof PRICE_TIER)[keyof typeof PRICE_TIER];

// ---------------------------------------------------------------------------
// PAYMENTS & FINANCE — SRS §44, §118-121
// ---------------------------------------------------------------------------

export const PAYMENT_METHOD = {
  UPI: "UPI",
  CREDIT_CARD: "CREDIT_CARD",
  DEBIT_CARD: "DEBIT_CARD",
  NET_BANKING: "NET_BANKING",
  WALLET: "WALLET",
  COD: "COD",
} as const;
export type PaymentMethod =
  (typeof PAYMENT_METHOD)[keyof typeof PAYMENT_METHOD];

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  UPI: "UPI",
  CREDIT_CARD: "Credit Card",
  DEBIT_CARD: "Debit Card",
  NET_BANKING: "Net Banking",
  WALLET: "Wallet",
  COD: "Cash on Delivery",
};

export const PAYMENT_STATUS = {
  PENDING: "PENDING",
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
  REFUNDED: "REFUNDED",
} as const;
export type PaymentStatus =
  (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

export const SETTLEMENT_STATUS = {
  PENDING: "PENDING",
  UNDER_REVIEW: "UNDER_REVIEW",
  RELEASED: "RELEASED",
  FAILED: "FAILED",
} as const;
export type SettlementStatus =
  (typeof SETTLEMENT_STATUS)[keyof typeof SETTLEMENT_STATUS];

export const REFUND_STATUS = {
  PENDING: "PENDING",
  UNDER_REVIEW: "UNDER_REVIEW",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  PROCESSED: "PROCESSED",
} as const;
export type RefundStatus = (typeof REFUND_STATUS)[keyof typeof REFUND_STATUS];

/** Why a refund was raised — `Refund.reason`, SRS §121. */
export const REFUND_REASON_LABEL: Record<string, string> = {
  ORDER_CANCELLED: "Order cancelled",
  DELIVERY_FAILED: "Delivery failed",
  PRODUCT_ISSUE: "Product issue",
  PAYMENT_ERROR: "Payment error",
  RETURN: "Return",
};

// ---------------------------------------------------------------------------
// OPERATIONS — SRS §102, §104, §109
// ---------------------------------------------------------------------------

/** A QC verdict — the two values `QcInspection.result` may take. */
export const QC_RESULT = {
  PASSED: "PASSED",
  FAILED: "FAILED",
} as const;
export type QcResult = (typeof QC_RESULT)[keyof typeof QC_RESULT];

/** QC rejection reasons — SRS §104. */
export const QC_REJECTION_REASONS = {
  WRONG_PRODUCT: "Wrong Product",
  WRONG_VARIANT: "Wrong Variant",
  FABRIC_DAMAGE: "Fabric Damage",
  COLOR_MISMATCH: "Colour Mismatch",
  PACKAGING_ISSUE: "Packaging Issue",
  MISSING_ITEM: "Missing Item",
  LABEL_ISSUE: "Label Issue",
  QUANTITY_MISMATCH: "Quantity Mismatch",
} as const;
export type QcRejectionReason = keyof typeof QC_REJECTION_REASONS;

/** QC inspection checklist groups — SRS §102. */
export const QC_CHECKLIST = {
  product: {
    label: "Product",
    items: ["Correct Product", "Correct SKU", "Correct Variant"],
  },
  fabric: {
    label: "Fabric",
    items: ["Fabric Quality", "No Fabric Damage", "Fabric Finish"],
  },
  appearance: {
    label: "Appearance",
    items: [
      "Colour Accuracy",
      "Stitching",
      "Print Quality",
      "Design Consistency",
    ],
  },
  quantity: {
    label: "Quantity",
    items: ["Correct Quantity", "Correct Packaging Units"],
  },
  packaging: {
    label: "Packaging",
    items: ["Proper Folding", "Barcode", "Labels", "Invoice Available"],
  },
} as const;

/** Shipment status — SRS §109. */
export const SHIPMENT_STATUS = {
  AWAITING_PICKUP: "AWAITING_PICKUP",
  PICKED_UP: "PICKED_UP",
  IN_TRANSIT: "IN_TRANSIT",
  REACHED_HUB: "REACHED_HUB",
  OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
  DELIVERED: "DELIVERED",
  DELIVERY_FAILED: "DELIVERY_FAILED",
  RETURNED_TO_ORIGIN: "RETURNED_TO_ORIGIN",
} as const;
export type ShipmentStatus =
  (typeof SHIPMENT_STATUS)[keyof typeof SHIPMENT_STATUS];

export const SHIPMENT_STATUS_LABEL: Record<ShipmentStatus, string> = {
  AWAITING_PICKUP: "Awaiting Pickup",
  PICKED_UP: "Picked Up",
  IN_TRANSIT: "In Transit",
  REACHED_HUB: "Reached Destination Hub",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Delivered",
  DELIVERY_FAILED: "Delivery Failed",
  RETURNED_TO_ORIGIN: "Returned to Origin",
};

/**
 * Couriers the logistics desk can hand a parcel to — SRS §107.
 *
 * A closed list rather than a free-text field, and shared with the order seed,
 * for the same reason `INDIAN_STATES` is: "Bluedart", "BlueDart" and "blue dart"
 * are three carriers nobody can report on, and the delivery performance report
 * groups by exactly this column.
 */
export const COURIERS = [
  "Bluedart",
  "Delhivery",
  "DTDC",
  "Ekart Logistics",
  "India Post",
] as const;

export type Courier = (typeof COURIERS)[number];

/** Why a delivery attempt failed — SRS §110. */
export const DELIVERY_FAILURE_REASONS = [
  "Customer unavailable",
  "Address could not be found",
  "Customer refused the parcel",
  "Payment not ready (COD)",
  "Area not serviceable",
  "Parcel damaged in transit",
] as const;

// ---------------------------------------------------------------------------
// MARKETING — SRS §123-129
// ---------------------------------------------------------------------------

/**
 * These four vocabularies were only comments on the schema columns until
 * Phase 8, exactly as `SUB_ORDER_STATUS` was before Phase 5. They become
 * constants at the point something *writes* them, because a <select> built from
 * a comment is a <select> that drifts from the database.
 */
export const DISCOUNT_TYPE = {
  PERCENTAGE: "PERCENTAGE",
  FIXED: "FIXED",
  FREE_SHIPPING: "FREE_SHIPPING",
} as const;
export type DiscountType = (typeof DISCOUNT_TYPE)[keyof typeof DISCOUNT_TYPE];

export const DISCOUNT_TYPE_LABEL: Record<string, string> = {
  PERCENTAGE: "Percentage off",
  FIXED: "Fixed amount off",
  FREE_SHIPPING: "Free shipping",
};

export const COUPON_ELIGIBILITY = {
  ALL: "ALL",
  NEW_CUSTOMERS: "NEW_CUSTOMERS",
  RETURNING: "RETURNING",
  WHOLESALE: "WHOLESALE",
} as const;
export type CouponEligibility =
  (typeof COUPON_ELIGIBILITY)[keyof typeof COUPON_ELIGIBILITY];

export const COUPON_ELIGIBILITY_LABEL: Record<string, string> = {
  ALL: "Anyone",
  NEW_CUSTOMERS: "First order only",
  RETURNING: "Returning customers",
  WHOLESALE: "Wholesale accounts",
};

/**
 * Where a banner appears. `HOME_HERO` drives the homepage carousel and
 * `HOME_STRIP` the promotional band beneath it; both are read by
 * `getBanners(position)` in `src/lib/catalogue/queries.ts`, so this list and the
 * storefront cannot disagree about what a position means.
 */
export const BANNER_POSITION = {
  HOME_HERO: "HOME_HERO",
  HOME_STRIP: "HOME_STRIP",
  CATEGORY_TOP: "CATEGORY_TOP",
  PROMO: "PROMO",
} as const;
export type BannerPosition =
  (typeof BANNER_POSITION)[keyof typeof BANNER_POSITION];

export const BANNER_POSITION_LABEL: Record<string, string> = {
  HOME_HERO: "Homepage carousel",
  HOME_STRIP: "Homepage strip",
  CATEGORY_TOP: "Top of a category",
  PROMO: "Promotional slot",
};

export const CAMPAIGN_STATUS = {
  DRAFT: "DRAFT",
  SCHEDULED: "SCHEDULED",
  ACTIVE: "ACTIVE",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;
export type CampaignStatus =
  (typeof CAMPAIGN_STATUS)[keyof typeof CAMPAIGN_STATUS];

export const CAMPAIGN_AUDIENCE = {
  ALL: "ALL",
  NEW_CUSTOMERS: "NEW_CUSTOMERS",
  RETURNING: "RETURNING",
  WHOLESALE: "WHOLESALE",
  SEGMENT: "SEGMENT",
} as const;
export type CampaignAudience =
  (typeof CAMPAIGN_AUDIENCE)[keyof typeof CAMPAIGN_AUDIENCE];

export const CAMPAIGN_AUDIENCE_LABEL: Record<string, string> = {
  ALL: "Every customer",
  NEW_CUSTOMERS: "Customers with no orders yet",
  RETURNING: "Customers who have ordered before",
  WHOLESALE: "Wholesale accounts",
  SEGMENT: "A named segment",
};

/** `Notification.category` — the channel-agnostic grouping, SRS §142. */
export const NOTIFICATION_CATEGORY = {
  ORDER: "ORDER",
  PAYMENT: "PAYMENT",
  SHIPMENT: "SHIPMENT",
  PRODUCT: "PRODUCT",
  SETTLEMENT: "SETTLEMENT",
  PROMOTION: "PROMOTION",
  SYSTEM: "SYSTEM",
  SUPPORT: "SUPPORT",
} as const;

// ---------------------------------------------------------------------------
// SUPPORT — SRS §132, §135, §136
// ---------------------------------------------------------------------------

export const TICKET_STATUS = {
  OPEN: "OPEN",
  ASSIGNED: "ASSIGNED",
  IN_PROGRESS: "IN_PROGRESS",
  WAITING_CUSTOMER: "WAITING_CUSTOMER",
  RESOLVED: "RESOLVED",
  CLOSED: "CLOSED",
} as const;
export type TicketStatus = (typeof TICKET_STATUS)[keyof typeof TICKET_STATUS];

export const TICKET_PRIORITY = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
} as const;
export type TicketPriority =
  (typeof TICKET_PRIORITY)[keyof typeof TICKET_PRIORITY];

/**
 * The numeric mirror of `SupportTicket.priority`, written to `priorityRank`.
 *
 * `priority` is a String so the schema stays portable to PostgreSQL, and Prisma
 * cannot `orderBy` a CASE expression — so ordering by the column itself is
 * alphabetical (CRITICAL, HIGH, LOW, MEDIUM), which puts MEDIUM above HIGH.
 * Sorting in memory instead would break pagination. Same problem and same fix
 * as `Product.priceEffective`.
 *
 * **Every write that sets `priority` must set `priorityRank` from this**, which
 * is why it lives here in the pure module the seed can also import.
 */
export const TICKET_PRIORITY_RANK: Record<string, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

export function ticketPriorityRank(priority: string): number {
  return TICKET_PRIORITY_RANK[priority] ?? TICKET_PRIORITY_RANK.MEDIUM;
}

/** SRS §111 — the return workflow, previously only a schema comment. */
export const RETURN_STATUS = {
  REQUESTED: "REQUESTED",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  PICKUP_SCHEDULED: "PICKUP_SCHEDULED",
  RECEIVED: "RECEIVED",
  INSPECTED: "INSPECTED",
  REFUNDED: "REFUNDED",
  REPLACED: "REPLACED",
} as const;
export type ReturnStatus = (typeof RETURN_STATUS)[keyof typeof RETURN_STATUS];

export const RETURN_STATUS_LABEL: Record<string, string> = {
  REQUESTED: "Awaiting decision",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  PICKUP_SCHEDULED: "Pickup scheduled",
  RECEIVED: "Received at warehouse",
  INSPECTED: "Inspected",
  REFUNDED: "Refunded",
  REPLACED: "Replaced",
};

export const TICKET_CATEGORY_LABEL: Record<string, string> = {
  ORDER_ISSUE: "Order Issue",
  DELIVERY_ISSUE: "Delivery Issue",
  PAYMENT_ISSUE: "Payment Issue",
  PRODUCT_ISSUE: "Product Issue",
  RETURN_REQUEST: "Return Request",
  REFUND_REQUEST: "Refund Request",
  TECHNICAL: "Technical Issue",
  ACCOUNT: "Account Issue",
  PRODUCT_APPROVAL: "Product Approval",
  SETTLEMENT: "Settlement Issue",
  GENERAL: "General Enquiry",
};

// ---------------------------------------------------------------------------
// PLATFORM
// ---------------------------------------------------------------------------

/** Default platform commission, overridable per seller — SRS §13.1. */
export const DEFAULT_COMMISSION_PERCENT = 10;

/** Free shipping above this order value (PAISE). */
export const FREE_SHIPPING_THRESHOLD_PAISE = 200_000; // ₹2,000
export const FLAT_SHIPPING_PAISE = 9_900; // ₹99

/** GST applied at checkout on textiles. */
export const GST_PERCENT = 5;
