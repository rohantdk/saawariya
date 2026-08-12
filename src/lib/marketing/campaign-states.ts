import { CAMPAIGN_STATUS } from "@/lib/constants";

/**
 * Legal campaign status moves — SRS §127.
 *
 * Pure, with no database import, because the buttons that perform these moves
 * are drawn by a Client Component. A `server-only` module may export a **type**
 * to a client component but never a **value**: importing one pulls
 * `better-sqlite3`, a native binding, into the browser bundle. `tsc` and
 * `eslint` both pass; only `next build` fails, and only with a `node:module`
 * chunking error that says nothing about the real cause.
 *
 * The rule the table itself encodes: a campaign that has run cannot go back to
 * draft, because the performance counters underneath it would then be
 * describing a draft. Scheduled work has not started, so it still can.
 */
export const CAMPAIGN_MOVES: Record<string, string[]> = {
  [CAMPAIGN_STATUS.DRAFT]: [
    CAMPAIGN_STATUS.SCHEDULED,
    CAMPAIGN_STATUS.CANCELLED,
  ],
  [CAMPAIGN_STATUS.SCHEDULED]: [
    CAMPAIGN_STATUS.ACTIVE,
    CAMPAIGN_STATUS.DRAFT,
    CAMPAIGN_STATUS.CANCELLED,
  ],
  [CAMPAIGN_STATUS.ACTIVE]: [
    CAMPAIGN_STATUS.COMPLETED,
    CAMPAIGN_STATUS.CANCELLED,
  ],
  [CAMPAIGN_STATUS.COMPLETED]: [],
  [CAMPAIGN_STATUS.CANCELLED]: [],
};

export const CAMPAIGN_MOVE_LABEL: Record<string, string> = {
  [CAMPAIGN_STATUS.SCHEDULED]: "Schedule",
  [CAMPAIGN_STATUS.ACTIVE]: "Start now",
  [CAMPAIGN_STATUS.COMPLETED]: "Mark finished",
  [CAMPAIGN_STATUS.CANCELLED]: "Cancel",
  [CAMPAIGN_STATUS.DRAFT]: "Back to draft",
};

export function campaignMovesFrom(status: string): string[] {
  return CAMPAIGN_MOVES[status] ?? [];
}
