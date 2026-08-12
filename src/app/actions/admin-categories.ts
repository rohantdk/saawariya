"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminAction } from "@/lib/admin/context";
import { AUDIT_ACTIONS, writeAudit } from "@/lib/admin/audit";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { categoryRefSchema, categorySchema } from "@/lib/validations/admin";
import { fieldErrors, type ActionState } from "@/lib/validations/commerce";
import { slugify } from "@/lib/utils";

/**
 * Category management — SRS §76.
 *
 * Three rules, all of them structural rather than stylistic:
 *
 * 1. **The tree is exactly two levels deep.** The storefront routes are
 *    `/shop/[category]` and `/shop/[category]/[sub]`; a third level would be a
 *    category with no URL, reachable from nothing. So a category with children
 *    cannot be given a parent, and a category whose parent has a parent is
 *    refused.
 *
 * 2. **The slug is the public URL.** It has to be unique across the whole tree
 *    and it must not silently change under a live category, because the change
 *    breaks every link anyone has to it. It is derived from the name on
 *    creation and only changed when someone types a new one.
 *
 * 3. **Deleting is refused whenever anything points at the row.** Products and
 *    child categories both do. `Category.parentId` is `onDelete: SetNull`, so a
 *    delete would silently promote every child to a top-level category — a
 *    quiet restructure of the storefront navigation is not what "delete" should
 *    mean.
 */

function revalidateCategories() {
  revalidatePath("/admin/categories");
  // The tree drives the header mega-menu on every storefront page, plus the
  // homepage grid and the shop index.
  revalidatePath("/", "layout");
}

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const root = slugify(base) || "category";

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? root : `${root}-${attempt + 1}`;
    const clash = await prisma.category.findFirst({
      where: {
        slug: candidate,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (!clash) return candidate;
  }

  return `${root}-${Date.now()}`;
}

export async function saveCategory(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireAdminAction(PERMISSIONS.CATEGORY_MANAGE);
  if (!auth.ok) return { status: "error", message: auth.error };

  const parsed = categorySchema.safeParse({
    id: formData.get("id") ?? undefined,
    name: formData.get("name"),
    slug: formData.get("slug") ?? undefined,
    description: formData.get("description") ?? undefined,
    imageUrl: formData.get("imageUrl") ?? undefined,
    parentId: formData.get("parentId") ?? undefined,
    sortOrder: formData.get("sortOrder") || 0,
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error) };
  }
  const input = parsed.data;

  // ---- Depth ---------------------------------------------------------------
  if (input.parentId) {
    const parent = await prisma.category.findUnique({
      where: { id: input.parentId },
      select: { id: true, parentId: true, name: true },
    });
    if (!parent) {
      return { status: "error", errors: { parentId: ["That parent no longer exists."] } };
    }
    if (parent.parentId) {
      return {
        status: "error",
        errors: {
          parentId: [
            `${parent.name} is already a sub-category — the storefront only addresses two levels.`,
          ],
        },
      };
    }
    if (input.id && parent.id === input.id) {
      return {
        status: "error",
        errors: { parentId: ["A category cannot be its own parent."] },
      };
    }
  }

  const existing = input.id
    ? await prisma.category.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          name: true,
          slug: true,
          parentId: true,
          isActive: true,
          _count: { select: { children: true, products: true } },
        },
      })
    : null;

  if (input.id && !existing) {
    return { status: "error", message: "Category not found." };
  }

  if (existing && input.parentId && existing._count.children > 0) {
    return {
      status: "error",
      errors: {
        parentId: [
          `${existing.name} has ${existing._count.children} sub-categories, so it cannot itself become one.`,
        ],
      },
    };
  }

  const fields = {
    name: input.name,
    description: input.description || null,
    imageUrl: input.imageUrl || null,
    parentId: input.parentId,
    sortOrder: input.sortOrder ?? 0,
    isActive: input.isActive ?? true,
  };

  // ---- Update --------------------------------------------------------------
  if (existing) {
    // A typed slug is honoured (and de-duplicated); a blank one leaves the
    // existing URL alone rather than silently rewriting it from the name.
    const slug = input.slug
      ? await uniqueSlug(input.slug, existing.id)
      : existing.slug;

    await prisma.$transaction(async (tx) => {
      await tx.category.update({
        where: { id: existing.id },
        data: { ...fields, slug },
      });

      await writeAudit(
        {
          userId: auth.admin.userId,
          action: AUDIT_ACTIONS.CATEGORY_UPDATED,
          entityType: "Category",
          entityId: existing.id,
          summary: `Category ${input.name} updated${
            slug !== existing.slug ? ` (slug ${existing.slug} → ${slug})` : ""
          }`,
          meta: { from: { slug: existing.slug, isActive: existing.isActive } },
        },
        tx,
      );
    });

    revalidateCategories();
    return {
      status: "success",
      message:
        slug !== existing.slug
          ? `Saved. The public URL is now /shop/${slug}.`
          : "Category saved.",
    };
  }

  // ---- Create --------------------------------------------------------------
  const slug = await uniqueSlug(input.slug || input.name);

  await prisma.$transaction(async (tx) => {
    const category = await tx.category.create({
      data: { ...fields, slug },
      select: { id: true },
    });

    await writeAudit(
      {
        userId: auth.admin.userId,
        action: AUDIT_ACTIONS.CATEGORY_CREATED,
        entityType: "Category",
        entityId: category.id,
        summary: `Category ${input.name} created at /shop/${slug}`,
      },
      tx,
    );
  });

  revalidateCategories();
  return {
    status: "success",
    message: `Created at /shop/${slug}. It appears on the storefront once it has live products.`,
  };
}

