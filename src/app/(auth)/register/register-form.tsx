"use client";

import { useActionState, useState } from "react";
import { Briefcase, Mail, Phone, ShoppingBag, User } from "lucide-react";
import { register } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input, FormMessage } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { cn } from "@/lib/utils";

/**
 * Retail and wholesale buyers register through the same form (SRS §16.3, §36).
 * Choosing Wholesale reveals the GST field, which the server then requires —
 * the client only controls visibility, the schema controls validity.
 */
export function RegisterForm({
  defaultType = "RETAIL",
}: {
  /** Preselected by /register?type=wholesale, which the wholesale page links to. */
  defaultType?: "RETAIL" | "WHOLESALE";
}) {
  const [state, formAction, pending] = useActionState(register, undefined);
  const [customerType, setCustomerType] = useState<"RETAIL" | "WHOLESALE">(
    defaultType,
  );

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state?.message && <FormMessage tone="error">{state.message}</FormMessage>}

      <fieldset>
        <legend className="mb-2 block text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400">
          Account type
        </legend>
        <div className="grid grid-cols-2 gap-3">
          {(["RETAIL", "WHOLESALE"] as const).map((type) => {
            const Icon = type === "RETAIL" ? ShoppingBag : Briefcase;
            return (
              <label
                key={type}
                className={cn(
                  "cursor-pointer border px-4 py-4 text-center transition-colors",
                  customerType === type
                    ? "border-brand-600 bg-brand-50"
                    : "border-ivory-400 bg-ivory-50 hover:border-ink-900/30",
                )}
              >
                <input
                  type="radio"
                  name="customerType"
                  value={type}
                  checked={customerType === type}
                  onChange={() => setCustomerType(type)}
                  className="sr-only"
                />
                <Icon
                  aria-hidden="true"
                  className={cn(
                    "mx-auto h-5 w-5",
                    customerType === type ? "text-brand-600" : "text-ink-400",
                  )}
                />
                <span className="mt-2 block text-sm font-medium text-ink-900">
                  {type === "RETAIL" ? "Retail" : "Wholesale"}
                </span>
                <span className="mt-0.5 block text-xs text-ink-400">
                  {type === "RETAIL" ? "Personal shopping" : "Business buying"}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <Field
        label="Full name"
        htmlFor="fullName"
        errors={state?.errors?.fullName}
      >
        <Input
          id="fullName"
          name="fullName"
          autoComplete="name"
          placeholder="Rahul Sharma"
          required
          icon={<User className="h-4 w-4" />}
          invalid={Boolean(state?.errors?.fullName)}
        />
      </Field>

      <Field label="Email address" htmlFor="email" errors={state?.errors?.email}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          icon={<Mail className="h-4 w-4" />}
          invalid={Boolean(state?.errors?.email)}
        />
      </Field>

      <Field
        label="Mobile number"
        htmlFor="mobile"
        errors={state?.errors?.mobile}
        hint="10-digit Indian mobile number"
      >
        <Input
          id="mobile"
          name="mobile"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="9876543210"
          maxLength={10}
          required
          icon={<Phone className="h-4 w-4" />}
          invalid={Boolean(state?.errors?.mobile)}
        />
      </Field>

      {customerType === "WHOLESALE" && (
        <Field
          label="GST number"
          htmlFor="gstNumber"
          errors={state?.errors?.gstNumber}
          hint="Required for wholesale pricing"
        >
          <Input
            id="gstNumber"
            name="gstNumber"
            placeholder="27AAPFU0939F1ZV"
            invalid={Boolean(state?.errors?.gstNumber)}
          />
        </Field>
      )}

      <Field
        label="Password"
        htmlFor="password"
        errors={state?.errors?.password}
        hint="At least 8 characters, with a letter and a number"
      >
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          placeholder="••••••••"
          required
          invalid={Boolean(state?.errors?.password)}
        />
      </Field>

      <Field
        label="Confirm password"
        htmlFor="confirmPassword"
        errors={state?.errors?.confirmPassword}
      >
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          placeholder="••••••••"
          required
          invalid={Boolean(state?.errors?.confirmPassword)}
        />
      </Field>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
