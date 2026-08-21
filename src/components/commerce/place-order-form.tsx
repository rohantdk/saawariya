"use client";

import { useActionState } from "react";
import { Lock } from "lucide-react";
import { submitOrder } from "@/app/actions/checkout";
import { IDLE_STATE } from "@/lib/validations/commerce";
import { formatPaise } from "@/lib/utils";
import { FormMessage } from "@/components/ui/field";

/**
 * The form the checkout actually submits.
 *
 * It is deliberately tiny and lives in the summary column, while the address
 * and payment radios sit in the main column of the page. They are joined by the
 * HTML `form` attribute (`form="checkout"`), not by nesting — which lets the
 * page keep a two-column layout without wrapping half of it in a <form>, and
 * lets the "add a new address" form exist on the same page without illegally
 * nesting one form inside another.
 */
export function PlaceOrderForm({
  formId,
  idempotencyKey,
  couponCode,
  totalAmount,
  disabled,
  disabledReason,
}: {
  formId: string;
  idempotencyKey: string;
  couponCode: string | null;
  totalAmount: number;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [state, action, pending] = useActionState(submitOrder, IDLE_STATE);

  return (
    <form id={formId} action={action}>
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      {couponCode && (
        <input type="hidden" name="couponCode" value={couponCode} />
      )}

      {state.status === "error" && state.message && (
        <div className="mb-4">
          <FormMessage>{state.message}</FormMessage>
        </div>
      )}

      <button
        type="submit"
        disabled={disabled || pending}
        className="rounded-md w-full bg-brand-600 px-8 py-4 text-sm font-medium uppercase tracking-[0.16em] text-cream transition-colors hover:bg-brand-700 active:bg-brand-800 disabled:cursor-not-allowed disabled:bg-brand-600/50"
      >
        {pending ? "Placing order…" : `Place order · ${formatPaise(totalAmount)}`}
      </button>

      {disabled && disabledReason && (
        <p className="mt-2.5 text-center text-xs text-ink-400">
          {disabledReason}
        </p>
      )}

      <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-ink-400">
        <Lock aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        By placing this order you accept our terms and return policy. Your
        address is stored against your account and shared with the seller only
        to fulfil this order.
      </p>
    </form>
  );
}
