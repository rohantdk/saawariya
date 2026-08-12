import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Saawariya account.",
};

// Next 16: searchParams is a Promise and must be awaited.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div>
      <p className="eyebrow mb-5">Welcome back</p>
      <h1 className="mb-2 font-display text-4xl">Sign in</h1>
      <p className="mb-8 text-sm text-ink-400">
        Access your orders, wishlist and account.
      </p>

      <LoginForm next={next} />

      <p className="mt-8 text-center text-sm text-ink-400">
        New to Saawariya?{" "}
        <Link
          href="/register"
          className="text-brand-600 underline underline-offset-4 hover:text-brand-700"
        >
          Create an account
        </Link>
      </p>

      {/* Points at the CMS "Seller enquiries" section, which is the real
          answer today. Seller self-onboarding is Phase 5; when that route
          exists this should point there instead. */}
      <p className="mt-4 text-center text-sm text-ink-400">
        Want to sell with us?{" "}
        <Link
          href="/page/contact-us"
          className="text-brand-600 underline underline-offset-4 hover:text-brand-700"
        >
          Seller enquiries
        </Link>
      </p>
    </div>
  );
}
