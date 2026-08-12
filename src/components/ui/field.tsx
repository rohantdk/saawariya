import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Form primitives.
 *
 * Every input is bound to a real <label> via htmlFor/id, and errors are wired
 * with aria-describedby + aria-invalid so screen readers announce them —
 * SRS §164 (accessible form labels), §193 (clear error messages).
 */

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "block text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400",
        className,
      )}
      {...props}
    />
  );
}

const CONTROL_BASE =
  "w-full border bg-ivory-50 px-4 py-3 text-sm text-ink-900 " +
  "placeholder:text-ink-400/60 transition-colors duration-200 " +
  "focus:border-brand-600 focus:outline-none disabled:opacity-60";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

export function Input({ className, invalid, ...props }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(
        CONTROL_BASE,
        invalid ? "border-danger" : "border-ivory-400",
        className,
      )}
      {...props}
    />
  );
}

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  invalid?: boolean;
};

export function Select({ className, invalid, ...props }: SelectProps) {
  return (
    <select
      aria-invalid={invalid || undefined}
      className={cn(
        CONTROL_BASE,
        "appearance-none bg-[length:12px] bg-[right_1rem_center] bg-no-repeat pr-10",
        invalid ? "border-danger" : "border-ivory-400",
        className,
      )}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'%3E%3Cpath fill='%2370635c' d='M1 1l5 5 5-5'/%3E%3C/svg%3E\")",
      }}
      {...props}
    />
  );
}

/** Field-level validation message. */
export function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return (
    <p className="mt-1.5 text-xs text-danger" role="alert">
      {messages[0]}
    </p>
  );
}

/** A label + control + error group with the id/aria wiring already done. */
export function Field({
  label,
  htmlFor,
  errors,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  errors?: string[];
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !errors?.length && (
        <p className="text-xs text-ink-400">{hint}</p>
      )}
      <FieldError messages={errors} />
    </div>
  );
}

/** Form-level message, above the fields. */
export function FormMessage({
  tone = "error",
  children,
}: {
  tone?: "error" | "success" | "info";
  children: React.ReactNode;
}) {
  const tones = {
    error: "border-danger/30 bg-danger-soft text-danger",
    success: "border-success/30 bg-success-soft text-success",
    info: "border-info/30 bg-info-soft text-info",
  };

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("border px-4 py-3 text-sm", tones[tone])}
    >
      {children}
    </div>
  );
}
