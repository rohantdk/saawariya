import Link from "next/link";
import { getCategoryTree } from "@/lib/catalogue/queries";

/**
 * 404 inside the storefront. Keeps the site chrome (this file sits inside the
 * (storefront) group, so the header and footer still render) and offers real
 * routes out, rather than dropping someone onto a bare error page.
 */
export default async function StorefrontNotFound() {
  const categories = await getCategoryTree();

  return (
    <div className="mx-auto max-w-3xl px-5 py-24 text-center lg:px-8">
      <p className="eyebrow mb-6 justify-center">404</p>
      <h1 className="font-display text-4xl leading-tight">
        We couldn&apos;t find that page
      </h1>
      <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-ink-400">
        The link may be out of date, or the piece may have sold and been
        delisted. Everything currently available is in the catalogue.
      </p>

      <div className="mt-9 flex flex-wrap justify-center gap-3">
        <Link
          href="/shop"
          className="inline-flex h-12 items-center bg-brand-600 px-8 text-xs font-medium uppercase tracking-[0.16em] text-ivory-50 transition-colors hover:bg-brand-700"
        >
          Browse the catalogue
        </Link>
        <Link
          href="/"
          className="inline-flex h-12 items-center border border-ink-900/15 px-8 text-xs font-medium uppercase tracking-[0.16em] text-ink-900 transition-colors hover:border-ink-900/40"
        >
          Back to home
        </Link>
      </div>

      <nav aria-label="Categories" className="mt-14 border-t border-ivory-400 pt-8">
        <p className="mb-4 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400">
          Or start from a category
        </p>
        <ul className="flex flex-wrap justify-center gap-2">
          {categories.map((category) => (
            <li key={category.id}>
              <Link
                href={`/shop/${category.slug}`}
                className="inline-flex border border-ivory-400 bg-ivory-50 px-4 py-2 text-xs text-ink-900 transition-colors hover:border-ink-400 hover:text-brand-600"
              >
                {category.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
