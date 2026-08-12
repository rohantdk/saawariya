"use client";

import { useActionState, useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { submitReview } from "@/app/actions/reviews";
import { IDLE_STATE } from "@/lib/validations/commerce";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input } from "@/components/ui/field";

const RATING_WORDS = [
  "",
  "Poor",
  "Fair",
  "Good",
  "Very good",
  "Excellent",
] as const;

/**
 * Star rating + review text.
 *
 * The stars are real radio inputs with a visually-hidden label each, not
 * clickable icons: keyboard users get arrow-key selection for free, the value
 * posts without JavaScript, and a screen reader announces "3 of 5, Good"
 * instead of five identical unlabelled buttons.
 */
export function ReviewComposer({
  productId,
  productName,
}: {
  productId: string;
  productName: string;
}) {
  const [state, action, pending] = useActionState(submitReview, IDLE_STATE);
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);

  if (state.status === "success") {
    return (
      <FormMessage tone="success">
        {state.message ?? "Thank you for your review."}
      </FormMessage>
    );
  }

  const shown = hovered || rating;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="productId" value={productId} />

      {state.status === "error" && state.message && (
        <FormMessage>{state.message}</FormMessage>
      )}

      <fieldset>
        <legend className="mb-2 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400">
          Your rating
        </legend>

        <div
          className="flex items-center gap-1"
          onMouseLeave={() => setHovered(0)}
        >
          {[1, 2, 3, 4, 5].map((value) => (
            <label
              key={value}
              onMouseEnter={() => setHovered(value)}
              className="cursor-pointer p-0.5"
            >
              <input
                type="radio"
                name="rating"
                value={value}
                checked={rating === value}
                onChange={() => setRating(value)}
                required
                className="sr-only peer"
              />
              <span className="sr-only">
                {value} of 5 — {RATING_WORDS[value]}
              </span>
              <Star
                aria-hidden="true"
                className={cn(
                  "h-6 w-6 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-brand-600",
                  value <= shown
                    ? "fill-gold-500 text-gold-500"
                    : "text-ivory-400",
                )}
              />
            </label>
          ))}

          {shown > 0 && (
            <span className="ml-2 text-xs text-ink-400">
              {RATING_WORDS[shown]}
            </span>
          )}
        </div>

        {state.errors?.rating && (
          <p role="alert" className="mt-1.5 text-xs text-danger">
            {state.errors.rating[0]}
          </p>
        )}
      </fieldset>

      <Field
        label="Headline (optional)"
        htmlFor={`review-title-${productId}`}
        errors={state.errors?.title}
      >
        <Input
          id={`review-title-${productId}`}
          name="title"
          maxLength={90}
          placeholder="Sum it up in a few words"
          invalid={Boolean(state.errors?.title)}
        />
      </Field>

      <Field
        label="Your review"
        htmlFor={`review-body-${productId}`}
        errors={state.errors?.body}
        hint="How was the fabric, the colour, the finish?"
      >
        <textarea
          id={`review-body-${productId}`}
          name="body"
          rows={4}
          required
          minLength={10}
          maxLength={2000}
          aria-label={`Your review of ${productName}`}
          className={cn(
            "w-full border bg-ivory-50 px-4 py-3 text-sm text-ink-900 focus:border-brand-600 focus:outline-none",
            state.errors?.body ? "border-danger" : "border-ivory-400",
          )}
        />
      </Field>

      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Posting…" : "Post review"}
      </Button>
    </form>
  );
}
