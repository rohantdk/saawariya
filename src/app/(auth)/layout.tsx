import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";

/**
 * Shared shell for login / register / password recovery.
 * Split layout: brand panel on the left, form on the right, stacking on mobile.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Brand panel — decorative, hidden from assistive tech on small screens
          where it collapses to a slim header. */}
      <aside className="relative flex shrink-0 flex-col justify-between overflow-hidden bg-brand-900 px-8 py-8 lg:w-[42%] lg:px-14 lg:py-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, #F9F8DC 0 1px, transparent 1px 14px)",
          }}
        />

        <Wordmark surface="dark" showMark={false} className="relative" />

        <div className="relative hidden lg:block">
          <p className="eyebrow mb-6">Est. in tradition</p>
          <p className="max-w-sm font-display text-4xl leading-[1.15] text-cream">
            A saree is not worn.
            <br />
            It is inherited.
          </p>
          <p className="mt-6 max-w-sm text-sm leading-relaxed text-cream/60">
            India&apos;s premium textile marketplace, connecting verified
            manufacturers with retail and wholesale buyers.
          </p>
        </div>

        <p className="relative hidden text-xs text-cream/40 lg:block">
          © {new Date().getFullYear()} Saawariya
        </p>
      </aside>

      {/* Form panel */}
      <main className="flex flex-1 items-center justify-center px-6 py-12 lg:px-14">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}

export function AuthFooterLink({
  prompt,
  href,
  label,
}: {
  prompt: string;
  href: string;
  label: string;
}) {
  return (
    <p className="mt-8 text-center text-sm text-ink-400">
      {prompt}{" "}
      <Link
        href={href}
        className="text-brand-600 underline underline-offset-4 hover:text-brand-700"
      >
        {label}
      </Link>
    </p>
  );
}
