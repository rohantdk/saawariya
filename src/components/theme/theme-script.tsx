import Script from "next/script";
import { THEME_STORAGE_KEY } from "@/components/theme/theme-constants";

/**
 * Applies the stored theme (or the OS preference, on a first visit) before
 * React hydrates. Without this, the page always paints light first and
 * flashes into dark a frame later — `beforeInteractive` is what runs it
 * ahead of hydration rather than after.
 */
export function ThemeScript() {
  const script = `(function(){try{var k="${THEME_STORAGE_KEY}",s=localStorage.getItem(k),d=s?s==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;if(d)document.documentElement.classList.add("dark");}catch(e){}})();`;

  return (
    <Script id="theme-init" strategy="beforeInteractive">
      {script}
    </Script>
  );
}
