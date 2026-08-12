import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The gold-ruled eyebrow + display heading pairing used down the homepage and
 * above every product rail. Defined once so the rhythm of the page does not
 * depend on each section remembering the same three utility classes.
 */
export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  align = "left",
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: { href: string; label: string };
  align?: "left" | "center";
  className?: string;
}) {
  const centered = align === "center";

  return (
    <div
      className={cn(
        "mb-8 gap-4",
        centered
          ? "flex flex-col items-center text-center"
          : "flex flex-wrap items-end justify-between",
        className,
      )}
    >
      <div className={cn(centered && "flex flex-col items-center")}>
        {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
        <h2 className="font-display text-3xl leading-tight sm:text-[2rem]">
          {title}
        </h2>
        {description && (
          <p
            className={cn(
              "mt-2.5 text-sm leading-relaxed text-ink-400",
              centered ? "max-w-xl" : "max-w-lg",
            )}
          >
            {description}
          </p>
        )}
      </div>

      {action && (
        <Link
          href={action.href}
          className="inline-flex items-center gap-2 border-b border-gold-400 pb-1 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-900 transition-colors hover:text-brand-600"
        >
          {action.label}
          <span aria-hidden="true">→</span>
        </Link>
      )}
    </div>
  );
}

/**
 * Shown when a query legitimately returns nothing — a sub-category with no
 * approved products yet, or a filter combination that excludes everything.
 * This is a real state in the seeded catalogue (Home Textiles › Bed Linen has
 * products, but none approved), so it renders as a considered page rather than
 * a blank grid or a 404.
 */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="border border-dashed border-ivory-500 bg-ivory-50 px-6 py-16 text-center">
      <h2 className="font-display text-xl text-ink-900">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-400">
        {description}
      </p>
      {action && (
        <Link
          href={action.href}
          className="mt-6 inline-flex items-center gap-2 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-brand-600 hover:text-brand-700"
        >
          {action.label}
          <span aria-hidden="true">→</span>
        </Link>
      )}
    </div>
  );
}
