import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCmsPage } from "@/lib/catalogue/queries";
import { formatDate } from "@/lib/utils";
import { Breadcrumbs } from "@/components/storefront/breadcrumbs";

export async function generateMetadata(
  props: PageProps<"/page/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const page = await getCmsPage(slug);
  if (!page) return { title: "Page not found" };

  return {
    title: page.metaTitle ?? page.title,
    description: page.metaDescription ?? undefined,
    alternates: { canonical: `/page/${page.slug}` },
  };
}

/**
 * CMS page — SRS §84, §153.
 *
 * Renders the `bodyHtml` column of a CmsPage row. Every link in the footer
 * resolves to one of these; there is no hardcoded About or FAQ page anywhere in
 * this codebase.
 *
 * On dangerouslySetInnerHTML: this HTML is authored by platform administrators
 * through the admin CMS screen, never by customers or sellers, so it sits on
 * the same side of the trust boundary as the template itself. If the CMS is
 * ever opened to seller-authored content, this needs sanitising first.
 */
export default async function CmsPageRoute(props: PageProps<"/page/[slug]">) {
  const { slug } = await props.params;
  const page = await getCmsPage(slug);
  if (!page) notFound();

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 lg:px-8 lg:py-14">
      <Breadcrumbs
        trail={[{ href: "/", label: "Home" }, { label: page.title }]}
      />

      <header className="mb-10 border-b border-ivory-400 pb-8">
        <h1 className="font-display text-4xl leading-tight">{page.title}</h1>
        <p className="mt-3 text-xs text-ink-400">
          Last updated {formatDate(page.updatedAt)}
        </p>
      </header>

      <div
        className="cms-prose"
        dangerouslySetInnerHTML={{ __html: page.bodyHtml }}
      />
    </div>
  );
}
