"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import { login } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input, FormMessage } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(login, undefined);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {next && <input type="hidden" name="next" value={next} />}

      {state?.message && <FormMessage tone="error">{state.message}</FormMessage>}

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
        label="Password"
        htmlFor="password"
        errors={state?.errors?.password}
      >
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          placeholder="••••••••"
          required
          invalid={Boolean(state?.errors?.password)}
        />
      </Field>

      <div className="flex justify-end">
        <Link
          href="/forgot-password"
          className="text-xs text-ink-400 underline underline-offset-4 hover:text-brand-600"
        >
          Forgot password?
        </Link>
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
