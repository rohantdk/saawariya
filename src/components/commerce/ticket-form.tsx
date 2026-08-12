"use client";

import { useActionState } from "react";
import { createTicket } from "@/app/actions/support";
import { TICKET_CATEGORY_LABEL } from "@/lib/constants";
import {
  CUSTOMER_TICKET_CATEGORIES,
  IDLE_STATE,
} from "@/lib/validations/commerce";
import { cn, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Select } from "@/components/ui/field";

/**
 * New support request.
 *
 * Only the categories a customer can legitimately raise are offered —
 * PRODUCT_APPROVAL and SETTLEMENT belong to sellers, and putting them in this
 * list would route customer tickets into the wrong queue. The list comes from
 * the same const the server validates against, so the two cannot drift.
 */
export function TicketForm({
  orders,
  defaultOrderNumber,
}: {
  orders: { orderNumber: string; placedAt: string }[];
  defaultOrderNumber: string | null;
}) {
  const [state, action, pending] = useActionState(createTicket, IDLE_STATE);
  const errors = state.errors ?? {};

  return (
    <form action={action} className="space-y-5">
      {state.status === "error" && state.message && (
        <FormMessage>{state.message}</FormMessage>
      )}

      <Field
        label="What is this about?"
        htmlFor="category"
        errors={errors.category}
      >
        <Select
          id="category"
          name="category"
          defaultValue=""
          required
          invalid={Boolean(errors.category)}
        >
          <option value="" disabled>
            Choose a topic
          </option>
          {CUSTOMER_TICKET_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {TICKET_CATEGORY_LABEL[category]}
            </option>
          ))}
        </Select>
      </Field>

      {orders.length > 0 && (
        <Field
          label="Related order (optional)"
          htmlFor="relatedOrderNumber"
          errors={errors.relatedOrderNumber}
        >
          <Select
            id="relatedOrderNumber"
            name="relatedOrderNumber"
            defaultValue={defaultOrderNumber ?? ""}
            invalid={Boolean(errors.relatedOrderNumber)}
          >
            <option value="">Not about a specific order</option>
            {orders.map((order) => (
              <option key={order.orderNumber} value={order.orderNumber}>
                {order.orderNumber} — {formatDate(order.placedAt)}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <Field label="Subject" htmlFor="subject" errors={errors.subject}>
        <Input
          id="subject"
          name="subject"
          maxLength={120}
          required
          placeholder="A one-line summary"
          invalid={Boolean(errors.subject)}
        />
      </Field>

      <Field
        label="Tell us what happened"
        htmlFor="description"
        errors={errors.description}
        hint="Dates, order numbers and anything you have already tried all help."
      >
        <textarea
          id="description"
          name="description"
          rows={6}
          required
          minLength={20}
          maxLength={4000}
          className={cn(
            "w-full border bg-ivory-50 px-4 py-3 text-sm text-ink-900 focus:border-brand-600 focus:outline-none",
            errors.description ? "border-danger" : "border-ivory-400",
          )}
        />
      </Field>

      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send request"}
      </Button>
    </form>
  );
}
