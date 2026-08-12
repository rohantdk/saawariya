import { SiteHeader } from "@/components/storefront/site-header";
import { SiteFooter } from "@/components/storefront/site-footer";

/**
 * Chrome for every public page — SRS §144, §156.
 *
 * A route group, so `/`, `/shop`, `/product/…`, `/page/…`, `/search` and
 * `/wholesale` all share this header and footer without any of them carrying a
 * `storefront` segment in their URL. The signed-in panels sit outside the group
 * and keep their own shell.
 */
export default function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* First stop for a keyboard user; the header is three bars deep. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:text-ivory-50"
      >
        Skip to content
      </a>

      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
