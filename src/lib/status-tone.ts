import type { Tone } from "@/lib/commerce/order-status";

/**
 * Badge tones for the status vocabularies that are *not* order statuses.
 *
 * Order and sub-order tones already live in `src/lib/commerce/order-status.ts`
 * alongside the labels they belong to. These do not have such a home — a seller
 * verification state is rendered on `/seller/pending`, on the admin seller
 * queue and on the seller detail screen, and Phase 5 quietly had a private copy
 * of the map on the first of those. Two copies is how "Rejected" ends up
 * amber in one panel and red in the next, which teaches a viewer that the
 * colour means nothing.
 *
 * Colour is never the only signal — `StatusBadge` always renders the word too
 * (SRS §164). The tone is emphasis, not information.
 */

/** Seller verification — SRS §55. */
export const SELLER_STATUS_TONE: Record<string, Tone> = {
  PENDING: "warning",
  UNDER_REVIEW: "info",
  APPROVED: "success",
  REJECTED: "danger",
  SUSPENDED: "danger",
};

/** A single KYC document — SRS §54. */
export const DOC_STATUS_TONE: Record<string, Tone> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};

/** User account state. */
export const USER_STATUS_TONE: Record<string, Tone> = {
  ACTIVE: "success",
  PENDING: "warning",
  SUSPENDED: "danger",
};

/**
 * Review moderation — SRS §47. `PENDING` is deliberately *neutral* rather than
 * amber: an unmoderated review is the normal state of a new review, not a
 * problem, and colouring the whole queue amber makes the genuinely urgent
 * things on the dashboard harder to see.
 */
export const REVIEW_STATUS_TONE: Record<string, Tone> = {
  PENDING: "neutral",
  APPROVED: "success",
  REJECTED: "danger",
};

/** Seller payouts — SRS §119, §120. */
export const SETTLEMENT_STATUS_TONE: Record<string, Tone> = {
  PENDING: "warning",
  UNDER_REVIEW: "info",
  RELEASED: "success",
  FAILED: "danger",
};

/** Refunds — SRS §121. */
export const REFUND_STATUS_TONE: Record<string, Tone> = {
  PENDING: "warning",
  UNDER_REVIEW: "info",
  APPROVED: "info",
  REJECTED: "danger",
  PROCESSED: "success",
};

/** Marketing campaigns — SRS §128. */
export const CAMPAIGN_STATUS_TONE: Record<string, Tone> = {
  DRAFT: "neutral",
  SCHEDULED: "info",
  ACTIVE: "success",
  COMPLETED: "neutral",
  CANCELLED: "danger",
};

/**
 * Support tickets, **as the agent sees them** — SRS §135.
 *
 * Deliberately not the same map as `TICKET_STATUS_TONE` in
 * `src/lib/commerce/support.ts`, and the difference is the point rather than
 * drift: that one is the customer's view, where `WAITING_CUSTOMER` is amber
 * because the ball is in *their* court and it is the row they must act on. Here
 * the same status is neutral, because the desk is not late — the customer has
 * not replied — and colouring a queue of things nobody at the helpdesk can act
 * on would push the genuinely unanswered tickets down the page.
 *
 * Two tone maps for one vocabulary is normally the bug this file exists to
 * prevent. It is allowed here only because the two audiences are asking
 * different questions of the same word, and both maps say so.
 */
export const AGENT_TICKET_STATUS_TONE: Record<string, Tone> = {
  OPEN: "warning",
  ASSIGNED: "info",
  IN_PROGRESS: "info",
  WAITING_CUSTOMER: "neutral",
  RESOLVED: "success",
  CLOSED: "neutral",
};

/** Ticket priority — SRS §136. Only the top two carry colour. */
export const TICKET_PRIORITY_TONE: Record<string, Tone> = {
  LOW: "neutral",
  MEDIUM: "neutral",
  HIGH: "warning",
  CRITICAL: "danger",
};

/** Returns — SRS §111. */
export const RETURN_STATUS_TONE: Record<string, Tone> = {
  REQUESTED: "warning",
  APPROVED: "info",
  REJECTED: "danger",
  PICKUP_SCHEDULED: "info",
  RECEIVED: "info",
  INSPECTED: "info",
  REFUNDED: "success",
  REPLACED: "success",
};

/** Stock — SRS §60, §77. */
export const INVENTORY_STATUS_TONE: Record<string, Tone> = {
  IN_STOCK: "success",
  LOW_STOCK: "warning",
  OUT_OF_STOCK: "danger",
  DISCONTINUED: "neutral",
};
