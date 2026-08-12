"use client";

import { useActionState, useState } from "react";
import {
  setCustomerStatus,
  setCustomerTier,
} from "@/app/actions/admin-customers";
import { CUSTOMER_TYPE, USER_STATUS } from "@/lib/constants";
import { IDLE_STATE } from "@/lib/validations/commerce";
import { Button } from "@/components/ui/button";
import { FieldError, FormMessage, Input, Label } from "@/components/ui/field";

/**
 * Suspend or reinstate a customer account — SRS §73.
 *
 * Suspending reveals a reason field first, for the same reason every other
 * destructive decision in this console does: the reason is written to the
 * audit log and sent to the customer, and "suspended" with no explanation is
 * a support ticket waiting to happen.
 */
export function CustomerStatusActions({
  userId,
  status,
}: {
  userId: string;
  status: string;
}) {
  const [state, action, pending] = useActionState(
    setCustomerStatus,
    IDLE_STATE,
  );
  const [confirming, setConfirming] = useState(false);

  const suspended = status === USER_STATUS.SUSPENDED;

  return (
    <div className="space-y-3">
      {state.message && (
        <FormMessage tone={state.status === "error" ? "error" : "success"}>
          {state.message}
        </FormMessage>
      )}

      {suspended ? (
        <form action={action}>
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="action" value="REINSTATE" />
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Working…" : "Reinstate account"}
          </Button>
        </form>
      ) : confirming ? (
        <form action={action} className="space-y-3">
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="action" value="SUSPEND" />
          <div className="space-y-2">
            <Label htmlFor="suspend-reason">Reason for suspension</Label>
            <Input
              id="suspend-reason"
              name="reason"
              required
              maxLength={300}
              placeholder="Recorded in the audit log and sent to the customer."
              invalid={Boolean(state.errors?.reason)}
            />
            <FieldError messages={state.errors?.reason} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" variant="danger" disabled={pending}>
              {pending ? "Working…" : "Suspend account"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfirming(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setConfirming(true)}
        >
          Suspend account
        </Button>
      )}
    </div>
  );
}

/** Retail ↔ wholesale — SRS §14. A tier, not a role; see docs/ROLES.md. */
export function CustomerTierForm({
  customerId,
  customerType,
  gstNumber,
}: {
  customerId: string;
  customerType: string;
  gstNumber: string | null;
}) {
  const [state, action, pending] = useActionState(setCustomerTier, IDLE_STATE);
  const [target, setTarget] = useState(customerType);

  const goingWholesale = target === CUSTOMER_TYPE.WHOLESALE;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="customerId" value={customerId} />

      {state.message && (
        <FormMessage tone={state.status === "error" ? "error" : "success"}>
          {state.message}
        </FormMessage>
      )}

      <fieldset className="space-y-2">
        <legend className="mb-2 block text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400">
          Pricing tier
        </legend>
        {[CUSTOMER_TYPE.RETAIL, CUSTOMER_TYPE.WHOLESALE].map((tier) => (
          <label
            key={tier}
            className="flex items-center gap-2.5 text-sm text-ink-900"
          >
            <input
              type="radio"
              name="customerType"
              value={tier}
              checked={target === tier}
              onChange={() => setTarget(tier)}
              className="h-4 w-4 accent-brand-600"
            />
            {tier === CUSTOMER_TYPE.RETAIL
              ? "Retail — list prices, no minimum"
              : "Wholesale — trade prices and MOQs"}
          </label>
        ))}
      </fieldset>

      {goingWholesale && (
        <div className="space-y-2">
          <Label htmlFor="gstNumber">GSTIN</Label>
          <Input
            id="gstNumber"
            name="gstNumber"
            defaultValue={gstNumber ?? ""}
            maxLength={15}
            placeholder="27AAECS1234F1Z5"
            invalid={Boolean(state.errors?.gstNumber)}
          />
          <FieldError messages={state.errors?.gstNumber} />
        </div>
      )}

      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {pending ? "Saving…" : "Update tier"}
      </Button>
    </form>
  );
}
