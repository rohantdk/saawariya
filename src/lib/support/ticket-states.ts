import { TICKET_STATUS, type TicketStatus } from "@/lib/constants";
import { PERMISSIONS, type Permission } from "@/lib/auth/permissions";

/**
 * Legal ticket status moves — SRS §135.
 *
 * Pure, with no database import, because the buttons are drawn by a Client
 * Component and a `server-only` module may export a type to a client but never a
 * value. Same shape as the order and finance state machines: the panel renders
 * from `availableTicketMoves()` and the action re-checks with
 * `assertTicketMove()` on submit.
 *
 * Two rules the table encodes that are worth stating:
 *
 * - **Resolving and closing are separate.** `RESOLVED` says the desk believes
 *   the problem is fixed; `CLOSED` ends the conversation. Between the two the
 *   customer can still reply, which is exactly what happens when a fix did not
 *   work — merging them would leave that reply nowhere to go.
 * - **A closed ticket is terminal.** `isTicketOpen` in
 *   `src/lib/commerce/support.ts` stops the customer writing to a closed thread,
 *   so an agent who could reopen one would be reopening a conversation the other
 *   side cannot see they are in.
 */

export type TicketMove = {
  to: TicketStatus;
  permission: Permission;
  label: string;
  primary?: boolean;
};

export const TICKET_MOVES: Record<TicketStatus, TicketMove[]> = {
  [TICKET_STATUS.OPEN]: [
    {
      to: TICKET_STATUS.IN_PROGRESS,
      permission: PERMISSIONS.TICKET_RESOLVE,
      label: "Start work",
      primary: true,
    },
    {
      to: TICKET_STATUS.WAITING_CUSTOMER,
      permission: PERMISSIONS.TICKET_RESOLVE,
      label: "Waiting on the customer",
    },
    {
      to: TICKET_STATUS.RESOLVED,
      permission: PERMISSIONS.TICKET_RESOLVE,
      label: "Mark resolved",
    },
  ],

  [TICKET_STATUS.ASSIGNED]: [
    {
      to: TICKET_STATUS.IN_PROGRESS,
      permission: PERMISSIONS.TICKET_RESOLVE,
      label: "Start work",
      primary: true,
    },
    {
      to: TICKET_STATUS.WAITING_CUSTOMER,
      permission: PERMISSIONS.TICKET_RESOLVE,
      label: "Waiting on the customer",
    },
    {
      to: TICKET_STATUS.RESOLVED,
      permission: PERMISSIONS.TICKET_RESOLVE,
      label: "Mark resolved",
    },
  ],

  [TICKET_STATUS.IN_PROGRESS]: [
    {
      to: TICKET_STATUS.RESOLVED,
      permission: PERMISSIONS.TICKET_RESOLVE,
      label: "Mark resolved",
      primary: true,
    },
    {
      to: TICKET_STATUS.WAITING_CUSTOMER,
      permission: PERMISSIONS.TICKET_RESOLVE,
      label: "Waiting on the customer",
    },
  ],

  [TICKET_STATUS.WAITING_CUSTOMER]: [
    {
      to: TICKET_STATUS.IN_PROGRESS,
      permission: PERMISSIONS.TICKET_RESOLVE,
      label: "Back to us",
      primary: true,
    },
    {
      to: TICKET_STATUS.RESOLVED,
      permission: PERMISSIONS.TICKET_RESOLVE,
      label: "Mark resolved",
    },
  ],

  [TICKET_STATUS.RESOLVED]: [
    {
      to: TICKET_STATUS.CLOSED,
      permission: PERMISSIONS.TICKET_RESOLVE,
      label: "Close",
      primary: true,
    },
    // The fix did not work. Without this a resolved-but-not-fixed ticket has
    // nowhere to go except a second ticket, which loses the whole history.
    {
      to: TICKET_STATUS.IN_PROGRESS,
      permission: PERMISSIONS.TICKET_RESOLVE,
      label: "Reopen",
    },
  ],

  [TICKET_STATUS.CLOSED]: [],
};

/** Statuses that mean "the desk owes this customer something". */
export const TICKET_OPEN_STATUSES: TicketStatus[] = [
  TICKET_STATUS.OPEN,
  TICKET_STATUS.ASSIGNED,
  TICKET_STATUS.IN_PROGRESS,
];

export function availableTicketMoves(
  status: string,
  permissions: readonly Permission[],
): TicketMove[] {
  return (TICKET_MOVES[status as TicketStatus] ?? []).filter((move) =>
    permissions.includes(move.permission),
  );
}

export function assertTicketMove(
  from: string,
  to: string,
  permissions: readonly Permission[],
): { ok: true; move: TicketMove } | { ok: false; error: string } {
  const moves = TICKET_MOVES[from as TicketStatus] ?? [];
  const move = moves.find((candidate) => candidate.to === to);

  if (!move) {
    return {
      ok: false,
      error:
        moves.length === 0
          ? "This ticket is closed and can no longer be changed."
          : `A ticket cannot move from ${from.toLowerCase().replace(/_/g, " ")} to ${to
              .toLowerCase()
              .replace(/_/g, " ")}.`,
    };
  }

  if (!permissions.includes(move.permission)) {
    return { ok: false, error: "You do not have permission to do that." };
  }

  return { ok: true, move };
}
