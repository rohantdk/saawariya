import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * CMS pages — SRS §84.
 *
 * The same seven rows the storefront renders at `/page/[slug]`. Two things about
 * this screen are deliberate:
 *
 * **The slug is not editable after creation.** These pages are linked from the
 * footer, from the login screen and from seeded banner `linkUrl`s; renaming
 * `return-policy` would 404 every one of those links without anything reporting
 * it. Phase 3 already found one dead link left over from Phase 1 and the rule
 * since then has been no dead links — an editable slug is a dead-link generator.
 *
 * **Unpublishing is allowed and it really does take the page down**, because
 * `getCmsPage` filters on `isPublished`. So the screen warns when the page being
 * unpublished is one the footer links to, rather than letting marketing discover
 * it from the storefront.
 */

/**
 * Slugs the rest of the build links to directly. Kept here rather than derived,
 * because a link written into a React component or a seeded banner cannot be
 * discovered by a query.
 */
export const LINKED_CMS_SLUGS: Record<string, string> = {
  "about-us": "Footer",
  "contact-us": "Footer, and the login page’s seller enquiry link",
  "privacy-policy": "Footer",
  "terms-and-conditions": "Footer",
  "shipping-policy": "Footer, and the product page delivery note",
  "return-policy": "Footer, and the product page returns note",
  faq: "Footer",
};

export async function listCmsPages() {
  const pages = await prisma.cmsPage.findMany({
    orderBy: { slug: "asc" },
    select: {
      id: true,
      slug: true,
      title: true,
      isPublished: true,
      metaTitle: true,
      metaDescription: true,
      updatedAt: true,
      bodyHtml: true,
    },
  });

  return pages.map((page) => ({
    ...page,
    // A rough read-time signal is more useful on a list than a byte count: it
    // is what tells you at a glance which page is a stub.
    words: page.bodyHtml.replace(/<[^>]*>/g, " ").trim().split(/\s+/).length,
    linkedFrom: LINKED_CMS_SLUGS[page.slug] ?? null,
  }));
}

export async function findCmsPage(slug: string) {
  const page = await prisma.cmsPage.findUnique({ where: { slug } });
  return page
    ? { ...page, linkedFrom: LINKED_CMS_SLUGS[page.slug] ?? null }
    : null;
}
