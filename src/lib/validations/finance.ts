import { z } from "zod";
import { REFUND_STATUS, SETTLEMENT_STATUS } from "@/lib/constants";

/**
 * Input schemas for the finance desk — SRS §119-121.
 *
 * Same rule as everywhere else: a Server Action is a public HTTP endpoint, so
 * every id and target status is re-checked here regardless of what the UI drew.
 *
 * What these schemas deliberately do **not** enforce is whether a note is
 * required. That varies per move — holding a payout requires an explanation,
 * releasing one does not — and the answer lives in `SETTLEMENT_MOVES` /
 * `REFUND_MOVES` in `src/lib/finance/states.ts`, beside the move it belongs to.
 * A second copy of the rule expressed as a Zod refinement is how "you must give
 * a reason" ends up true in one place and false in the other; the action asks
 * the state machine instead.
 */

const cuid = z.string().trim().min(1, "Missing identifier.");

const note = (max = 500) =>
  z.string().trim().max(max, `Keep this under ${max} characters.`).optional();

export const settlementMoveSchema = z.object({
  settlementId: cuid,
  to: z.enum(Object.values(SETTLEMENT_STATUS) as [string, ...string[]], {
    message: "That is not a known settlement status.",
  }),
  /**
   * The bank's own reference for the transfer. There is no banking integration
   * in this build — the checkout says the same thing about payments — so this is
   * whatever finance reads off their statement, and a generated `SIM-…` stands
   * in when it is left blank rather than the field pretending to be a UTR.
   */
  reference: z
    .string()
    .trim()
    .max(60, "A payment reference is shorter than that.")
    .optional(),
  note: note(400),
});

export const refundMoveSchema = z.object({
  refundId: cuid,
  to: z.enum(Object.values(REFUND_STATUS) as [string, ...string[]], {
    message: "That is not a known refund status.",
  }),
  note: note(400),
});
