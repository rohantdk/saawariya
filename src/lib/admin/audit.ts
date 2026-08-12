import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * The audit trail — SRS §89.
 *
 * `AuditLog` existed from Phase 0 and Phases 1–4 wrote to it directly, one
 * inline `prisma.auditLog.create` per site. That was fine while there were four
 * of them; Phase 6 adds an admin screen that *reads* the trail, and the moment a
 * screen renders the log, "did anyone remember to write a row" becomes a
 * correctness question rather than a tidiness one. Hence one helper, one
 * vocabulary of action codes, and one place that knows how a summary is worded.
 *
 * Two rules:
 *
 * 1. **It takes a client.** Anything that changes state inside a transaction
 *    must log inside the same transaction, or a rolled-back change leaves a row
 *    claiming it happened. Pass `tx` when you have one; the default is the
 *    singleton for the single-statement cases.
 * 2. **The summary is written for a human reading the log later**, not for a
 *    machine. It names the thing ("Saree SAAW-0031"), not just its id, because
 *    the entity may be gone by the time anyone reads the row — `entityId` is
 *    kept for correlation, and the summary is what actually survives.
 */

export const AUDIT_ACTIONS = {
  // Sellers — SRS §74, §55
  SELLER_APPROVED: "SELLER_APPROVED",
  SELLER_REJECTED: "SELLER_REJECTED",
  SELLER_SUSPENDED: "SELLER_SUSPENDED",
  SELLER_REINSTATED: "SELLER_REINSTATED",
  SELLER_REVIEW_STARTED: "SELLER_REVIEW_STARTED",
  SELLER_COMMISSION_CHANGED: "SELLER_COMMISSION_CHANGED",
  SELLER_DOCUMENT_REVIEWED: "SELLER_DOCUMENT_REVIEWED",

  // Catalogue — SRS §75, §76
  PRODUCT_APPROVED: "PRODUCT_APPROVED",
  PRODUCT_REJECTED: "PRODUCT_REJECTED",
  PRODUCT_HIDDEN: "PRODUCT_HIDDEN",
  PRODUCT_RESTORED: "PRODUCT_RESTORED",
  PRODUCT_SUBMITTED: "PRODUCT_SUBMITTED",
  PRODUCT_EDITED: "PRODUCT_EDITED",
  CATEGORY_CREATED: "CATEGORY_CREATED",
  CATEGORY_UPDATED: "CATEGORY_UPDATED",
  CATEGORY_DELETED: "CATEGORY_DELETED",
  REVIEW_APPROVED: "REVIEW_APPROVED",
  REVIEW_REJECTED: "REVIEW_REJECTED",

  // Customers — SRS §73
  CUSTOMER_SUSPENDED: "CUSTOMER_SUSPENDED",
  CUSTOMER_REINSTATED: "CUSTOMER_REINSTATED",
  CUSTOMER_TIER_CHANGED: "CUSTOMER_TIER_CHANGED",

  // Orders — SRS §78, §92-110
  ORDER_PLACED: "ORDER_PLACED",
  ORDER_CANCELLED: "ORDER_CANCELLED",
  ORDER_STATUS_CHANGED: "ORDER_STATUS_CHANGED",
  RETURN_REQUESTED: "RETURN_REQUESTED",
  STOCK_ADJUSTED: "STOCK_ADJUSTED",

  // Finance — SRS §119-121
  SETTLEMENT_RELEASED: "SETTLEMENT_RELEASED",
  SETTLEMENT_HELD: "SETTLEMENT_HELD",
  SETTLEMENT_FAILED: "SETTLEMENT_FAILED",
  REFUND_APPROVED: "REFUND_APPROVED",
  REFUND_REJECTED: "REFUND_REJECTED",
  REFUND_PROCESSED: "REFUND_PROCESSED",

  // Marketing — SRS §123-129
  COUPON_CREATED: "COUPON_CREATED",
  COUPON_UPDATED: "COUPON_UPDATED",
  BANNER_CREATED: "BANNER_CREATED",
  BANNER_UPDATED: "BANNER_UPDATED",
  CAMPAIGN_CREATED: "CAMPAIGN_CREATED",
  CAMPAIGN_UPDATED: "CAMPAIGN_UPDATED",
  CMS_PAGE_UPDATED: "CMS_PAGE_UPDATED",
  NOTIFICATION_BROADCAST: "NOTIFICATION_BROADCAST",

  // Support — SRS §130-140
  TICKET_ASSIGNED: "TICKET_ASSIGNED",
  TICKET_RESOLVED: "TICKET_RESOLVED",
  TICKET_CLOSED: "TICKET_CLOSED",
  RETURN_APPROVED: "RETURN_APPROVED",
  RETURN_REJECTED: "RETURN_REJECTED",
  RETURN_COMPLETED: "RETURN_COMPLETED",

  // Platform — SRS §87, §89
  SETTINGS_CHANGED: "SETTINGS_CHANGED",
  PASSWORD_CHANGED: "PASSWORD_CHANGED",
  USER_LOGGED_OUT: "USER_LOGGED_OUT",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

/**
 * Grouping for the audit screen's filter.
 *
 * Derived from the action code rather than stored, because a row written in
 * Phase 1 has no module column and back-filling one would mean a migration to
 * add information that the action code already carries.
 */
export const AUDIT_MODULES = {
  Sellers: ["SELLER_"],
  Catalogue: ["PRODUCT_", "CATEGORY_", "REVIEW_", "STOCK_"],
  Customers: ["CUSTOMER_"],
  // `RETURN_` stays here rather than under Support: a return is something that
  // happened to an order, and its narrative is the same `OrderEvent` timeline as
  // every other move the parcel made. The support desk is where the decision is
  // taken, not where the record belongs.
  Orders: ["ORDER_", "RETURN_"],
  Finance: ["SETTLEMENT_", "REFUND_"],
  Marketing: ["COUPON_", "BANNER_", "CAMPAIGN_", "CMS_", "NOTIFICATION_"],
  Support: ["TICKET_"],
  Platform: ["SETTINGS_", "PASSWORD_", "USER_"],
} as const;

export type AuditModule = keyof typeof AUDIT_MODULES;

export function auditModuleOf(action: string): AuditModule | "Other" {
  for (const [module, prefixes] of Object.entries(AUDIT_MODULES)) {
    if (prefixes.some((prefix) => action.startsWith(prefix))) {
      return module as AuditModule;
    }
  }
  return "Other";
}

/** "PRODUCT_APPROVED" -> "Product approved", for the log and its filter. */
export function auditActionLabel(action: string): string {
  const words = action.toLowerCase().replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

type AuditClient = Prisma.TransactionClient | typeof prisma;

export type AuditEntry = {
  /** Null only for system-initiated changes; every admin action has an actor. */
  userId: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  /** One sentence, past tense, naming the entity. Shown verbatim in the log. */
  summary: string;
  /** Structured detail for anything a sentence cannot carry (before/after). */
  meta?: Record<string, unknown>;
};

export async function writeAudit(
  entry: AuditEntry,
  client: AuditClient = prisma,
): Promise<void> {
  await client.auditLog.create({
    data: {
      userId: entry.userId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      summary: entry.summary,
      metaJson: entry.meta ? JSON.stringify(entry.meta) : null,
    },
  });
}

// ---------------------------------------------------------------------------
// READING THE TRAIL — SRS §89
// ---------------------------------------------------------------------------

const PAGE_SIZE = 30;

export type AuditFilters = {
  module?: string;
  action?: string;
  userId?: string;
  q?: string;
  page?: number;
};

export async function listAuditLog(filters: AuditFilters = {}) {
  const { module = "all", action = "", userId = "", q = "", page = 1 } = filters;

  /**
   * The module filter is a prefix match on the action code rather than a
   * column: there is no module column, and adding one would mean a migration
   * plus a back-fill of rows written before Phase 6 — for information the
   * action code already carries. `startsWith` compiles to LIKE 'PREFIX%'.
   */
  const modulePrefixes =
    module !== "all" && module in AUDIT_MODULES
      ? AUDIT_MODULES[module as AuditModule]
      : null;

  const where = {
    ...(action ? { action } : {}),
    ...(userId ? { userId } : {}),
    ...(modulePrefixes
      ? { OR: modulePrefixes.map((prefix) => ({ action: { startsWith: prefix } })) }
      : {}),
    ...(q
      ? {
          AND: [
            {
              OR: [
                { summary: { contains: q } },
                { entityId: { contains: q } },
                { entityType: { contains: q } },
              ],
            },
          ],
        }
      : {}),
  };

  const total = await prisma.auditLog.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(Math.max(1, page), pageCount);

  const entries = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (current - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      summary: true,
      metaJson: true,
      createdAt: true,
      user: {
        select: { id: true, fullName: true, email: true, roleCode: true },
      },
    },
  });

  return { entries, total, page: current, pageCount };
}

/** Distinct actions actually present, so the filter never offers an empty set. */
export async function auditFilterOptions() {
  const [actions, actors] = await Promise.all([
    prisma.auditLog.groupBy({ by: ["action"], _count: { _all: true } }),
    prisma.auditLog.findMany({
      where: { userId: { not: null } },
      distinct: ["userId"],
      select: {
        user: { select: { id: true, fullName: true, roleCode: true } },
      },
    }),
  ]);

  return {
    actions: actions
      .map((row) => ({
        code: row.action,
        label: auditActionLabel(row.action),
        count: row._count._all,
      }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    actors: actors
      .map((row) => row.user)
      .filter((user): user is NonNullable<typeof user> => user !== null)
      .sort((a, b) => a.fullName.localeCompare(b.fullName)),
  };
}
