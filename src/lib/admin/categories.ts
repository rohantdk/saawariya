import "server-only";
import { prisma } from "@/lib/prisma";
import { PRODUCT_STATUS } from "@/lib/constants";

/**
 * Category administration — SRS §76.
 *
 * The hierarchy is exactly two levels deep, and that is a routing constraint
 * rather than a preference: the storefront addresses categories as
 * `/shop/[category]` and `/shop/[category]/[sub]`, so a third level would have
 * no URL. `saveCategory` enforces it; this module only reads.
 *
 * Every row carries **two** product counts — everything filed under it, and the
 * subset that is live. An admin deciding whether a category can be retired
 * needs the first; an admin wondering why a storefront page looks empty needs
 * the second, and one number cannot answer both.
 */

export type CategoryTreeNode = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
  liveCount: number;
  children: CategoryTreeNode[];
};

export async function getCategoryAdminTree(): Promise<CategoryTreeNode[]> {
  const [categories, totals, live] = await Promise.all([
    prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        imageUrl: true,
        sortOrder: true,
        isActive: true,
        parentId: true,
      },
    }),
    prisma.product.groupBy({ by: ["categoryId"], _count: { _all: true } }),
    prisma.product.groupBy({
      by: ["categoryId"],
      where: { status: PRODUCT_STATUS.APPROVED },
      _count: { _all: true },
    }),
  ]);

  const totalBy = new Map(totals.map((r) => [r.categoryId, r._count._all]));
  const liveBy = new Map(live.map((r) => [r.categoryId, r._count._all]));

  const nodes = new Map<string, CategoryTreeNode>();
  for (const category of categories) {
    nodes.set(category.id, {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      imageUrl: category.imageUrl,
      sortOrder: category.sortOrder,
      isActive: category.isActive,
      productCount: totalBy.get(category.id) ?? 0,
      liveCount: liveBy.get(category.id) ?? 0,
      children: [],
    });
  }

  const roots: CategoryTreeNode[] = [];
  for (const category of categories) {
    const node = nodes.get(category.id)!;
    if (category.parentId) {
      // A child whose parent was deleted would otherwise vanish from the
      // screen entirely while still existing in the database.
      const parent = nodes.get(category.parentId);
      if (parent) parent.children.push(node);
      else roots.push(node);
    } else {
      roots.push(node);
    }
  }

  // A parent's totals include its children's, so "Sarees — 18 products" means
  // what a reader expects rather than "18 filed directly under Sarees", which
  // is always zero because products hang off leaves.
  for (const root of roots) {
    root.productCount += root.children.reduce(
      (sum, child) => sum + child.productCount,
      0,
    );
    root.liveCount += root.children.reduce(
      (sum, child) => sum + child.liveCount,
      0,
    );
  }

  return roots;
}

/** Top-level categories, for the parent picker. */
export async function listParentCategories() {
  return prisma.category.findMany({
    where: { parentId: null },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true },
  });
}
