"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { CONTROL_BASE, type InputProps } from "@/components/ui/field";

/** A password field with a leading lock glyph and a show/hide toggle. */
export function PasswordInput({ className, invalid, ...props }: InputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400"
      >
        <Lock className="h-4 w-4" />
      </span>
      <input
        type={visible ? "text" : "password"}
        aria-invalid={invalid || undefined}
        className={cn(
          CONTROL_BASE,
          "pl-10 pr-10",
          invalid ? "border-danger" : "border-ivory-400",
          className,
        )}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-400 transition-colors hover:text-ink-900"
      >
        {visible ? (
          <EyeOff aria-hidden="true" className="h-4 w-4" />
        ) : (
          <Eye aria-hidden="true" className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}
