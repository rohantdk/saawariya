"use client";

import { useActionState, useState } from "react";
import { movePipeline } from "@/app/actions/operations";
import { SUB_ORDER_STATUS } from "@/lib/constants";
import { IDLE_STATE } from "@/lib/validations/commerce";
import { Button } from "@/components/ui/button";
import { FormMessage, Input, Label } from "@/components/ui/field";

export type OfferedMove = {
  to: string;
  label: string;
  /** The desk this move belongs to — drives the stand-in labelling below. */
  actor: string;
};

/**
 * The controls that advance a parcel, shared by all three operations desks.
 *
 * The buttons are built on the server from `availableTransitions()` against the
 * viewer's own permissions, so a move this desk cannot make is never drawn — and
 * `assertTransition` re-checks on submit regardless, because a button that is
 * not drawn is not a control. Anyone can post to a Server Action.
 *
 * When `desk` is passed and a move belongs to a different one, the button says
 * so ("Warehouse: Start picking"). Only a super admin standing in ever sees
 * that, and someone acting for another team should be able to see that they are.
 *
 * A cancellation asks for a reason first. It ends the customer's order and
 * releases the stock it was holding, and it cannot be undone.
 */
export function PipelineActions({
  subOrderId,
  subOrderNumber,
  moves,
  desk,
  size = "md",
  emptyLabel,
}: {
  subOrderId: string;
  subOrderNumber: string;
  moves: OfferedMove[];
  desk?: string;
  size?: "sm" | "md";
  /** Shown when there is nothing to do. Omit to render nothing at all. */
  emptyLabel?: string;
}) {
  const [state, action, pending] = useActionState(movePipeline, IDLE_STATE);
  const [cancelling, setCancelling] = useState(false);

  const cancelMove = moves.find((m) => m.to === SUB_ORDER_STATUS.CANCELLED);
  const forward = moves.filter((m) => m !== cancelMove);

  if (moves.length === 0 && state.status === "idle") {
    return emptyLabel ? (
      <p className="text-xs text-ink-400">{emptyLabel}</p>
    ) : null;
  }

  const labelFor = (move: OfferedMove) =>
    desk && move.actor !== desk
      ? `${titleCase(move.actor)}: ${move.label}`
      : move.label;

  return (
    <div className="space-y-3">
      {state.status !== "idle" && state.message && (
        <FormMessage tone={state.status === "error" ? "error" : "success"}>
          {state.message}
        </FormMessage>
      )}

      {!cancelling && (
        <div className="flex flex-wrap gap-2">
          {forward.map((move, index) => (
            <form action={action} key={move.to}>
              <input type="hidden" name="subOrderId" value={subOrderId} />
              <input type="hidden" name="to" value={move.to} />
              <Button
                type="submit"
                size={size}
                variant={index === 0 ? "primary" : "secondary"}
                disabled={pending}
              >
                {pending ? "Working…" : labelFor(move)}
              </Button>
            </form>
          ))}

          {cancelMove && (
            <Button
              size={size}
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
            Cancelling {subOrderNumber} releases the stock it is holding and
            tells the customer this part of their order cannot be fulfilled. It
            cannot be undone.
          </p>

          <div className="space-y-2">
            <Label htmlFor={`cancel-${subOrderId}`}>Reason</Label>
            <Input
              id={`cancel-${subOrderId}`}
              name="note"
              required
              maxLength={300}
              placeholder="e.g. Only 2 of 5 metres on the shelf, no replacement stock"
              invalid={Boolean(state.errors?.note)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" variant="danger" disabled={pending}>
              {pending ? "Cancelling…" : "Cancel this parcel"}
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
