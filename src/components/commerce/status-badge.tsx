import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/commerce/order-status";

/**
 * A status pill. Tone is passed in rather than derived from the label, because
 * the same word means different things in different modules — "Pending" is
 * neutral on a review and a problem on a payment.
 *
 * Colour is never the only signal: the label always says what the state is, so
 * the badge still reads correctly in monochrome or to a colour-blind viewer
 * (SRS §164).
 */

const TONES: Record<Tone, string> = {
  neutral: "border-ivory-400 bg-ivory-200 text-ink-500",
  info: "border-info/30 bg-info-soft text-info",
  success: "border-success/30 bg-success-soft text-success",
  warning: "border-warning/30 bg-warning-soft text-warning",
  danger: "border-danger/30 bg-danger-soft text-danger",
};

export function StatusBadge({
  label,
  tone = "neutral",
  className,
}: {
  label: string;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap border px-2.5 py-1 text-[0.6875rem] font-medium uppercase tracking-[0.1em]",
        TONES[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}
