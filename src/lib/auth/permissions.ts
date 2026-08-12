import { ROLES, type RoleCode } from "@/lib/constants";

/**
 * Role-Based Access Control matrix.
 *
 * SRS §88 states the permission matrix "will be finalized during
 * implementation" — this file is that matrix, and it is the single source of
 * truth. It is seeded into the Role / Permission / RolePermission tables so the
 * admin Roles & Permissions screen (SRS §88) reads real data rather than a
 * hardcoded list, but authorisation checks always run against these constants:
 * a permission the code does not know about cannot be granted by editing a row.
 *
 * Enforcement happens in three places, and all three are required:
 *   1. src/proxy.ts        — optimistic route gating, reads the cookie only
 *   2. src/lib/auth/dal.ts — authoritative check against the database
 *   3. every Server Action — re-checks independently, because actions are
 *                            reachable directly and never trust the caller
 */

export const PERMISSIONS = {
  // Catalogue -------------------------------------------------------------
  PRODUCT_VIEW_OWN: "product.view_own",
  PRODUCT_MANAGE_OWN: "product.manage_own",
  PRODUCT_VIEW_ALL: "product.view_all",
  PRODUCT_APPROVE: "product.approve",
  PRODUCT_DELETE_ANY: "product.delete_any",
  CATEGORY_MANAGE: "category.manage",
  INVENTORY_MANAGE_OWN: "inventory.manage_own",
  INVENTORY_VIEW_ALL: "inventory.view_all",

  // Orders ----------------------------------------------------------------
  ORDER_PLACE: "order.place",
  ORDER_VIEW_OWN: "order.view_own",
  ORDER_VIEW_SELLER: "order.view_seller",
  ORDER_VIEW_ALL: "order.view_all",
  ORDER_CANCEL_OWN: "order.cancel_own",
  ORDER_UPDATE_STATUS: "order.update_status",

  // Operations ------------------------------------------------------------
  WAREHOUSE_PROCESS: "warehouse.process",
  QC_INSPECT: "qc.inspect",
  PACKAGING_PROCESS: "packaging.process",
  LOGISTICS_SHIP: "logistics.ship",
  RETURN_PROCESS: "return.process",

  // Finance ---------------------------------------------------------------
  PAYMENT_VIEW: "payment.view",
  SETTLEMENT_VIEW_OWN: "settlement.view_own",
  SETTLEMENT_VIEW_ALL: "settlement.view_all",
  SETTLEMENT_RELEASE: "settlement.release",
  REFUND_PROCESS: "refund.process",

  // Marketing -------------------------------------------------------------
  COUPON_MANAGE: "coupon.manage",
  BANNER_MANAGE: "banner.manage",
  CAMPAIGN_MANAGE: "campaign.manage",
  NOTIFICATION_BROADCAST: "notification.broadcast",

  // Support ---------------------------------------------------------------
  TICKET_RAISE: "ticket.raise",
  TICKET_VIEW_ALL: "ticket.view_all",
  TICKET_ASSIGN: "ticket.assign",
  TICKET_RESOLVE: "ticket.resolve",

  // Customer self-service -------------------------------------------------
  CART_MANAGE: "cart.manage",
  WISHLIST_MANAGE: "wishlist.manage",
  REVIEW_CREATE: "review.create",
  REVIEW_MODERATE: "review.moderate",

  // Platform administration ----------------------------------------------
  CUSTOMER_MANAGE: "customer.manage",
  SELLER_APPROVE: "seller.approve",
  SELLER_MANAGE: "seller.manage",
  CMS_MANAGE: "cms.manage",
  SETTINGS_MANAGE: "settings.manage",
  ROLE_MANAGE: "role.manage",
  AUDIT_VIEW: "audit.view",
  REPORT_VIEW_OWN: "report.view_own",
  REPORT_VIEW_ALL: "report.view_all",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** Human-readable descriptions, shown in the admin Roles & Permissions screen. */
export const PERMISSION_META: Record<
  Permission,
  { module: string; description: string }
> = {
  [PERMISSIONS.PRODUCT_VIEW_OWN]: { module: "Catalogue", description: "View own products" },
  [PERMISSIONS.PRODUCT_MANAGE_OWN]: { module: "Catalogue", description: "Create and edit own products" },
  [PERMISSIONS.PRODUCT_VIEW_ALL]: { module: "Catalogue", description: "View all marketplace products" },
  [PERMISSIONS.PRODUCT_APPROVE]: { module: "Catalogue", description: "Approve or reject submitted products" },
  [PERMISSIONS.PRODUCT_DELETE_ANY]: { module: "Catalogue", description: "Delete any product" },
  [PERMISSIONS.CATEGORY_MANAGE]: { module: "Catalogue", description: "Manage the category hierarchy" },
  [PERMISSIONS.INVENTORY_MANAGE_OWN]: { module: "Catalogue", description: "Manage own stock levels" },
  [PERMISSIONS.INVENTORY_VIEW_ALL]: { module: "Catalogue", description: "View marketplace-wide inventory" },

  [PERMISSIONS.ORDER_PLACE]: { module: "Orders", description: "Place orders" },
  [PERMISSIONS.ORDER_VIEW_OWN]: { module: "Orders", description: "View own orders" },
  [PERMISSIONS.ORDER_VIEW_SELLER]: { module: "Orders", description: "View orders for own products" },
  [PERMISSIONS.ORDER_VIEW_ALL]: { module: "Orders", description: "View every order on the platform" },
  [PERMISSIONS.ORDER_CANCEL_OWN]: { module: "Orders", description: "Cancel own orders" },
  [PERMISSIONS.ORDER_UPDATE_STATUS]: { module: "Orders", description: "Advance order status" },

  [PERMISSIONS.WAREHOUSE_PROCESS]: { module: "Operations", description: "Pick and verify warehouse orders" },
  [PERMISSIONS.QC_INSPECT]: { module: "Operations", description: "Run quality inspections" },
  [PERMISSIONS.PACKAGING_PROCESS]: { module: "Operations", description: "Pack and label shipments" },
  [PERMISSIONS.LOGISTICS_SHIP]: { module: "Operations", description: "Assign couriers and dispatch" },
  [PERMISSIONS.RETURN_PROCESS]: { module: "Operations", description: "Process return requests" },

  [PERMISSIONS.PAYMENT_VIEW]: { module: "Finance", description: "View payment transactions" },
  [PERMISSIONS.SETTLEMENT_VIEW_OWN]: { module: "Finance", description: "View own settlements" },
  [PERMISSIONS.SETTLEMENT_VIEW_ALL]: { module: "Finance", description: "View all seller settlements" },
  [PERMISSIONS.SETTLEMENT_RELEASE]: { module: "Finance", description: "Release settlement payouts" },
  [PERMISSIONS.REFUND_PROCESS]: { module: "Finance", description: "Approve and process refunds" },

  [PERMISSIONS.COUPON_MANAGE]: { module: "Marketing", description: "Create and manage coupons" },
  [PERMISSIONS.BANNER_MANAGE]: { module: "Marketing", description: "Manage homepage banners" },
  [PERMISSIONS.CAMPAIGN_MANAGE]: { module: "Marketing", description: "Run marketing campaigns" },
  [PERMISSIONS.NOTIFICATION_BROADCAST]: { module: "Marketing", description: "Broadcast notifications" },

  [PERMISSIONS.TICKET_RAISE]: { module: "Support", description: "Raise support tickets" },
  [PERMISSIONS.TICKET_VIEW_ALL]: { module: "Support", description: "View all support tickets" },
  [PERMISSIONS.TICKET_ASSIGN]: { module: "Support", description: "Assign tickets to executives" },
  [PERMISSIONS.TICKET_RESOLVE]: { module: "Support", description: "Resolve and close tickets" },

  [PERMISSIONS.CART_MANAGE]: { module: "Shopping", description: "Manage own cart" },
  [PERMISSIONS.WISHLIST_MANAGE]: { module: "Shopping", description: "Manage own wishlist" },
  [PERMISSIONS.REVIEW_CREATE]: { module: "Shopping", description: "Write product reviews" },
  [PERMISSIONS.REVIEW_MODERATE]: { module: "Shopping", description: "Moderate product reviews" },

  [PERMISSIONS.CUSTOMER_MANAGE]: { module: "Platform", description: "Manage customer accounts" },
  [PERMISSIONS.SELLER_APPROVE]: { module: "Platform", description: "Approve or reject seller applications" },
  [PERMISSIONS.SELLER_MANAGE]: { module: "Platform", description: "Manage seller accounts" },
  [PERMISSIONS.CMS_MANAGE]: { module: "Platform", description: "Edit website content pages" },
  [PERMISSIONS.SETTINGS_MANAGE]: { module: "Platform", description: "Change platform settings" },
  [PERMISSIONS.ROLE_MANAGE]: { module: "Platform", description: "Manage roles and permissions" },
  [PERMISSIONS.AUDIT_VIEW]: { module: "Platform", description: "View audit logs" },
  [PERMISSIONS.REPORT_VIEW_OWN]: { module: "Platform", description: "View own reports" },
  [PERMISSIONS.REPORT_VIEW_ALL]: { module: "Platform", description: "View platform-wide reports" },
};

const P = PERMISSIONS;

/**
 * Role → permission grants.
 *
 * SUPER_ADMIN is deliberately granted every permission by construction rather
 * than by an `isAdmin` bypass, so that adding a new permission does not silently
 * create a capability nobody holds.
 */
export const ROLE_PERMISSIONS: Record<RoleCode, Permission[]> = {
  [ROLES.CUSTOMER]: [
    P.ORDER_PLACE,
    P.ORDER_VIEW_OWN,
    P.ORDER_CANCEL_OWN,
    P.CART_MANAGE,
    P.WISHLIST_MANAGE,
    P.REVIEW_CREATE,
    P.TICKET_RAISE,
  ],

  [ROLES.SELLER]: [
    P.PRODUCT_VIEW_OWN,
    P.PRODUCT_MANAGE_OWN,
    P.INVENTORY_MANAGE_OWN,
    P.ORDER_VIEW_SELLER,
    P.ORDER_UPDATE_STATUS,
    P.SETTLEMENT_VIEW_OWN,
    P.REPORT_VIEW_OWN,
    P.TICKET_RAISE,
  ],

  [ROLES.WAREHOUSE]: [
    P.ORDER_VIEW_ALL,
    P.ORDER_UPDATE_STATUS,
    P.WAREHOUSE_PROCESS,
    P.PACKAGING_PROCESS,
    P.INVENTORY_VIEW_ALL,
    P.REPORT_VIEW_OWN,
  ],

  [ROLES.QC]: [
    P.ORDER_VIEW_ALL,
    P.ORDER_UPDATE_STATUS,
    P.QC_INSPECT,
    P.REPORT_VIEW_OWN,
  ],

  [ROLES.LOGISTICS]: [
    P.ORDER_VIEW_ALL,
    P.ORDER_UPDATE_STATUS,
    P.LOGISTICS_SHIP,
    P.REPORT_VIEW_OWN,
  ],

  [ROLES.FINANCE]: [
    P.ORDER_VIEW_ALL,
    P.PAYMENT_VIEW,
    P.SETTLEMENT_VIEW_ALL,
    P.SETTLEMENT_RELEASE,
    P.REFUND_PROCESS,
    P.REPORT_VIEW_ALL,
  ],

  [ROLES.SUPPORT]: [
    P.ORDER_VIEW_ALL,
    P.TICKET_VIEW_ALL,
    P.TICKET_ASSIGN,
    P.TICKET_RESOLVE,
    P.RETURN_PROCESS,
    P.REPORT_VIEW_OWN,
  ],

  [ROLES.MARKETING]: [
    P.COUPON_MANAGE,
    P.BANNER_MANAGE,
    P.CAMPAIGN_MANAGE,
    P.NOTIFICATION_BROADCAST,
    P.CMS_MANAGE,
    P.REPORT_VIEW_ALL,
  ],

  [ROLES.SUPER_ADMIN]: Object.values(PERMISSIONS),
};

/** Does this role hold this permission? */
export function roleHas(role: RoleCode, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/** Does this role hold at least one of these permissions? */
export function roleHasAny(role: RoleCode, permissions: Permission[]): boolean {
  return permissions.some((permission) => roleHas(role, permission));
}
