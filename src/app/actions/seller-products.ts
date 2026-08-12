"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSellerContext } from "@/lib/seller/context";
import { effectiveRetailPaise } from "@/lib/catalogue/pricing";
import { productSchema } from "@/lib/validations/seller";
import { fieldErrors, type ActionState } from "@/lib/validations/commerce";
import { PRODUCT_STATUS } from "@/lib/constants";
import { slugify } from "@/lib/utils";

/**
 * Seller catalogue writes — SRS §58, §59, §75.
 *
 * Two invariants every path here has to hold:
 *
 * 1. **`priceEffective` is never written by hand.** It is the denormalised
 *    `priceOffer ?? priceRetail` the storefront sorts and range-filters on, so a
 *    write that sets a price without recomputing it silently corrupts listing
 *    order. It goes through `effectiveRetailPaise()`, always.
 *
 * 2. **A seller cannot approve their own product.** `status` is set from a fixed
 *    set here — DRAFT, PENDING or HIDDEN — and `approvedById`/`approvedAt` are
 *    never touched. APPROVED and REJECTED are admin transitions (Phase 6). A
 *    crafted POST carrying `status=APPROVED` cannot get through, because the
 *    field is not read from the form at all.
 */

/** Ownership + approval, resolved once. Actions must not trust a posted id. */
async function requireOwnedProduct(productId: string) {
  const seller = await getSellerContext();
  if (!seller) {
    return { ok: false as const, error: "You must be signed in as a seller." };
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, sellerId: seller.sellerId },
    select: { id: true, status: true, name: true, slug: true },
  });
  if (!product) return { ok: false as const, error: "Product not found." };

  return { ok: true as const, seller, product };
}

/**
 * A slug has to be unique across the whole catalogue because it is the public
 * URL, so a seller naming their product the same as someone else's cannot be
 * rejected — it has to be disambiguated. Suffixes climb until one is free.
 */
async function uniqueSlug(name: string, excludeId?: string): Promise<string> {
  const base = slugify(name) || "product";

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const clash = await prisma.product.findFirst({
      where: { slug: candidate, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      select: { id: true },
    });
    if (!clash) return candidate;
  }

  return `${base}-${Date.now()}`;
}

export async function saveProduct(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const seller = await getSellerContext();
  if (!seller) {
    return { status: "error", message: "You must be signed in as a seller." };
  }

  const parsed = productSchema.safeParse({
    id: formData.get("id") ?? undefined,
    name: formData.get("name"),
    sku: formData.get("sku"),
    description: formData.get("description"),
    categoryId: formData.get("categoryId"),
    brand: formData.get("brand") ?? undefined,
    collection: formData.get("collection") ?? undefined,
    fabric: formData.get("fabric") ?? undefined,
    pattern: formData.get("pattern") ?? undefined,
    occasion: formData.get("occasion") ?? undefined,
    workType: formData.get("workType") ?? undefined,
    color: formData.get("color") ?? undefined,
    weightGrams: formData.get("weightGrams") || undefined,
    priceRetail: formData.get("priceRetail"),
    priceWholesale: formData.get("priceWholesale") ?? undefined,
    priceOffer: formData.get("priceOffer") ?? undefined,
    minOrderQty: formData.get("minOrderQty") || 1,
    maxOrderQty: formData.get("maxOrderQty") || 100,
  });

  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error) };
  }
  const input = parsed.data;

  // The category must be a real leaf. A posted id for a top-level category —
  // or for nothing at all — would make the product unreachable by browsing.
  const category = await prisma.category.findFirst({
    where: { id: input.categoryId, parentId: { not: null } },
    select: { id: true },
  });
  if (!category) {
    return {
      status: "error",
      errors: { categoryId: ["Choose a sub-category."] },
    };
  }

  const skuClash = await prisma.product.findFirst({
    where: {
      sku: input.sku,
      ...(input.id ? { NOT: { id: input.id } } : {}),
    },
    select: { id: true },
  });
  if (skuClash) {
    return { status: "error", errors: { sku: ["That SKU is already in use."] } };
  }

  const priceEffective = effectiveRetailPaise({
    priceRetail: input.priceRetail,
    priceOffer: input.priceOffer,
  });

  const fields = {
    name: input.name,
    sku: input.sku,
    description: input.description,
    categoryId: input.categoryId,
    brand: input.brand,
    collection: input.collection,
    fabric: input.fabric,
    pattern: input.pattern,
    occasion: input.occasion,
    workType: input.workType,
    color: input.color,
    weightGrams: input.weightGrams ?? null,
    priceRetail: input.priceRetail,
    priceWholesale: input.priceWholesale,
    priceOffer: input.priceOffer,
    priceEffective,
    minOrderQty: input.minOrderQty,
    maxOrderQty: input.maxOrderQty,
  };

  // ---- Update -------------------------------------------------------------
  if (input.id) {
    const owned = await requireOwnedProduct(input.id);
    if (!owned.ok) return { status: "error", message: owned.error };

    /**
     * Editing an APPROVED product sends it back for re-approval, because the
     * thing that was approved no longer exists — a seller could otherwise pass
     * review with a modest saree and then rewrite it into something else at the
     * same URL. REJECTED goes back to DRAFT so the seller can resubmit
     * deliberately rather than silently re-entering a queue they were just
     * removed from.
     */
    const nextStatus =
      owned.product.status === PRODUCT_STATUS.APPROVED
        ? PRODUCT_STATUS.PENDING
        : owned.product.status === PRODUCT_STATUS.REJECTED
          ? PRODUCT_STATUS.DRAFT
          : owned.product.status;

    const returnsToQueue = nextStatus !== owned.product.status;

    await prisma.product.update({
      where: { id: input.id },
      data: {
        ...fields,
        slug: await uniqueSlug(input.name, input.id),
        status: nextStatus,
        ...(returnsToQueue
          ? { rejectionReason: null, approvedById: null, approvedAt: null }
          : {}),
      },
    });

    revalidatePath("/seller/products");
    revalidatePath(`/seller/products/${input.id}`);

    return {
      status: "success",
      message:
        owned.product.status === PRODUCT_STATUS.APPROVED
          ? "Saved. Your changes need approval before they go live."
          : "Product saved.",
    };
  }

  // ---- Create -------------------------------------------------------------
  const created = await prisma.product.create({
    data: {
      ...fields,
      sellerId: seller.sellerId,
      slug: await uniqueSlug(input.name),
      // New products start as a draft, never live. Submitting is a separate,
      // deliberate act — see submitProductForApproval.
      status: PRODUCT_STATUS.DRAFT,
      // Every product needs an Inventory row or the storefront cannot report
      // stock and the seller cannot restock it. Created here, at zero.
      inventory: { create: { stockQty: 0, status: "OUT_OF_STOCK" } },
    },
    select: { id: true },
  });

  revalidatePath("/seller/products");

  return {
    status: "success",
    message: "Product created as a draft.",
    productId: created.id,
  };
}

