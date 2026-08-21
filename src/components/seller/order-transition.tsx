"use client";

import { useActionState, useState } from "react";
import { transitionSubOrder } from "@/app/actions/seller-orders";
import { SUB_ORDER_STATUS } from "@/lib/constants";
import { IDLE_STATE } from "@/lib/validations/commerce";
import { Button } from "@/components/ui/button";
import { FormMessage, Input, Label } from "@/components/ui/field";

export type OfferedTransition = {
  to: string;
  label: string;
};

/**
 * The seller's controls on a sub-order.
 *
 * The buttons are built from `availableTransitions()` on the server, so a move
 * this seller cannot make is never drawn — and the action re-checks with
 * `assertTransition` regardless, because a button that is not drawn is not a
 * control. Anyone can post to a Server Action.
 *
 * Declining asks for a reason before it will submit. It is the one irreversible
 * thing a seller can do here — it cancels the customer's parcel and releases
 * the stock — and "why" is what the customer notification and the audit trail
 * are made of.
 */
export function OrderTransition({
  subOrderId,
  transitions,
}: {
  subOrderId: string;
  transitions: OfferedTransition[];
}) {
  const [state, action, pending] = useActionState(
    transitionSubOrder,
    IDLE_STATE,
  );
  const [declining, setDeclining] = useState(false);

  if (transitions.length === 0 && state.status === "idle") return null;

  const confirmMove = transitions.find(
    (t) => t.to === SUB_ORDER_STATUS.CONFIRMED,
  );
  const declineMove = transitions.find(
    (t) => t.to === SUB_ORDER_STATUS.CANCELLED,
  );
  const others = transitions.filter(
    (t) => t !== confirmMove && t !== declineMove,
  );

  return (
    <div className="space-y-4">
      {state.status !== "idle" && state.message && (
        <FormMessage tone={state.status === "error" ? "error" : "success"}>
          {state.message}
        </FormMessage>
      )}

      {!declining && (
        <div className="flex flex-wrap gap-3">
          {confirmMove && (
            <form action={action}>
              <input type="hidden" name="subOrderId" value={subOrderId} />
              <input type="hidden" name="to" value={confirmMove.to} />
              <Button type="submit" disabled={pending}>
                {pending ? "Working…" : confirmMove.label}
              </Button>
            </form>
          )}

          {others.map((transition) => (
            <form action={action} key={transition.to}>
              <input type="hidden" name="subOrderId" value={subOrderId} />
              <input type="hidden" name="to" value={transition.to} />
              <Button type="submit" variant="secondary" disabled={pending}>
                {transition.label}
              </Button>
            </form>
          ))}

          {declineMove && (
            <Button
              variant="ghost"
              onClick={() => setDeclining(true)}
              disabled={pending}
            >
              {declineMove.label}
            </Button>
          )}
        </div>
      )}

      {declining && declineMove && (
        <form
          action={action}
          className="space-y-4 rounded-md border border-danger/30 bg-danger-soft p-5"
        >
          <input type="hidden" name="subOrderId" value={subOrderId} />
          <input type="hidden" name="to" value={declineMove.to} />

          <div>
            <p className="mb-1 text-sm text-ink-900">
              Decline this order?
            </p>
            <p className="text-xs leading-relaxed text-ink-500">
              The customer will be told it cannot be fulfilled and any payment
              refunded. The reserved stock goes back into your inventory. This
              cannot be undone.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="decline-note">Reason</Label>
            <Input
              id="decline-note"
              name="note"
              required
              maxLength={280}
              placeholder="e.g. Out of stock at our warehouse"
              invalid={Boolean(state.errors?.note)}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <Button type="submit" variant="danger" disabled={pending}>
              {pending ? "Declining…" : "Decline order"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeclining(false)}
              disabled={pending}
            >
              Keep it
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
