import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * A headline figure. Shared by the seller dashboard, reports and settlements
 * and by the admin console rather than redefined per page, because three
 * slightly different stat tiles is how a panel starts looking like three
 * different products.
 *
 * `href` is optional: a tile that leads somewhere is a link, a tile that is
 * purely informational is a plain block. It is deliberately not a link with a
 * `#` href — a control that goes nowhere is worse than no control.
 */
export function StatTile({
  href,
  icon,
  value,
  label,
  hint,
  tone = "default",
}: {
  href?: string;
  icon?: React.ReactNode;
  value: number | string;
  label: string;
  hint?: string;
  tone?: "default" | "attention";
}) {
  const body = (
    <>
      {icon && (
        <span
          aria-hidden="true"
          className={cn(
            tone === "attention" ? "text-brand-600" : "text-ink-400",
          )}
        >
          {icon}
        </span>
      )}
      <p className="mt-3 font-display text-2xl text-ink-900">{value}</p>
      <p className="mt-0.5 text-xs text-ink-400">{label}</p>
      {hint && <p className="mt-1 text-[0.6875rem] text-ink-400/80">{hint}</p>}
    </>
  );

  const className = cn(
    "block border bg-ivory-50 p-4",
    tone === "attention" ? "border-brand-600/40" : "border-ivory-400",
    href && "transition-colors hover:border-ink-400",
  );

  if (!href) return <div className={className}>{body}</div>;

  return (
    <Link href={href} className={className}>
      {body}
    </Link>
  );
}
