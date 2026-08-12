"use server";

import { prisma } from "@/lib/prisma";
import { requireOperationsAction } from "@/lib/operations/context";
import { performDeskMove } from "@/lib/operations/pipeline";
import {
  checklistFromFormData,
  checklistScore,
} from "@/lib/operations/checklist";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { qcVerdictSchema } from "@/lib/validations/operations";
import { fieldErrors, type ActionState } from "@/lib/validations/commerce";
import { QC_RESULT, SUB_ORDER_STATUS } from "@/lib/constants";

/**
 * Recording a quality inspection — SRS §102, §104.
 *
 * The verdict and the move are **one transaction**, which is the reason
 * `performSubOrderTransition` grew a side-effect hook in Phase 7. A `QC_FAILED`
 * sub-order with no `QcInspection` cannot tell the warehouse what was wrong,
 * so it comes back with the same fault; an inspection row with no move is a
 * verdict nobody acted on. Neither may exist without the other, and the only way
 * to guarantee that is to write them together.
 *
 * The checklist is read from the form rather than trusted from a posted JSON
 * blob: unticked boxes post nothing at all, so the parser walks
 * `QC_CHECKLIST` and records a false for each missing one. Otherwise a group
 * with every box unticked would simply vanish from the record, and "not
 * inspected" would be indistinguishable from "inspected and failed".
 */
export async function recordQcVerdict(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireOperationsAction(PERMISSIONS.QC_INSPECT);
  if (!auth.ok) return { status: "error", message: auth.error };

  const parsed = qcVerdictSchema.safeParse({
    subOrderId: formData.get("subOrderId"),
    result: formData.get("result"),
    rejectionReason: formData.get("rejectionReason") ?? undefined,
    notes: formData.get("notes") ?? undefined,
  });
  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error) };
  }
  const input = parsed.data;

  const checklist = checklistFromFormData(formData);
  const score = checklistScore(checklist);

  /**
   * A pass with unticked boxes is refused. The checklist is the evidence behind
   * the verdict — passing a parcel while recording that its colour was wrong is
   * a contradiction the record would preserve forever, and an inspector who
   * genuinely wants it through can say so as a failure with a note instead.
   */
  if (input.result === QC_RESULT.PASSED && score.passed < score.total) {
    return {
      status: "error",
      message: `${score.total - score.passed} check${score.total - score.passed === 1 ? " is" : "s are"} still unticked. Tick everything to pass this parcel, or record a failure instead.`,
    };
  }

  const passed = input.result === QC_RESULT.PASSED;

  // A re-inspection is derived, never posted: it is simply true when this
  // parcel has been inspected before. Asking the inspector to tell us something
  // the database already knows is how the flag ends up wrong.
  const priorInspections = await prisma.qcInspection.count({
    where: { subOrderId: input.subOrderId },
  });

  const result = await performDeskMove({
    subOrderId: input.subOrderId,
    to: passed ? SUB_ORDER_STATUS.QC_PASSED : SUB_ORDER_STATUS.QC_FAILED,
    actor: {
      userId: auth.ops.userId,
      role: auth.ops.role,
      permissions: auth.ops.permissions,
    },
    note: passed
      ? `Passed inspection — ${score.passed}/${score.total} checks${input.notes ? `. ${input.notes}` : ""}`
      : `Failed inspection — ${score.passed}/${score.total} checks${input.notes ? `. ${input.notes}` : ""}`,
    sideEffect: async (tx, subOrder) => {
      await tx.qcInspection.create({
        data: {
          subOrderId: subOrder.id,
          inspectorId: auth.ops.userId,
          result: input.result,
          checklistJson: JSON.stringify(checklist),
          rejectionReason: passed ? null : input.rejectionReason,
          notes: input.notes || null,
          isReinspection: priorInspections > 0,
        },
      });
    },
  });
  if (!result.ok) return { status: "error", message: result.error };

  return {
    status: "success",
    message: passed
      ? `${result.subOrderNumber} passed. It is now waiting for the warehouse to pack it.`
      : `${result.subOrderNumber} failed. Send it back to the warehouse to be re-picked.`,
  };
}
