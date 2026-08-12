import {
  REFUND_STATUS,
  SETTLEMENT_STATUS,
  type RefundStatus,
  type SettlementStatus,
} from "@/lib/constants";
import { PERMISSIONS, type Permission } from "@/lib/auth/permissions";

/**
 * Legal moves for a settlement and for a refund — SRS §119-121.
 *
 * Same shape and the same reasoning as `src/lib/order-state-machine.ts`: the
 * panel renders its buttons from `availableMoves()`, so an action nobody may
 * take is never drawn, and the Server Action re-checks with `assertMove()` on
 * submit, because a button that is not drawn is not a control.
 *
 * This module is **pure** — no database, no session — for two reasons. It is the
 * only way the finance screens can render controls without importing a
 * `server-only` module into a Client Component (the trap that broke the build in
 * Phase 6 and again in Phase 7). And keeping "is this legal" apart from "make it
 * happen" is what let the order pipeline grow from one panel to six without the
 * rules being copied.
 *
 * Ownership is not checked here either. Finance is a platform-wide desk with
 * nothing to scope by, but the *precondition* on releasing a payout is real and
 * lives at the call site: the sub-order has to be DELIVERED. That is a fact
 * about another table, so it cannot be expressed in a transition table.
 */

export type FinanceMove<S extends string> = {
  to: S;
  permission: Permission;
  label: string;
  /** True when the action must not proceed without a written explanation. */
  requiresNote: boolean;
  /** Rendered as the primary button; everything else is secondary. */
  primary?: boolean;
};

// ---------------------------------------------------------------------------
// SETTLEMENTS — SRS §119, §120
// ---------------------------------------------------------------------------

/**
 * `FAILED` means the payout was attempted and the transfer did not land, so it
 * is reachable from a release attempt and can be retried. `UNDER_REVIEW` means a
 * human has stopped it on purpose and therefore requires a note — the seller
 * reads that note on their own settlements screen, and "on hold" with no reason
 * is the dead-end this build refuses to ship anywhere else either.
 */
export const SETTLEMENT_MOVES: Record<
  SettlementStatus,
  FinanceMove<SettlementStatus>[]
> = {
  [SETTLEMENT_STATUS.PENDING]: [
    {
      to: SETTLEMENT_STATUS.RELEASED,
      permission: PERMISSIONS.SETTLEMENT_RELEASE,
      label: "Release payout",
      requiresNote: false,
      primary: true,
    },
    {
      to: SETTLEMENT_STATUS.UNDER_REVIEW,
      permission: PERMISSIONS.SETTLEMENT_RELEASE,
      label: "Hold for review",
      requiresNote: true,
    },
    {
      to: SETTLEMENT_STATUS.FAILED,
      permission: PERMISSIONS.SETTLEMENT_RELEASE,
      label: "Record a failed payout",
      requiresNote: true,
    },
  ],

  [SETTLEMENT_STATUS.UNDER_REVIEW]: [
    {
      to: SETTLEMENT_STATUS.RELEASED,
      permission: PERMISSIONS.SETTLEMENT_RELEASE,
      label: "Release payout",
      requiresNote: false,
      primary: true,
    },
    {
      to: SETTLEMENT_STATUS.FAILED,
      permission: PERMISSIONS.SETTLEMENT_RELEASE,
      label: "Record a failed payout",
      requiresNote: true,
    },
  ],

  [SETTLEMENT_STATUS.FAILED]: [
    {
      to: SETTLEMENT_STATUS.RELEASED,
      permission: PERMISSIONS.SETTLEMENT_RELEASE,
      label: "Retry and release",
      requiresNote: false,
      primary: true,
    },
  ],

  // Terminal. Money has left the platform; unwinding it is a new transaction,
  // not an edit of this row.
  [SETTLEMENT_STATUS.RELEASED]: [],
};

// ---------------------------------------------------------------------------
// REFUNDS — SRS §121
// ---------------------------------------------------------------------------

