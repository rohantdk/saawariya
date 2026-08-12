import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create your Saawariya account to shop retail or wholesale.",
};

export default async function RegisterPage(props: PageProps<"/register">) {
  const { type } = await props.searchParams;
  const isWholesale = type === "wholesale";

  return (
    <div>
      <p className="eyebrow mb-5">Join us</p>
      <h1 className="mb-2 font-display text-4xl">Create account</h1>
      <p className="mb-8 text-sm text-ink-400">
        {isWholesale
          ? "Register a business account to see trade pricing across the catalogue."
          : "Shop handwoven textiles from verified Indian manufacturers."}
      </p>

      <RegisterForm defaultType={isWholesale ? "WHOLESALE" : "RETAIL"} />

      <p className="mt-8 text-center text-sm text-ink-400">
        Already have an account?{" "}
        <Link
          href="/login"
          className="text-brand-600 underline underline-offset-4 hover:text-brand-700"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