export async function deleteCategory(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireAdminAction(PERMISSIONS.CATEGORY_MANAGE);
  if (!auth.ok) return { status: "error", message: auth.error };

  const parsed = categoryRefSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error) };
  }

  const category = await prisma.category.findUnique({
    where: { id: parsed.data.id },
    select: {
      id: true,
      name: true,
      slug: true,
      _count: { select: { children: true, products: true } },
    },
  });
  if (!category) return { status: "error", message: "Category not found." };

  if (category._count.products > 0) {
    return {
      status: "error",
      message: `${category.name} holds ${category._count.products} product${
        category._count.products === 1 ? "" : "s"
      }. Move them first, or deactivate the category instead.`,
    };
  }

  if (category._count.children > 0) {
    return {
      status: "error",
      message: `${category.name} has ${category._count.children} sub-categories. Deleting it would promote them to the top level rather than remove them.`,
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.category.delete({ where: { id: category.id } });

    await writeAudit(
      {
        userId: auth.admin.userId,
        action: AUDIT_ACTIONS.CATEGORY_DELETED,
        entityType: "Category",
        entityId: category.id,
        summary: `Category ${category.name} (/shop/${category.slug}) deleted`,
      },
      tx,
    );
  });

  revalidateCategories();
  return { status: "success", message: `${category.name} deleted.` };
}

/**
 * Show or hide a category.
 *
 * Deactivating removes it from the mega-menu and from browsing — the storefront
 * category queries all filter `isActive` — but it does **not** unpublish the
 * products filed under it. Those stay reachable at their own URLs and in
 * search, because a product's visibility is its own status, and hiding a shelf
 * is not the same as withdrawing the goods on it. The screen says so.
 */
export async function toggleCategoryActive(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireAdminAction(PERMISSIONS.CATEGORY_MANAGE);
  if (!auth.ok) return { status: "error", message: auth.error };

  const parsed = categoryRefSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error) };
  }

  const category = await prisma.category.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, name: true, isActive: true, parentId: true },
  });
  if (!category) return { status: "error", message: "Category not found." };

  const nextActive = !category.isActive;

  await prisma.$transaction(async (tx) => {
    await tx.category.update({
      where: { id: category.id },
      data: { isActive: nextActive },
    });

    await writeAudit(
      {
        userId: auth.admin.userId,
        action: AUDIT_ACTIONS.CATEGORY_UPDATED,
        entityType: "Category",
        entityId: category.id,
        summary: `Category ${category.name} ${nextActive ? "shown on" : "hidden from"} the storefront`,
      },
      tx,
    );
  });

  revalidateCategories();

  return {
    status: "success",
    message: nextActive
      ? `${category.name} is visible again.`
      : category.parentId
        ? `${category.name} is hidden from browsing. Its products keep their own pages.`
        : `${category.name} and its sub-categories are hidden from browsing. Products keep their own pages.`,
  };
}
