"use client";

import { useActionState } from "react";
import { adjustStock } from "@/app/actions/seller-inventory";
import { IDLE_STATE } from "@/lib/validations/commerce";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select } from "@/components/ui/field";

/**
 * Inline restock control, one per inventory row.
 *
 * The quantity posted is always positive; which way it moves comes from the
 * `value` of whichever submit button was pressed, since a submit button's value
 * is part of the form data. That keeps the sign entirely in HTML — no
 * controlled-input rewriting inside a click handler that is already submitting,
 * where the pre-update value would win.
 *
 * The input is uncontrolled and reset with `key` after a successful save, so the
 * next adjustment starts empty rather than re-submitting the number just
 * applied.
 */
export function StockAdjustForm({
  productId,
  stockQty,
}: {
  productId: string;
  stockQty: number;
}) {
  const [state, action, pending] = useActionState(adjustStock, IDLE_STATE);
  const errors = state.errors ?? {};

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="productId" value={productId} />

      <div className="flex flex-wrap items-end gap-2">
        <div className="w-24">
          <Label htmlFor={`qty-${productId}`} className="sr-only">
            Quantity to adjust
          </Label>
          <Input
            key={state.status === "success" ? state.message : "idle"}
            id={`qty-${productId}`}
            name="quantity"
            inputMode="numeric"
            placeholder="Qty"
            defaultValue=""
            invalid={Boolean(errors.quantity)}
            className="px-3 py-2"
          />
        </div>

        <div className="w-40">
          <Label htmlFor={`reason-${productId}`} className="sr-only">
            Reason
          </Label>
          <Select
            id={`reason-${productId}`}
            name="reason"
            defaultValue="SELLER_RESTOCK"
            className="px-3 py-2"
          >
            <option value="SELLER_RESTOCK">Restock</option>
            <option value="ADJUSTMENT">Correction</option>
            <option value="QC_DAMAGED">Damaged</option>
          </Select>
        </div>

        <Button type="submit" name="direction" value="add" size="sm" disabled={pending}>
          Add
        </Button>
        <Button
          type="submit"
          name="direction"
          value="remove"
          size="sm"
          variant="secondary"
          disabled={pending || stockQty === 0}
        >
          Remove
        </Button>
      </div>

      <FieldError messages={errors.quantity} />
      <FieldError messages={errors.direction} />

      {state.status === "success" && state.message && (
        <p className="text-xs text-success" role="status">
          {state.message}
        </p>
      )}
      {state.status === "error" && state.message && (
        <p className="text-xs text-danger" role="alert">
          {state.message}
        </p>
      )}
    </form>
  );
}
