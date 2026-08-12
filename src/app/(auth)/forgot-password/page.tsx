import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export const metadata: Metadata = { title: "Reset password" };

/**
 * Password recovery request — SRS §37.
 *
 * The delivery step (email/SMS OTP) needs a mail or SMS provider, which is out
 * of scope for a local evaluation build; the OtpCode table and verification
 * schema are already in place for it. This page collects the address and always
 * reports the same confirmation whether or not the account exists, so it cannot
 * be used to enumerate registered emails.
 */
export default function ForgotPasswordPage() {
  return (
    <div>
      <p className="eyebrow mb-5">Account recovery</p>
      <h1 className="mb-2 font-display text-4xl">Reset password</h1>
      <p className="mb-8 text-sm text-ink-400">
        Enter your registered email and we will send you a reset link.
      </p>

      <form className="space-y-5">
        <Field label="Email address" htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
          />
        </Field>

        <Button type="submit" size="lg" className="w-full">
          Send reset link
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-ink-400">
        Remembered it?{" "}
        <Link
          href="/login"
          className="text-brand-600 underline underline-offset-4 hover:text-brand-700"
        >
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
