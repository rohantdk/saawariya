"use client";

import { useActionState, useState } from "react";
import {
  approveSeller,
  rejectSeller,
  reviewSellerDocument,
  setSellerCommission,
  startSellerReview,
  suspendSeller,
} from "@/app/actions/admin-sellers";
import { SELLER_VERIFICATION } from "@/lib/constants";
import { IDLE_STATE, type ActionState } from "@/lib/validations/commerce";
import { Button } from "@/components/ui/button";
import { FieldError, FormMessage, Input, Label } from "@/components/ui/field";

/**
 * The verification controls — SRS §55, §74.
 *
 * Approve, reject and suspend are three separate Server Actions rather than one
 * action switching on a posted `decision`, because they are three different
 * authorisations and three different validation rules; collapsing them would
 * mean one schema that is sometimes strict about the note and sometimes not.
 *
 * That means three forms, and a shared note field cannot belong to all of them.
 * So a destructive decision *reveals* its own form instead: pressing "Reject"
 * opens a reason box, and the reason box is the only route to the submit. That
 * is a better confirmation step than a modal, and it removes any question of
 * which form a textarea posts to.
 */

function firstMessage(...states: ActionState[]): ActionState | null {
  return states.find((state) => state.status !== "idle") ?? null;
}

export function SellerVerificationActions({
  sellerId,
  status,
  kycComplete,
  outstandingDocs,
}: {
  sellerId: string;
  status: string;
  kycComplete: boolean;
  outstandingDocs: string[];
}) {
  const [approveState, approveAction, approving] = useActionState(
    approveSeller,
    IDLE_STATE,
  );
  const [rejectState, rejectAction, rejecting] = useActionState(
    rejectSeller,
    IDLE_STATE,
  );
  const [suspendState, suspendAction, suspending] = useActionState(
    suspendSeller,
    IDLE_STATE,
  );
  const [reviewState, reviewAction, startingReview] = useActionState(
    startSellerReview,
    IDLE_STATE,
  );

  const [mode, setMode] = useState<"reject" | "suspend" | null>(null);

  const message = firstMessage(
    approveState,
    rejectState,
    suspendState,
    reviewState,
  );

  const isApproved = status === SELLER_VERIFICATION.APPROVED;
  const isSuspended = status === SELLER_VERIFICATION.SUSPENDED;
  const canApprove = !isApproved;

  return (
    <div className="space-y-4">
      {message?.message && (
        <FormMessage tone={message.status === "error" ? "error" : "success"}>
          {message.message}
        </FormMessage>
      )}

      {mode === null && (
        <div className="flex flex-wrap gap-3">
          {status === SELLER_VERIFICATION.PENDING && (
            <form action={reviewAction}>
              <input type="hidden" name="sellerId" value={sellerId} />
              <Button
                type="submit"
                size="sm"
                variant="secondary"
                disabled={startingReview}
              >
                {startingReview ? "Working…" : "Start review"}
              </Button>
            </form>
          )}

          {canApprove && (
            <form action={approveAction}>
              <input type="hidden" name="sellerId" value={sellerId} />
              <Button
                type="submit"
                size="sm"
                disabled={approving || !kycComplete}
                title={
                  kycComplete
                    ? undefined
                    : "Approve every KYC document first"
                }
              >
                {approving
                  ? "Working…"
                  : isSuspended
                    ? "Reinstate seller"
                    : "Approve seller"}
              </Button>
            </form>
          )}

          {!isApproved && !isSuspended && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setMode("reject")}
            >
              Reject application
            </Button>
          )}

          {isApproved && (
            <Button
              size="sm"
              variant="danger"
              onClick={() => setMode("suspend")}
            >
              Suspend seller
            </Button>
          )}
        </div>
      )}

      {/* The gate is enforced server-side too; this only explains the disabled
          button, because "nothing happens when I click Approve" is a support
          ticket. */}
      {canApprove && !kycComplete && mode === null && (
        <p className="text-xs leading-relaxed text-warning">
          Approve every KYC document before verifying this seller — outstanding:{" "}
          {outstandingDocs.join(", ")}.
        </p>
      )}

      {mode === "reject" && (
        <form action={rejectAction} className="space-y-3">
          <input type="hidden" name="sellerId" value={sellerId} />
          <div className="space-y-2">
            <Label htmlFor="reject-note">
              Why is this application being rejected?
            </Label>
            <textarea
              id="reject-note"
              name="note"
              rows={3}
              required
              minLength={10}
              maxLength={500}
              placeholder="The seller sees this word for word on their application page."
              className="rounded-md w-full border border-ivory-400 bg-ivory-50 px-4 py-3 text-sm text-ink-900 placeholder:text-ink-400/60 focus:border-brand-600 focus:outline-none"
            />
            <FieldError messages={rejectState.errors?.note} />
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" size="sm" variant="danger" disabled={rejecting}>
              {rejecting ? "Working…" : "Confirm rejection"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMode(null)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {mode === "suspend" && (
        <form action={suspendAction} className="space-y-3">
          <input type="hidden" name="sellerId" value={sellerId} />
          <div className="space-y-2">
            <Label htmlFor="suspend-note">Reason for suspension</Label>
            <textarea
              id="suspend-note"
              name="note"
              rows={3}
              required
              minLength={10}
              maxLength={500}
              placeholder="This withdraws every live product from the storefront. The seller sees this reason."
              className="rounded-md w-full border border-ivory-400 bg-ivory-50 px-4 py-3 text-sm text-ink-900 placeholder:text-ink-400/60 focus:border-brand-600 focus:outline-none"
            />
            <FieldError messages={suspendState.errors?.note} />
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              type="submit"
              size="sm"
              variant="danger"
              disabled={suspending}
            >
              {suspending ? "Working…" : "Suspend and withdraw catalogue"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMode(null)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

/**
 * One KYC document's decision.
 *
 * Approving posts straight away; rejecting reveals the note field, because a
 * rejected document is one the seller has to replace and "rejected" alone does
 * not tell them what was wrong with it.
 */
export function KycDocumentReview({
  documentId,
  docType,
  status,
}: {
  documentId: string;
  docType: string;
  status: string;
}) {
  const [state, action, pending] = useActionState(
    reviewSellerDocument,
    IDLE_STATE,
  );
  const [rejecting, setRejecting] = useState(false);

  return (
    <div className="space-y-2">
      {state.status === "error" && state.message && (
        <p className="text-xs text-danger" role="alert">
          {state.message}
        </p>
      )}

      {!rejecting ? (
        <div className="flex flex-wrap gap-2">
          {status !== "APPROVED" && (
            <form action={action}>
              <input type="hidden" name="documentId" value={documentId} />
              <input type="hidden" name="docType" value={docType} />
              <input type="hidden" name="decision" value="APPROVED" />
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? "Working…" : "Approve"}
              </Button>
            </form>
          )}
          {status !== "REJECTED" && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setRejecting(true)}
            >
              Reject
            </Button>
          )}
        </div>
      ) : (
        <form action={action} className="space-y-2">
          <input type="hidden" name="documentId" value={documentId} />
          <input type="hidden" name="docType" value={docType} />
          <input type="hidden" name="decision" value="REJECTED" />
          <Input
            name="reviewNote"
            required
            maxLength={300}
            placeholder="What is wrong with this document?"
            aria-label="Rejection note"
            invalid={Boolean(state.errors?.reviewNote)}
          />
          <FieldError messages={state.errors?.reviewNote} />
          <div className="flex gap-2">
            <Button type="submit" size="sm" variant="danger" disabled={pending}>
              {pending ? "Working…" : "Confirm"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setRejecting(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

/** Per-seller commission override — SRS §13.1, §119. */
export function CommissionForm({
  sellerId,
  commissionPercent,
}: {
  sellerId: string;
  commissionPercent: number;
}) {
  const [state, action, pending] = useActionState(
    setSellerCommission,
    IDLE_STATE,
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="sellerId" value={sellerId} />

      {state.message && (
        <FormMessage tone={state.status === "error" ? "error" : "success"}>
          {state.message}
        </FormMessage>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-32 space-y-2">
          <Label htmlFor="commissionPercent">Commission %</Label>
          <Input
            id="commissionPercent"
            name="commissionPercent"
            type="number"
            min={0}
            max={50}
            step={1}
            defaultValue={commissionPercent}
            invalid={Boolean(state.errors?.commissionPercent)}
          />
        </div>
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          {pending ? "Saving…" : "Update"}
        </Button>
      </div>
      <FieldError messages={state.errors?.commissionPercent} />
    </form>
  );
}
