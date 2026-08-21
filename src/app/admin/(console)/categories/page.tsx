import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/context";
import {
  getCategoryAdminTree,
  listParentCategories,
} from "@/lib/admin/categories";
import { CategoryManager } from "@/components/admin/category-manager";

export const metadata: Metadata = { title: "Categories" };

/**
 * The category hierarchy — SRS §76.
 *
 * This tree is the storefront's navigation: it drives the header mega-menu, the
 * homepage grid, the `/shop` index and the `/shop/[category]/[sub]` routes. So
 * the page says what each control actually does to the public site, rather than
 * leaving an admin to discover that hiding a category does not unpublish the
 * products under it.
 */
export default async function AdminCategoriesPage() {
  await requireAdmin("/admin/categories");

  const [tree, parents] = await Promise.all([
    getCategoryAdminTree(),
    listParentCategories(),
  ]);

  const total = tree.reduce((sum, node) => sum + 1 + node.children.length, 0);

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6">
        <p className="eyebrow mb-2">Category management</p>
        <h1 className="font-display text-3xl">Categories</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-400">
          {total} categories across two levels — the depth the storefront routes
          address. Hiding a category removes it from the menu and from browsing;
          the products filed under it keep their own pages until their own
          status changes.
        </p>
      </header>

      <CategoryManager tree={tree} parents={parents} />
    </div>
  );
}
