import type { Tone } from "@/lib/commerce/order-status";

/**
 * How a product's approval state is worded and coloured for the *seller*.
 *
 * Pure module with no database import, deliberately: the admin approval queue
 * in Phase 6 shows the same states and must use the same words, and a copy in
 * each panel is how "Pending" ends up meaning two different things.
 *
 * The labels are not the raw enum. A seller thinks in terms of "is it live?",
 * not "is it APPROVED", and "In review" tells them something is happening
 * whereas "PENDING" reads like a stall.
 */

export const PRODUCT_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  PENDING: "In review",
  APPROVED: "Live",
  REJECTED: "Rejected",
  HIDDEN: "Hidden",
};

export const PRODUCT_STATUS_TONE: Record<string, Tone> = {
  DRAFT: "neutral",
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  HIDDEN: "neutral",
};
