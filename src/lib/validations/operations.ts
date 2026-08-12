import { z } from "zod";
import {
  COURIERS,
  DELIVERY_FAILURE_REASONS,
  QC_REJECTION_REASONS,
  QC_RESULT,
  SUB_ORDER_STATUS,
} from "@/lib/constants";

/**
 * Input schemas for everything the three operations desks write.
 *
 * Same rule as the seller and admin schemas: a Server Action is a public HTTP
 * endpoint, so every id, status and courier is re-checked here regardless of
 * what the UI offered. What is specific to this phase is that the *pipeline*
 * move is not validated here at all — `assertTransition` owns that, and a
 * second copy of the legal-moves table in a Zod schema is precisely the drift
 * the state machine exists to prevent. These schemas only check that the fields
 * are well-formed.
 */

const cuid = z.string().trim().min(1, "Missing identifier.");

const note = (max = 300) =>
  z.string().trim().max(max, `Keep this under ${max} characters.`);

// ---------------------------------------------------------------------------
// THE SHARED PIPELINE MOVE — SRS §94, §100, §108
// ---------------------------------------------------------------------------

/**
 * Used by every "advance this parcel" button on all three desks. There is one
 * schema rather than one per desk because the desks differ in *which* moves
 * they are allowed, and that difference is enforced by permissions, not by
 * parsing.
 */
export const pipelineMoveSchema = z.object({
  subOrderId: cuid,
  to: z.enum(Object.values(SUB_ORDER_STATUS) as [string, ...string[]], {
    message: "That is not a known order status.",
  }),
  note: note(300).optional(),
});

// ---------------------------------------------------------------------------
// WAREHOUSE — SRS §98
// ---------------------------------------------------------------------------

/**
 * A shortage or damage found while picking.
 *
 * Deliberately keyed on an **order item**, not a product. This is the warehouse's
 * only stock write, and tying it to the line being picked is what keeps it from
 * becoming general stock editing — an operator records what they found in a
 * specific parcel, they do not open an arbitrary product and type a new number.
 * "No role manages all stock" (Phase 6) survives intact.
 */
export const stockDiscrepancySchema = z.object({
  subOrderId: cuid,
  orderItemId: cuid,
  kind: z.enum(["DAMAGED", "SHORTAGE"], {
    message: "Say whether the stock was damaged or simply missing.",
  }),
  quantity: z.coerce
    .number()
    .int("Use a whole number of units.")
    .min(1, "At least one unit.")
    .max(1000, "That quantity is too large."),
  note: z
    .string()
    .trim()
    .min(10, "Describe what you found — at least 10 characters.")
    .max(300, "Keep this under 300 characters."),
});

// ---------------------------------------------------------------------------
// QUALITY CONTROL — SRS §102, §104
// ---------------------------------------------------------------------------

/**
 * A verdict, and — when it is a rejection — the reason for it.
 *
 * The reason is required on a failure by the same rule the admin console
 * follows for every rejection: the note is the deliverable. A `QC_FAILED`
 * parcel with no reason tells the warehouse to re-pick without saying what was
 * wrong, so it comes back with the same fault.
 */
export const qcVerdictSchema = z
  .object({
    subOrderId: cuid,
    result: z.enum(Object.values(QC_RESULT) as [string, ...string[]], {
      message: "Record a pass or a fail.",
    }),
    rejectionReason: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value ? value : null)),
    notes: note(500).optional(),
  })
  .refine(
    (data) =>
      data.result !== QC_RESULT.FAILED ||
      (data.rejectionReason !== null &&
        data.rejectionReason in QC_REJECTION_REASONS),
    {
      message: "Choose what was wrong with it.",
      path: ["rejectionReason"],
    },
  );

// ---------------------------------------------------------------------------
// LOGISTICS — SRS §107-110
// ---------------------------------------------------------------------------

export const dispatchSchema = z.object({
  subOrderId: cuid,
  courierName: z.enum(COURIERS, { message: "Choose a courier." }),
  note: note(300).optional(),
});

/**
 * A tracking update. `location` is optional because a courier's network does
 * not always report one, and a required field that is routinely unknown gets
 * filled with "N/A".
 */
export const trackingUpdateSchema = z.object({
  subOrderId: cuid,
  to: z.enum(Object.values(SUB_ORDER_STATUS) as [string, ...string[]], {
    message: "That is not a known order status.",
  }),
  location: note(120).optional(),
  note: note(300).optional(),
});

export const deliveryFailureSchema = z.object({
  subOrderId: cuid,
  reason: z.enum(DELIVERY_FAILURE_REASONS, {
    message: "Choose why the attempt failed.",
  }),
  location: note(120).optional(),
  note: note(300).optional(),
});
