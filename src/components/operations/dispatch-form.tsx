"use client";

import { useActionState } from "react";
import { dispatchSubOrder } from "@/app/actions/operations-logistics";
import { IDLE_STATE } from "@/lib/validations/commerce";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Select } from "@/components/ui/field";
import { COURIERS } from "@/lib/constants";

/**
 * Handing a parcel to a courier — SRS §107, §108.
 *
 * One form, one submit: choosing the courier *is* the dispatch. Splitting it
 * into "assign a courier" and then "dispatch" would create a state where a
 * parcel has a carrier and a tracking number but has not left, which nothing in
 * the pipeline can represent and nobody could act on.
 *
 * The courier is a closed list from `constants.ts` rather than free text. The
 * delivery performance report groups by this column, and "Bluedart", "BlueDart"
 * and "blue dart" are three carriers nobody can report on.
 */
export function DispatchForm({
  subOrderId,
  compact = false,
}: {
  subOrderId: string;
  compact?: boolean;
}) {
  const [state, action, pending] = useActionState(dispatchSubOrder, IDLE_STATE);

  return (
    <form
      action={action}
      className={compact ? "flex flex-wrap items-end gap-3" : "space-y-4"}
    >
      <input type="hidden" name="subOrderId" value={subOrderId} />

      {state.status !== "idle" && state.message && (
        <div className={compact ? "w-full" : undefined}>
          <FormMessage tone={state.status === "error" ? "error" : "success"}>
            {state.message}
          </FormMessage>
        </div>
      )}

      <Field
        label="Courier"
        htmlFor={`courier-${subOrderId}`}
        errors={state.errors?.courierName}
        className={compact ? "w-56" : undefined}
      >
        <Select
          id={`courier-${subOrderId}`}
          name="courierName"
          required
          defaultValue=""
          invalid={Boolean(state.errors?.courierName)}
        >
          <option value="" disabled>
            Choose a courier
          </option>
          {COURIERS.map((courier) => (
            <option key={courier} value={courier}>
              {courier}
            </option>
          ))}
        </Select>
      </Field>

      {!compact && (
        <Field
          label="Note"
          htmlFor={`dispatch-note-${subOrderId}`}
          errors={state.errors?.note}
          hint="Optional. Recorded on the order timeline."
        >
          <Input
            id={`dispatch-note-${subOrderId}`}
            name="note"
            maxLength={300}
            placeholder="e.g. Two boxes, oversize"
          />
        </Field>
      )}

      <Button type="submit" size={compact ? "sm" : "md"} disabled={pending}>
        {pending ? "Dispatching…" : "Dispatch"}
      </Button>
    </form>
  );
}
