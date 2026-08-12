"use client";

import { useActionState } from "react";
import {
  submitProductForApproval,
  toggleProductVisibility,
} from "@/app/actions/seller-products";
import { PRODUCT_STATUS } from "@/lib/constants";
import { IDLE_STATE } from "@/lib/validations/commerce";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/field";

/**
 * The status transitions a seller is allowed to make.
 *
 * Deliberately only three exist — submit a draft, hide a live product, send a
 * hidden one back for review. Approving and rejecting are admin actions
 * (SRS §75), so there is no control for them here and the server actions do not
 * accept them either.
 */
export function ProductStatusActions({
  productId,
  status,
}: {
  productId: string;
  status: string;
}) {
  const [submitState, submitAction, submitting] = useActionState(
    submitProductForApproval,
    IDLE_STATE,
  );
  const [visibilityState, visibilityAction, togglingVisibility] =
    useActionState(toggleProductVisibility, IDLE_STATE);

  const message =
    submitState.status !== "idle"
      ? submitState
      : visibilityState.status !== "idle"
        ? visibilityState
        : null;

  const canSubmit =
    status === PRODUCT_STATUS.DRAFT || status === PRODUCT_STATUS.REJECTED;

  return (
    <div className="space-y-4">
      {message?.message && (
        <FormMessage tone={message.status === "error" ? "error" : "success"}>
          {message.message}
        </FormMessage>
      )}

      <div className="flex flex-wrap gap-3">
        {canSubmit && (
          <form action={submitAction}>
            <input type="hidden" name="id" value={productId} />
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? "Submitting…" : "Submit for approval"}
            </Button>
          </form>
        )}

        {status === PRODUCT_STATUS.APPROVED && (
          <form action={visibilityAction}>
            <input type="hidden" name="id" value={productId} />
            <Button
              type="submit"
              size="sm"
              variant="secondary"
              disabled={togglingVisibility}
            >
              {togglingVisibility ? "Hiding…" : "Hide from storefront"}
            </Button>
          </form>
        )}

        {status === PRODUCT_STATUS.HIDDEN && (
          <form action={visibilityAction}>
            <input type="hidden" name="id" value={productId} />
            <Button type="submit" size="sm" disabled={togglingVisibility}>
              {togglingVisibility ? "Working…" : "Make live again"}
            </Button>
          </form>
        )}

        {status === PRODUCT_STATUS.PENDING && (
          <p className="text-sm text-ink-400">
            With our review team. You will be notified when it is decided.
          </p>
        )}
      </div>
    </div>
  );
}
