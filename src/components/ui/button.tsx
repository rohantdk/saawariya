import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-cream hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-600/50",
  // No radius on any variant — BASE carries the one radius for every button.
  secondary:
    "border border-ink-900/15 bg-transparent text-ink-900 hover:border-ink-900/40 hover:bg-ivory-200 disabled:opacity-50",
  ghost:
    "bg-transparent text-ink-900 hover:bg-ivory-300/60 disabled:opacity-50",
  danger:
    "bg-danger text-cream hover:opacity-90 active:opacity-80 disabled:opacity-50",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-4 text-xs tracking-[0.12em]",
  md: "h-11 px-6 text-xs tracking-[0.14em]",
  lg: "h-13 px-8 text-sm tracking-[0.16em]",
};

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium uppercase " +
  "transition-colors duration-200 disabled:cursor-not-allowed select-none";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(BASE, VARIANTS[variant], SIZES[size], className)}
      {...props}
    />
  );
}

export type ButtonLinkProps = React.ComponentProps<typeof Link> & {
  variant?: Variant;
  size?: Size;
};

export function ButtonLink({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={cn(BASE, VARIANTS[variant], SIZES[size], className)}
      {...props}
    />
  );
}
