import type { Tone } from "@/lib/commerce/order-status";
import { TICKET_STATUS } from "@/lib/constants";

/**
 * Ticket status presentation, shared by the customer view and (in Phase 8) the
 * agent queue. Pure module, no database.
 *
 * The customer-facing wording differs from the internal status on purpose:
 * "ASSIGNED" is a fact about the helpdesk's rota, not about their problem, so
 * a customer sees "With our team" for both OPEN and ASSIGNED.
 */

const CUSTOMER_LABEL: Record<string, string> = {
  [TICKET_STATUS.OPEN]: "With our team",
  [TICKET_STATUS.ASSIGNED]: "With our team",
  [TICKET_STATUS.IN_PROGRESS]: "Being looked at",
  [TICKET_STATUS.WAITING_CUSTOMER]: "Waiting for you",
  [TICKET_STATUS.RESOLVED]: "Resolved",
  [TICKET_STATUS.CLOSED]: "Closed",
};

export const TICKET_STATUS_TONE: Record<string, Tone> = {
  [TICKET_STATUS.OPEN]: "info",
  [TICKET_STATUS.ASSIGNED]: "info",
  [TICKET_STATUS.IN_PROGRESS]: "info",
  // The one state where the ball is in the customer's court gets the colour
  // that says so — this is the row they need to act on.
  [TICKET_STATUS.WAITING_CUSTOMER]: "warning",
  [TICKET_STATUS.RESOLVED]: "success",
  [TICKET_STATUS.CLOSED]: "neutral",
};

export function ticketStatusLabel(status: string): string {
  return CUSTOMER_LABEL[status] ?? status;
}

/** Whether the customer can still add to the thread. */
export function isTicketOpen(status: string): boolean {
  return status !== TICKET_STATUS.CLOSED;
}
