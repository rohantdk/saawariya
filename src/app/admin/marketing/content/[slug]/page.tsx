import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireDesk } from "@/lib/admin/context";
import { findCmsPage } from "@/lib/marketing/content";
import { ROLES } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import { CmsPageForm } from "@/components/marketing/cms-form";

export const metadata: Metadata = { title: "Edit page" };

export default async function ContentEditPage({
  params,
}: PageProps<"/admin/marketing/content/[slug]">) {
  await requireDesk(ROLES.MARKETING, "/admin/marketing/content");
  const { slug } = await params;

  const page = await findCmsPage(slug);
  if (!page) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/admin/marketing/content"
        className="mb-4 inline-block text-xs font-medium uppercase tracking-[0.14em] text-ink-500 transition-colors hover:text-brand-600"
      >
        ← All content pages
      </Link>

      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow mb-2">/page/{page.slug}</p>
          <h1 className="font-display text-3xl">{page.title}</h1>
        </div>
        {page.isPublished && (
          <Link
            href={`/page/${page.slug}`}
            className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500 transition-colors hover:text-brand-600"
          >
            View on the storefront →
          </Link>
        )}
      </header>

      <CmsPageForm page={page} />

      <p className="mt-6 text-xs text-ink-400">
        Last updated {formatDateTime(page.updatedAt)}.
      </p>
    </div>
  );
}