/**
 * DRAFT -> PENDING. The only status change a seller may make towards going
 * live; an admin takes it from PENDING to APPROVED (SRS §75).
 */
export async function submitProductForApproval(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const owned = await requireOwnedProduct(String(formData.get("id") ?? ""));
  if (!owned.ok) return { status: "error", message: owned.error };

  if (
    owned.product.status !== PRODUCT_STATUS.DRAFT &&
    owned.product.status !== PRODUCT_STATUS.REJECTED
  ) {
    return {
      status: "error",
      message: "Only a draft can be submitted for approval.",
    };
  }

  // A product with no image is not reviewable, and would render as a grey box
  // on the storefront if it somehow got approved.
  const imageCount = await prisma.productImage.count({
    where: { productId: owned.product.id },
  });
  if (imageCount === 0) {
    return {
      status: "error",
      message: "Add at least one image before submitting for approval.",
    };
  }

  await prisma.product.update({
    where: { id: owned.product.id },
    data: { status: PRODUCT_STATUS.PENDING, rejectionReason: null },
  });

  revalidatePath("/seller/products");
  revalidatePath(`/seller/products/${owned.product.id}`);

  return { status: "success", message: "Submitted for approval." };
}

/**
 * Hide an approved product, or bring a hidden one back.
 *
 * Hiding is not deleting: order history, reviews and settlements all reference
 * the row, so removing it would orphan them. HIDDEN keeps the product out of the
 * storefront while leaving every reference intact — which is also why there is
 * no seller-facing delete at all.
 */
export async function toggleProductVisibility(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const owned = await requireOwnedProduct(String(formData.get("id") ?? ""));
  if (!owned.ok) return { status: "error", message: owned.error };

  const { status } = owned.product;

  if (status === PRODUCT_STATUS.HIDDEN) {
    /**
     * Coming back from hidden returns to PENDING, not straight to APPROVED.
     * Otherwise "hide, edit, unhide" would be a route around review — the edit
     * path above is careful to re-queue changes, and this must not undo that.
     */
    await prisma.product.update({
      where: { id: owned.product.id },
      data: { status: PRODUCT_STATUS.PENDING },
    });
    revalidatePath("/seller/products");
    revalidatePath(`/seller/products/${owned.product.id}`);
    return {
      status: "success",
      message: "Product sent for approval before going live again.",
    };
  }

  if (status !== PRODUCT_STATUS.APPROVED) {
    return { status: "error", message: "Only a live product can be hidden." };
  }

  await prisma.product.update({
    where: { id: owned.product.id },
    data: { status: PRODUCT_STATUS.HIDDEN },
  });

  revalidatePath("/seller/products");
  revalidatePath(`/seller/products/${owned.product.id}`);

  return { status: "success", message: "Product hidden from the storefront." };
}
