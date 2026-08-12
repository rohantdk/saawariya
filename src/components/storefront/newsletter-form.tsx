"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  subscribeToNewsletter,
  type SubscribeState,
} from "@/app/actions/newsletter";

const INITIAL: SubscribeState = { status: "idle" };

export function NewsletterForm() {
  const [state, formAction] = useActionState(subscribeToNewsletter, INITIAL);

  return (
    <div className="w-full max-w-md">
      <form action={formAction} className="flex gap-0">
        <label htmlFor="newsletter-email" className="sr-only">
          Email address
        </label>
        <input
          id="newsletter-email"
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="your@email.com"
          aria-describedby={state.status === "idle" ? undefined : "newsletter-status"}
          className="h-12 min-w-0 flex-1 border border-ivory-100/25 bg-transparent px-4 text-sm text-ivory-50 placeholder:text-ivory-100/40 focus:border-gold-400 focus:outline-none"
        />
        <SubmitButton />
      </form>

      {state.status !== "idle" && (
        <p
          id="newsletter-status"
          role="status"
          className={
            state.status === "success"
              ? "mt-3 text-xs text-gold-300"
              : "mt-3 text-xs text-brand-300"
          }
        >
          {state.message}
        </p>
      )}
    </div>
  );
}

/**
 * useFormStatus must be read from a child of the <form>, not the component
 * that owns the action — that is the whole reason this is a separate component.
 */
function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="h-12 shrink-0 bg-gold-400 px-6 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-900 transition-colors hover:bg-gold-300 disabled:opacity-60"
    >
      {pending ? "Signing up…" : "Sign up"}
    </button>
  );
}
