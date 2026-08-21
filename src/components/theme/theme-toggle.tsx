"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getThemeServerSnapshot,
  getThemeSnapshot,
  setTheme,
  subscribeTheme,
} from "@/components/theme/theme-store";

/**
 * Light/dark toggle. `useSyncExternalStore` reads the `dark` class that
 * `ThemeScript` already applied before paint — server and the pre-hydration
 * client both see "light" (`getThemeServerSnapshot`), so there is no
 * hydration mismatch, and React corrects to the real value itself right
 * after mount.
 */
export function ThemeToggle({
  surface = "dark",
  className,
}: {
  /** "dark" = sitting on the wine header; "light" = sitting on an ivory panel bar. */
  surface?: "dark" | "light";
  className?: string;
}) {
  const isDark = useSyncExternalStore(
    subscribeTheme,
    getThemeSnapshot,
    getThemeServerSnapshot,
  );

  return (
    <button
      type="button"
      onClick={() => setTheme(!isDark)}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={isDark}
      className={cn(
        "inline-flex items-center justify-center p-1 transition-colors",
        surface === "dark"
          ? "text-cream/85 hover:text-gold-300"
          : "text-ink-400 hover:text-brand-600",
        className,
      )}
    >
      {isDark ? (
        <Sun aria-hidden="true" className="h-[1.15rem] w-[1.15rem]" />
      ) : (
        <Moon aria-hidden="true" className="h-[1.15rem] w-[1.15rem]" />
      )}
    </button>
  );
}
