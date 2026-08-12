"use client";

import { useActionState, useState } from "react";
import { adminTransitionSubOrder } from "@/app/actions/admin-orders";
import { SUB_ORDER_STATUS } from "@/lib/constants";
import { IDLE_STATE } from "@/lib/validations/commerce";
import { Button } from "@/components/ui/button";
import { FormMessage, Input, Label } from "@/components/ui/field";

export type OfferedTransition = {
  to: string;
  label: string;
  actor: string;
};

/**
 * Admin override on one sub-order — SRS §78.
 *
 * The buttons come from `availableTransitions()` evaluated on the server with
 * the admin's permissions, which for `SUPER_ADMIN` is every legal move out of
 * the current state. Each one is labelled with the role it normally belongs to
 * ("Warehouse: Start picking"), because an admin pressing it is standing in for
 * that team and should be able to see they are doing so.
 *
 * A cancellation asks for a reason first. It releases reserved stock and tells
 * the customer their parcel is not coming, and it cannot be undone.
 */
export function OrderOverride({
  subOrderId,
  subOrderNumber,
  transitions,
}: {
  subOrderId: string;
  subOrderNumber: string;
  transitions: OfferedTransition[];
}) {
  const [state, action, pending] = useActionState(
    adminTransitionSubOrder,
    IDLE_STATE,
  );
  const [cancelling, setCancelling] = useState(false);

  const cancelMove = transitions.find(
    (t) => t.to === SUB_ORDER_STATUS.CANCELLED,
  );
  const forward = transitions.filter((t) => t !== cancelMove);

  if (transitions.length === 0) {
    return (
      <p className="text-xs text-ink-400">
        No further moves are legal from this state.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {state.status !== "idle" && state.message && (
        <FormMessage tone={state.status === "error" ? "error" : "success"}>
          {state.message}
        </FormMessage>
      )}

      {!cancelling && (
        <div className="flex flex-wrap gap-2">
          {forward.map((transition, index) => (
            <form action={action} key={transition.to}>
              <input type="hidden" name="subOrderId" value={subOrderId} />
              <input type="hidden" name="to" value={transition.to} />
              <Button
                type="submit"
                size="sm"
                variant={index === 0 ? "primary" : "secondary"}
                disabled={pending}
              >
                {pending ? "Working…" : `${titleCase(transition.actor)}: ${transition.label}`}
              </Button>
            </form>
          ))}

          {cancelMove && (
            <Button
              size="sm"
              variant="ghost"
              className="text-danger"
              onClick={() => setCancelling(true)}
              disabled={pending}
            >
              {cancelMove.label}
            </Button>
          )}
        </div>
      )}

      {cancelling && cancelMove && (
        <form
          action={action}
          className="space-y-3 border border-danger/30 bg-danger-soft p-4"
        >
          <input type="hidden" name="subOrderId" value={subOrderId} />
          <input type="hidden" name="to" value={cancelMove.to} />

          <p className="text-xs leading-relaxed text-ink-500">
            Cancelling {subOrderNumber} releases its reserved stock and tells the
            customer this part of their order cannot be fulfilled. It cannot be
            undone.
          </p>

          <div className="space-y-2">
            <Label htmlFor={`cancel-${subOrderId}`}>Reason</Label>
            <Input
              id={`cancel-${subOrderId}`}
              name="note"
              required
              maxLength={300}
              placeholder="Recorded on the order timeline and in the audit log."
              invalid={Boolean(state.errors?.note)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" variant="danger" disabled={pending}>
              {pending ? "Cancelling…" : "Cancel this sub-order"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setCancelling(false)}
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

function titleCase(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}
