"use client";

import { useActionState, useState } from "react";
import {
  approveProduct,
  rejectProduct,
  setProductVisibility,
} from "@/app/actions/admin-products";
import { PRODUCT_STATUS } from "@/lib/constants";
import { IDLE_STATE, type ActionState } from "@/lib/validations/commerce";
import { Button } from "@/components/ui/button";
import { FieldError, FormMessage, Label } from "@/components/ui/field";

/**
 * The approval decision — SRS §75.
 *
 * Which buttons exist is driven by the product's current status, and every one
 * of them is re-checked server side: `approveProduct` refuses a draft and a
 * product with no images, `setProductVisibility` refuses to hide anything that
 * is not live. A button that is not drawn is not a control, which is the same
 * rule the sub-order transitions follow.
 */
export function ProductDecision({
  productId,
  status,
}: {
  productId: string;
  status: string;
}) {
  const [approveState, approveAction, approving] = useActionState(
    approveProduct,
    IDLE_STATE,
  );
  const [rejectState, rejectAction, rejecting] = useActionState(
    rejectProduct,
    IDLE_STATE,
  );
  const [visibilityState, visibilityAction, changingVisibility] =
    useActionState(setProductVisibility, IDLE_STATE);

  const [showReject, setShowReject] = useState(false);

  const message: ActionState | null =
    [approveState, rejectState, visibilityState].find(
      (state) => state.status !== "idle",
    ) ?? null;

  const canApprove =
    status === PRODUCT_STATUS.PENDING ||
    status === PRODUCT_STATUS.REJECTED ||
    status === PRODUCT_STATUS.HIDDEN;
  const canReject =
    status === PRODUCT_STATUS.PENDING || status === PRODUCT_STATUS.APPROVED;

  return (
    <div className="space-y-4">
      {message?.message && (
        <FormMessage tone={message.status === "error" ? "error" : "success"}>
          {message.message}
        </FormMessage>
      )}

      {!showReject && (
        <div className="flex flex-wrap gap-3">
          {canApprove && (
            <form action={approveAction}>
              <input type="hidden" name="productId" value={productId} />
              <Button type="submit" size="sm" disabled={approving}>
                {approving ? "Working…" : "Approve and publish"}
              </Button>
            </form>
          )}

          {canReject && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setShowReject(true)}
            >
              Reject with feedback
            </Button>
          )}

          {status === PRODUCT_STATUS.APPROVED && (
            <form action={visibilityAction}>
              <input type="hidden" name="productId" value={productId} />
              <input
                type="hidden"
                name="status"
                value={PRODUCT_STATUS.HIDDEN}
              />
              <Button
                type="submit"
                size="sm"
                variant="ghost"
                disabled={changingVisibility}
              >
                {changingVisibility ? "Working…" : "Hide from storefront"}
              </Button>
            </form>
          )}

          {status === PRODUCT_STATUS.HIDDEN && (
            <form action={visibilityAction}>
              <input type="hidden" name="productId" value={productId} />
              <input
                type="hidden"
                name="status"
                value={PRODUCT_STATUS.APPROVED}
              />
              <Button
                type="submit"
                size="sm"
                variant="secondary"
                disabled={changingVisibility}
              >
                {changingVisibility ? "Working…" : "Restore to storefront"}
              </Button>
            </form>
          )}

          {status === PRODUCT_STATUS.DRAFT && (
            <p className="text-sm text-ink-400">
              Still a draft — the seller has not submitted it for approval.
            </p>
          )}
        </div>
      )}

      {showReject && (
        <form action={rejectAction} className="space-y-3">
          <input type="hidden" name="productId" value={productId} />
          <div className="space-y-2">
            <Label htmlFor="reject-note">What does the seller need to fix?</Label>
            <textarea
              id="reject-note"
              name="note"
              rows={3}
              required
              minLength={10}
              maxLength={500}
              placeholder="This appears on the seller's product, word for word."
              className="w-full border border-ivory-400 bg-ivory-50 px-4 py-3 text-sm text-ink-900 placeholder:text-ink-400/60 focus:border-brand-600 focus:outline-none"
            />
            <FieldError messages={rejectState.errors?.note} />
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" size="sm" variant="danger" disabled={rejecting}>
              {rejecting ? "Working…" : "Send back to the seller"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowReject(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
