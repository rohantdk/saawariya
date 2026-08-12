"use client";

import { useActionState, useState } from "react";
import {
  recordFailedDelivery,
  updateTracking,
} from "@/app/actions/operations-logistics";
import { IDLE_STATE } from "@/lib/validations/commerce";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Select } from "@/components/ui/field";
import { DELIVERY_FAILURE_REASONS, SUB_ORDER_STATUS } from "@/lib/constants";

export type TrackingMove = { to: string; label: string };

/**
 * Moving a parcel along, and recording an attempt that failed — SRS §109, §110.
 *
 * Two actions in one component because they are the same decision made at the
 * same moment: the parcel either got there or it did not.
 *
 * They differ in what they touch, and that difference is the interesting part.
 * Advancing moves the sub-order *and* the shipment. A failed attempt moves only
 * the shipment: the order stays out for delivery, because the courier will try
 * again and telling the customer their parcel had gone backwards would be
 * false. The panel says so on the page rather than leaving that surprising.
 */
export function TrackingForm({
  subOrderId,
  subOrderNumber,
  moves,
  canFail,
  size = "md",
}: {
  subOrderId: string;
  subOrderNumber: string;
  moves: TrackingMove[];
  canFail: boolean;
  size?: "sm" | "md";
}) {
  const [state, action, pending] = useActionState(updateTracking, IDLE_STATE);
  const [failState, failAction, failPending] = useActionState(
    recordFailedDelivery,
    IDLE_STATE,
  );
  const [failing, setFailing] = useState(false);

  const busy = pending || failPending;

  if (moves.length === 0 && !canFail && state.status === "idle") {
    return (
      <p className="text-xs text-ink-400">
        Nothing for logistics to do with {subOrderNumber} right now.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* One message at a time. The two actions keep separate `useActionState`
          results and neither resets the other, so rendering both leaves a stale
          "updated" banner sitting above the reply to what was just done. */}
      {!failing && state.status !== "idle" && state.message && (
        <FormMessage tone={state.status === "error" ? "error" : "success"}>
          {state.message}
        </FormMessage>
      )}
      {failState.status !== "idle" && failState.message && (
        <FormMessage tone={failState.status === "error" ? "error" : "success"}>
          {failState.message}
        </FormMessage>
      )}

      {!failing && (
        <div className="flex flex-wrap items-end gap-3">
          {moves.map((move, index) => (
            <form
              action={action}
              key={move.to}
              className="flex flex-wrap items-end gap-2"
            >
              <input type="hidden" name="subOrderId" value={subOrderId} />
              <input type="hidden" name="to" value={move.to} />
              {/* Where the scan happened. Optional, because a courier network
                  does not always report one and a required field that is
                  routinely unknown gets filled with "N/A". */}
              {move.to !== SUB_ORDER_STATUS.DELIVERED && (
                <Input
                  name="location"
                  maxLength={120}
                  placeholder="Location (optional)"
                  aria-label={`Location for ${move.label}`}
                  className="w-48 py-2"
                />
              )}
              <Button
                type="submit"
                size={size}
                variant={index === 0 ? "primary" : "secondary"}
                disabled={busy}
              >
                {pending ? "Working…" : move.label}
              </Button>
            </form>
          ))}

          {canFail && (
            <Button
              size={size}
              variant="ghost"
              className="text-danger"
              onClick={() => setFailing(true)}
              disabled={busy}
            >
              Attempt failed
            </Button>
          )}
        </div>
      )}

      {failing && (
        <form
          action={failAction}
          className="space-y-4 border border-warning/40 bg-warning-soft p-4"
        >
          <input type="hidden" name="subOrderId" value={subOrderId} />

          <p className="text-xs leading-relaxed text-ink-500">
            {subOrderNumber} stays <strong>out for delivery</strong> — the
            courier will re-attempt, and that is what the customer&rsquo;s
            tracking page will keep saying. Only the shipment records the failed
            attempt.
          </p>

          <Field
            label="Why it failed"
            htmlFor={`fail-reason-${subOrderId}`}
            errors={failState.errors?.reason}
          >
            <Select
              id={`fail-reason-${subOrderId}`}
              name="reason"
              required
              defaultValue=""
              invalid={Boolean(failState.errors?.reason)}
            >
              <option value="" disabled>
                Choose a reason
              </option>
              {DELIVERY_FAILURE_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Note"
            htmlFor={`fail-note-${subOrderId}`}
            errors={failState.errors?.note}
            hint="Optional. Appears on the order timeline and the shipment history."
          >
            <Input
              id={`fail-note-${subOrderId}`}
              name="note"
              maxLength={300}
              placeholder="e.g. Shop shuttered, courier to retry tomorrow"
            />
          </Field>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" variant="danger" disabled={busy}>
              {failPending ? "Recording…" : "Record the attempt"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setFailing(false)}
              disabled={busy}
            >
              Back
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
