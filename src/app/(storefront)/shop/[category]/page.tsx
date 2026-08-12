import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { viewerTier } from "@/lib/catalogue/pricing";
import { parseFilters } from "@/lib/catalogue/filters";
import {
  getCategoryBySlug,
  getCategoryProductCounts,
  getFacetCounts,
  listProducts,
} from "@/lib/catalogue/queries";
import { Breadcrumbs } from "@/components/storefront/breadcrumbs";
import { CatalogueView } from "@/components/storefront/catalogue-view";

export async function generateMetadata(
  props: PageProps<"/shop/[category]">,
): Promise<Metadata> {
  const { category: slug } = await props.params;
  const category = await getCategoryBySlug(slug);
  if (!category) return { title: "Category not found" };

  return {
    title: category.name,
    description:
      category.description ??
      `Shop ${category.name} on Saawariya — handwoven textiles from verified Indian sellers.`,
    alternates: { canonical: `/shop/${category.slug}` },
  };
}

/**
 * A top-level category listing, scoped to the category and all of its children
 * — SRS §157. Someone landing on "Sarees" expects every saree, not the handful
 * that happen to be filed directly against the parent.
 */
export default async function CategoryPage(
  props: PageProps<"/shop/[category]">,
) {
  const [{ category: slug }, searchParams, user] = await Promise.all([
    props.params,
    props.searchParams,
    getCurrentUser(),
  ]);

  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  // A sub-category slug reached at the top level has exactly one correct URL.
  // Redirect rather than render, so the page is not reachable at two addresses.
  if (category.parent) {
    redirect(`/shop/${category.parent.slug}/${category.slug}`);
  }

  const filters = parseFilters(searchParams);
  const scope = {
    categoryIds: [category.id, ...category.children.map((child) => child.id)],
  };

  const [listing, counts, productCounts] = await Promise.all([
    listProducts(filters, scope),
    getFacetCounts(filters, scope),
    getCategoryProductCounts(),
  ]);

  const pathname = `/shop/${category.slug}`;

  return (
    <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
      <Breadcrumbs
        trail={[
          { href: "/", label: "Home" },
          { href: "/shop", label: "Shop" },
          { label: category.name },
        ]}
      />

      <div className="mb-8 grid gap-8 lg:grid-cols-[1fr_20rem] lg:items-center">
        <div className="max-w-2xl">
          <p className="eyebrow mb-3">Category</p>
          <h1 className="font-display text-4xl leading-tight">
            {category.name}
          </h1>
          {category.description && (
            <p className="mt-3 text-sm leading-relaxed text-ink-400">
              {category.description}
            </p>
          )}
          {filters.collection && (
            <p className="mt-4 inline-flex items-center gap-2 border border-gold-400 px-3 py-1.5 text-xs text-ink-900">
              Collection: {filters.collection}
              <Link
                href={pathname}
                className="text-brand-600 underline underline-offset-2"
              >
                clear
              </Link>
            </p>
          )}
        </div>

        {category.imageUrl && (
          <div className="relative hidden aspect-[16/9] overflow-hidden bg-ivory-200 lg:block">
            <Image
              src={category.imageUrl}
              alt=""
              fill
              sizes="20rem"
              className="object-cover"
            />
          </div>
        )}
      </div>

      {category.children.length > 0 && (
        <nav aria-label="Sub-categories" className="mb-10">
          <ul className="flex flex-wrap gap-2">
            {category.children.map((child) => (
              <li key={child.id}>
                <Link
                  href={`/shop/${category.slug}/${child.slug}`}
                  className="inline-flex items-center gap-2 border border-ivory-400 bg-ivory-50 px-4 py-2 text-xs text-ink-900 transition-colors hover:border-ink-400 hover:text-brand-600"
                >
                  {child.name}
                  <span className="tabular-nums text-ink-400">
                    {productCounts.get(child.slug) ?? 0}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <CatalogueView
        pathname={pathname}
        filters={filters}
        listing={listing}
        counts={counts}
        tier={viewerTier(user)}
        emptyTitle={`Nothing in ${category.name} yet`}
        emptyDescription="No products in this category have been approved for sale yet. New pieces are added as sellers list them."
      />
    </div>
  );
}
