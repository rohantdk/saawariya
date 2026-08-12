"use client";

import { useActionState, useState } from "react";
import { reportStockDiscrepancy } from "@/app/actions/operations-warehouse";
import { IDLE_STATE } from "@/lib/validations/commerce";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Select } from "@/components/ui/field";

export type DiscrepancyLine = {
  id: string;
  productName: string;
  productSku: string;
  quantity: number;
};

/**
 * Reporting a shortage or damage found while picking — SRS §98.
 *
 * Closed by default. This is the one control on the operations panels that
 * writes stock down, and putting it behind a deliberate click is part of what
 * keeps it a report of something found rather than a stock editor: the operator
 * has to mean it, name the line, and say what happened.
 *
 * The line is a `<select>` over this parcel's own items, so a discrepancy can
 * only ever be recorded against something that is actually in the box.
 */
export function DiscrepancyForm({
  subOrderId,
  lines,
}: {
  subOrderId: string;
  lines: DiscrepancyLine[];
}) {
  const [state, action, pending] = useActionState(
    reportStockDiscrepancy,
    IDLE_STATE,
  );
  const [open, setOpen] = useState(false);

  if (!open && state.status !== "success") {
    return (
      <div className="space-y-3">
        {state.status === "error" && state.message && (
          <FormMessage tone="error">{state.message}</FormMessage>
        )}
        <p className="text-xs leading-relaxed text-ink-400">
          If the shelf does not hold what this parcel asks for, record it. The
          stock ledger and the seller are both updated; nothing else about the
          parcel changes.
        </p>
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          Report a shortage or damage
        </Button>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="subOrderId" value={subOrderId} />

      {state.status !== "idle" && state.message && (
        <FormMessage tone={state.status === "error" ? "error" : "success"}>
          {state.message}
        </FormMessage>
      )}

      <Field label="Line" htmlFor="discrepancy-item" errors={state.errors?.orderItemId}>
        <Select id="discrepancy-item" name="orderItemId" required>
          {lines.map((line) => (
            <option key={line.id} value={line.id}>
              {line.productSku} — {line.productName} ({line.quantity} asked for)
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="What happened"
        htmlFor="discrepancy-kind"
        errors={state.errors?.kind}
        hint="Damaged stock was here and is now unsellable. A shortage was never here."
      >
        <Select id="discrepancy-kind" name="kind" required defaultValue="SHORTAGE">
          <option value="SHORTAGE">Short — fewer on the shelf than recorded</option>
          <option value="DAMAGED">Damaged — found unsellable</option>
        </Select>
      </Field>

      <Field
        label="Units affected"
        htmlFor="discrepancy-qty"
        errors={state.errors?.quantity}
      >
        <Input
          id="discrepancy-qty"
          name="quantity"
          type="number"
          min={1}
          defaultValue={1}
          required
          invalid={Boolean(state.errors?.quantity)}
        />
      </Field>

      <Field
        label="What you found"
        htmlFor="discrepancy-note"
        errors={state.errors?.note}
        hint="Recorded in the stock ledger, on the order timeline and in the message to the seller."
      >
        <Input
          id="discrepancy-note"
          name="note"
          required
          minLength={10}
          maxLength={300}
          placeholder="e.g. Water damage along one edge of the bolt"
          invalid={Boolean(state.errors?.note)}
        />
      </Field>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="sm" variant="danger" disabled={pending}>
          {pending ? "Recording…" : "Record it"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          Close
        </Button>
      </div>
    </form>
  );
}
