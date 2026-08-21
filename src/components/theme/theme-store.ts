"use client";

import { THEME_STORAGE_KEY } from "@/components/theme/theme-constants";

type Listener = () => void;
const listeners = new Set<Listener>();

/**
 * A minimal external store over `document.documentElement`'s `dark` class.
 * `useSyncExternalStore` is what lets `ThemeToggle` read this DOM state
 * without a `setState`-in-`useEffect` cascade: React re-checks the snapshot
 * itself right after hydration, and only re-renders subscribers when
 * `setTheme` actually calls a listener.
 */
export function subscribeTheme(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getThemeSnapshot(): boolean {
  return document.documentElement.classList.contains("dark");
}

/** The server (and the pre-hydration client) always renders light — the
 * blocking script in `theme-script.tsx` is what applies a stored dark
 * preference before paint, so this only has to match that starting point. */
export function getThemeServerSnapshot(): boolean {
  return false;
}

export function setTheme(isDark: boolean): void {
  document.documentElement.classList.toggle("dark", isDark);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, isDark ? "dark" : "light");
  } catch {
    // Private browsing can throw on localStorage writes; the toggle still
    // works for the rest of the session, it just won't be remembered.
  }
  listeners.forEach((listener) => listener());
}
