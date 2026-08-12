import type { Metadata } from "next";
import Link from "next/link";
import { requireDesk } from "@/lib/admin/context";
import { listCmsPages } from "@/lib/marketing/content";
import { ROLES } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/commerce/status-badge";

export const metadata: Metadata = { title: "Content pages" };

/**
 * The CMS page list — SRS §84.
 *
 * Each row says what links to it, because that is what decides whether a page
 * can be taken down. `getCmsPage` filters on `isPublished`, so unpublishing
 * `return-policy` would 404 the footer link *and* the returns note on every
 * product page — seven dead links from one click, against a rule this build has
 * held since Phase 3.
 */
export default async function ContentPage() {
  await requireDesk(ROLES.MARKETING, "/admin/marketing/content");
  const pages = await listCmsPages();

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6">
        <p className="eyebrow mb-2">SRS §84 — Content pages</p>
        <h1 className="font-display text-3xl">Content pages</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-400">
          The pages behind the footer links. Addresses cannot be changed and
          pages other parts of the site link to cannot be unpublished — either
          would leave a link pointing at a 404.
        </p>
      </header>

      <ul className="space-y-3">
        {pages.map((page) => (
          <li key={page.id} className="border border-ivory-400 bg-ivory-50 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <Link
                  href={`/admin/marketing/content/${page.slug}`}
                  className="text-sm text-ink-900 underline-offset-4 hover:text-brand-600 hover:underline"
                >
                  {page.title}
                </Link>
                <p className="mt-0.5 text-xs text-ink-400">
                  /page/{page.slug} · {page.words} words · updated{" "}
                  {formatDate(page.updatedAt)}
                </p>
                {page.linkedFrom && (
                  <p className="mt-0.5 text-xs text-ink-400">
                    Linked from {page.linkedFrom}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <StatusBadge
                  label={page.isPublished ? "Published" : "Unpublished"}
                  tone={page.isPublished ? "success" : "warning"}
                />
                {page.isPublished && (
                  <Link
                    href={`/page/${page.slug}`}
                    className="text-xs font-medium uppercase tracking-[0.12em] text-ink-500 transition-colors hover:text-brand-600"
                  >
                    View
                  </Link>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