/**
 * Approval and payment are deliberately two steps. `APPROVED` says finance
 * agrees the money is owed; `PROCESSED` says it has actually been sent. Merging
 * them would leave no state for "agreed but not yet paid", which is where every
 * refund in a real business spends most of its life — and it is exactly the
 * question a customer chasing their money is asking.
 */
export const REFUND_MOVES: Record<RefundStatus, FinanceMove<RefundStatus>[]> = {
  [REFUND_STATUS.PENDING]: [
    {
      to: REFUND_STATUS.APPROVED,
      permission: PERMISSIONS.REFUND_PROCESS,
      label: "Approve refund",
      requiresNote: false,
      primary: true,
    },
    {
      to: REFUND_STATUS.UNDER_REVIEW,
      permission: PERMISSIONS.REFUND_PROCESS,
      label: "Investigate",
      requiresNote: true,
    },
    {
      to: REFUND_STATUS.REJECTED,
      permission: PERMISSIONS.REFUND_PROCESS,
      label: "Reject",
      requiresNote: true,
    },
  ],

  [REFUND_STATUS.UNDER_REVIEW]: [
    {
      to: REFUND_STATUS.APPROVED,
      permission: PERMISSIONS.REFUND_PROCESS,
      label: "Approve refund",
      requiresNote: false,
      primary: true,
    },
    {
      to: REFUND_STATUS.REJECTED,
      permission: PERMISSIONS.REFUND_PROCESS,
      label: "Reject",
      requiresNote: true,
    },
  ],

  [REFUND_STATUS.APPROVED]: [
    {
      to: REFUND_STATUS.PROCESSED,
      permission: PERMISSIONS.REFUND_PROCESS,
      label: "Mark refunded",
      requiresNote: false,
      primary: true,
    },
  ],

  [REFUND_STATUS.REJECTED]: [],
  [REFUND_STATUS.PROCESSED]: [],
};

// ---------------------------------------------------------------------------
// The shared lookup helpers, generic over both tables
// ---------------------------------------------------------------------------

function movesFrom<S extends string>(
  table: Record<S, FinanceMove<S>[]>,
  status: string,
): FinanceMove<S>[] {
  return table[status as S] ?? [];
}

/** The moves a caller holding `permissions` may actually perform. */
export function availableMoves<S extends string>(
  table: Record<S, FinanceMove<S>[]>,
  status: string,
  permissions: readonly Permission[],
): FinanceMove<S>[] {
  return movesFrom(table, status).filter((move) =>
    permissions.includes(move.permission),
  );
}

export type MoveCheck<S extends string> =
  | { ok: true; move: FinanceMove<S> }
  | { ok: false; error: string };

/**
 * The gate every finance mutation passes through.
 *
 * Returns a result rather than throwing, like `assertTransition`, and words the
 * two failures differently for the same reason: "cannot move from X to Y" is a
 * stale page, "you do not have permission" is an authorisation problem, and
 * conflating them makes both harder to diagnose.
 */
export function assertMove<S extends string>(
  table: Record<S, FinanceMove<S>[]>,
  noun: string,
  from: string,
  to: string,
  permissions: readonly Permission[],
): MoveCheck<S> {
  const move = movesFrom(table, from).find((candidate) => candidate.to === to);

  if (!move) {
    return {
      ok: false,
      error:
        movesFrom(table, from).length === 0
          ? `This ${noun} is ${humanise(from)} and can no longer be changed.`
          : `A ${noun} cannot move from ${humanise(from)} to ${humanise(to)}.`,
    };
  }

  if (!permissions.includes(move.permission)) {
    return { ok: false, error: "You do not have permission to do that." };
  }

  return { ok: true, move };
}

/** "UNDER_REVIEW" -> "under review", for sentences rather than badges. */
export function humanise(status: string): string {
  return status.toLowerCase().replace(/_/g, " ");
}
