"use client";

import { useActionState } from "react";
import { moderateReview } from "@/app/actions/admin-reviews";
import { REVIEW_STATUS } from "@/lib/constants";
import { IDLE_STATE } from "@/lib/validations/commerce";
import { Button } from "@/components/ui/button";

/**
 * Approve or reject one review — SRS §47.
 *
 * No note field, unlike every other rejection in this console. A rejected
 * review is not something the customer is asked to fix and resubmit — the
 * `Review` model has one row per customer per product and no revision history —
 * so a "what to change" box would promise a workflow that does not exist. The
 * customer is told plainly that it was not published.
 */
export function ReviewModeration({
  reviewId,
  status,
}: {
  reviewId: string;
  status: string;
}) {
  const [state, action, pending] = useActionState(moderateReview, IDLE_STATE);

  return (
    <div className="space-y-2">
      {state.message && (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={`text-xs leading-relaxed ${
            state.status === "error" ? "text-danger" : "text-success"
          }`}
        >
          {state.message}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {status !== REVIEW_STATUS.APPROVED && (
          <form action={action}>
            <input type="hidden" name="reviewId" value={reviewId} />
            <input type="hidden" name="decision" value="APPROVED" />
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Working…" : "Publish"}
            </Button>
          </form>
        )}

        {status !== REVIEW_STATUS.REJECTED && (
          <form action={action}>
            <input type="hidden" name="reviewId" value={reviewId} />
            <input type="hidden" name="decision" value="REJECTED" />
            <Button
              type="submit"
              size="sm"
              variant="secondary"
              disabled={pending}
            >
              {pending ? "Working…" : "Reject"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
