import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { viewerTier } from "@/lib/catalogue/pricing";
import { parseFilters } from "@/lib/catalogue/filters";
import {
  getCategoryBySlug,
  getFacetCounts,
  listProducts,
} from "@/lib/catalogue/queries";
import { Breadcrumbs } from "@/components/storefront/breadcrumbs";
import { CatalogueView } from "@/components/storefront/catalogue-view";

export async function generateMetadata(
  props: PageProps<"/shop/[category]/[sub]">,
): Promise<Metadata> {
  const { sub } = await props.params;
  const category = await getCategoryBySlug(sub);
  if (!category) return { title: "Category not found" };

  return {
    title: category.name,
    description:
      category.description ??
      `Shop ${category.name} on Saawariya — handwoven textiles from verified Indian sellers.`,
    alternates: {
      canonical: category.parent
        ? `/shop/${category.parent.slug}/${category.slug}`
        : `/shop/${category.slug}`,
    },
  };
}

/** A leaf category listing — SRS §157. */
export default async function SubCategoryPage(
  props: PageProps<"/shop/[category]/[sub]">,
) {
  const [params, searchParams, user] = await Promise.all([
    props.params,
    props.searchParams,
    getCurrentUser(),
  ]);

  const category = await getCategoryBySlug(params.sub);
  if (!category) notFound();

  // The sub-category exists but is not a child of the parent in the URL. That
  // is a wrong address for a real page, so send the visitor to the right one
  // rather than showing them a 404 for something we can resolve.
  if (!category.parent) redirect(`/shop/${category.slug}`);
  if (category.parent.slug !== params.category) {
    redirect(`/shop/${category.parent.slug}/${category.slug}`);
  }

  const filters = parseFilters(searchParams);
  const scope = { categoryIds: [category.id] };

  const [listing, counts] = await Promise.all([
    listProducts(filters, scope),
    getFacetCounts(filters, scope),
  ]);

  const pathname = `/shop/${category.parent.slug}/${category.slug}`;

  return (
    <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
      <Breadcrumbs
        trail={[
          { href: "/", label: "Home" },
          { href: "/shop", label: "Shop" },
          { href: `/shop/${category.parent.slug}`, label: category.parent.name },
          { label: category.name },
        ]}
      />

      <div className="mb-10 max-w-2xl">
        <p className="eyebrow mb-3">{category.parent.name}</p>
        <h1 className="font-display text-4xl leading-tight">{category.name}</h1>
        {category.description && (
          <p className="mt-3 text-sm leading-relaxed text-ink-400">
            {category.description}
          </p>
        )}
      </div>

      <CatalogueView
        pathname={pathname}
        filters={filters}
        listing={listing}
        counts={counts}
        tier={viewerTier(user)}
        emptyTitle={`Nothing in ${category.name} yet`}
        emptyDescription={`No ${category.name.toLowerCase()} have been approved for sale yet. Browse the rest of ${category.parent.name} in the meantime.`}
      />
    </div>
  );
}
