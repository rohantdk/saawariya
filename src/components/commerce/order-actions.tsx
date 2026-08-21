"use client";

import { useActionState } from "react";
import { cancelOrderAction, requestReturnAction } from "@/app/actions/orders";
import {
  CANCEL_REASONS,
  IDLE_STATE,
  RETURN_REASONS,
} from "@/lib/validations/commerce";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Select } from "@/components/ui/field";

/**
 * Cancelling an order and requesting a return.
 *
 * Both are destructive-ish and both sit behind a <details> disclosure with a
 * required reason. That is not friction for its own sake: the reason is written
 * into the OrderEvent trail and is what the support and operations screens read
 * to understand why an order ended the way it did.
 */

export function CancelOrderPanel({ orderNumber }: { orderNumber: string }) {
  const [state, action, pending] = useActionState(
    cancelOrderAction,
    IDLE_STATE,
  );

  if (state.status === "success") {
    return (
      <FormMessage tone="success">
        {state.message ?? "Your order has been cancelled."}
      </FormMessage>
    );
  }

  return (
    <details className="rounded-md border border-ivory-400 bg-ivory-50">
      <summary className="cursor-pointer p-4 text-sm text-ink-500 transition-colors hover:text-danger">
        Cancel this order
      </summary>

      <form action={action} className="space-y-4 border-t border-ivory-400 p-5">
        <input type="hidden" name="orderNumber" value={orderNumber} />

        {state.status === "error" && state.message && (
          <FormMessage>{state.message}</FormMessage>
        )}

        <p className="text-sm leading-relaxed text-ink-400">
          Cancelling releases the items back to stock straight away. If you have
          already paid, a refund is raised to your original payment method for
          our finance team to process.
        </p>

        <Field
          label="Why are you cancelling?"
          htmlFor="cancel-reason"
          errors={state.errors?.reason}
        >
          <Select
            id="cancel-reason"
            name="reason"
            defaultValue=""
            required
            invalid={Boolean(state.errors?.reason)}
          >
            <option value="" disabled>
              Choose a reason
            </option>
            {CANCEL_REASONS.map((reason) => (
              <option key={reason} value={reason}>
                {reason}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Anything else? (optional)"
          htmlFor="cancel-detail"
          errors={state.errors?.detail}
        >
          <textarea
            id="cancel-detail"
            name="detail"
            rows={3}
            maxLength={500}
            className="w-full border border-ivory-400 bg-ivory-50 px-4 py-3 text-sm text-ink-900 focus:border-brand-600 focus:outline-none"
          />
        </Field>

        <Button type="submit" variant="danger" disabled={pending}>
          {pending ? "Cancelling…" : "Cancel order"}
        </Button>
      </form>
    </details>
  );
}

export function ReturnRequestPanel({
  subOrderNumber,
  closesOn,
}: {
  subOrderNumber: string;
  closesOn: Date | null;
}) {
  const [state, action, pending] = useActionState(
    requestReturnAction,
    IDLE_STATE,
  );

  if (state.status === "success") {
    return (
      <FormMessage tone="success">
        {state.message ?? "Return requested."}
      </FormMessage>
    );
  }

  return (
    <details className="rounded-md border border-ivory-400 bg-ivory-100">
      <summary className="cursor-pointer p-4 text-sm text-ink-500 transition-colors hover:text-brand-600">
        Request a return
        {closesOn && (
          <span className="ml-1 text-xs text-ink-400">
            — window closes{" "}
            {new Intl.DateTimeFormat("en-IN", {
              day: "numeric",
              month: "short",
            }).format(closesOn)}
          </span>
        )}
      </summary>

      <form action={action} className="space-y-4 border-t border-ivory-400 p-5">
        <input type="hidden" name="subOrderNumber" value={subOrderNumber} />

        {state.status === "error" && state.message && (
          <FormMessage>{state.message}</FormMessage>
        )}

        <Field
          label="What went wrong?"
          htmlFor={`return-reason-${subOrderNumber}`}
          errors={state.errors?.reason}
        >
          <Select
            id={`return-reason-${subOrderNumber}`}
            name="reason"
            defaultValue=""
            required
            invalid={Boolean(state.errors?.reason)}
          >
            <option value="" disabled>
              Choose a reason
            </option>
            {RETURN_REASONS.map((reason) => (
              <option key={reason} value={reason}>
                {reason}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Tell us more (optional)"
          htmlFor={`return-detail-${subOrderNumber}`}
          errors={state.errors?.detail}
          hint="Detail helps us decide between a refund and a replacement."
        >
          <textarea
            id={`return-detail-${subOrderNumber}`}
            name="detail"
            rows={3}
            maxLength={500}
            className="w-full border border-ivory-400 bg-ivory-50 px-4 py-3 text-sm text-ink-900 focus:border-brand-600 focus:outline-none"
          />
        </Field>

        <Button type="submit" disabled={pending}>
          {pending ? "Submitting…" : "Request return"}
        </Button>
      </form>
    </details>
  );
}
