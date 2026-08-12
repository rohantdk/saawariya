"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminAction } from "@/lib/admin/context";
import { AUDIT_ACTIONS, writeAudit } from "@/lib/admin/audit";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  productDecisionSchema,
  productRejectSchema,
  productStatusSchema,
} from "@/lib/validations/admin";
import { fieldErrors, type ActionState } from "@/lib/validations/commerce";
import { PRODUCT_STATUS, SELLER_VERIFICATION } from "@/lib/constants";

/**
 * Product approval — SRS §59, §75. The other half of Phase 5's catalogue.
 *
 * The seller panel already renders `Product.rejectionReason`; this is what
 * writes it. `src/app/actions/seller-products.ts` deliberately never sets
 * APPROVED or REJECTED and never touches `approvedById`/`approvedAt`, so those
 * three fields have exactly one writer — this file.
 *
 * **Approval does not touch price.** `priceEffective` is the denormalised
 * `priceOffer ?? priceRetail` the storefront sorts on, and it is recomputed by
 * whoever changes a price (`effectiveRetailPaise()`). An approver changing
 * status must not recompute it, or an admin action would silently rewrite a
 * derived column from a stale read.
 */

async function loadProduct(productId: string) {
  return prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      sku: true,
      slug: true,
      status: true,
      categoryId: true,
      seller: {
        select: {
          id: true,
          userId: true,
          businessName: true,
          verificationStatus: true,
        },
      },
      category: { select: { slug: true, parent: { select: { slug: true } } } },
    },
  });
}

type LoadedProduct = NonNullable<Awaited<ReturnType<typeof loadProduct>>>;

/**
 * Every storefront surface a product appears on.
 *
 * Its own page, the listing it belongs to and its parent, plus the home page,
 * which carries featured and new-arrival strips. Approving a product that then
 * 404s until something else happens to revalidate is the kind of thing that
 * reads as broken in a demo.
 */
function revalidateProduct(product: LoadedProduct) {
  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${product.id}`);
  revalidatePath("/seller/products");
  revalidatePath(`/seller/products/${product.id}`);
  revalidatePath(`/product/${product.slug}`);
  revalidatePath("/shop");
  revalidatePath("/");
  if (product.category.parent) {
    revalidatePath(`/shop/${product.category.parent.slug}`);
    revalidatePath(
      `/shop/${product.category.parent.slug}/${product.category.slug}`,
    );
  }
}

export async function approveProduct(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireAdminAction(PERMISSIONS.PRODUCT_APPROVE);
  if (!auth.ok) return { status: "error", message: auth.error };

  const parsed = productDecisionSchema.safeParse({
    productId: formData.get("productId"),
    note: formData.get("note") ?? undefined,
  });
  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error) };
  }

  const product = await loadProduct(parsed.data.productId);
  if (!product) return { status: "error", message: "Product not found." };

  if (product.status === PRODUCT_STATUS.APPROVED) {
    return { status: "error", message: "That product is already live." };
  }
  // A draft has not been submitted. Approving one would push a product the
  // seller is still writing onto the storefront under their name.
  if (product.status === PRODUCT_STATUS.DRAFT) {
    return {
      status: "error",
      message: "That product is still a draft — the seller has not submitted it.",
    };
  }

  // A product needs a picture before it can be sold; the seller's submit path
  // enforces the same thing, and an admin approving around it would put a grey
  // box on the storefront.
  const imageCount = await prisma.productImage.count({
    where: { productId: product.id },
  });
  if (imageCount === 0) {
    return {
      status: "error",
      message: "This product has no images. Reject it and ask for photographs.",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: product.id },
      data: {
        status: PRODUCT_STATUS.APPROVED,
        rejectionReason: null,
        approvedById: auth.admin.userId,
        approvedAt: new Date(),
      },
    });

    await tx.notification.create({
      data: {
        userId: product.seller.userId,
        title: "Product approved",
        body: `${product.name} is now live on Saawariya.`,
        category: "PRODUCT",
        linkUrl: `/seller/products/${product.id}`,
      },
    });

    await writeAudit(
      {
        userId: auth.admin.userId,
        action: AUDIT_ACTIONS.PRODUCT_APPROVED,
        entityType: "Product",
        entityId: product.id,
        summary: `${product.name} (${product.sku}) approved for ${product.seller.businessName}`,
        meta: { from: product.status },
      },
      tx,
    );
  });

  revalidateProduct(product);

  // Approval is necessary but not sufficient: the storefront requires an
  // approved seller too. Saying so beats an approver wondering why the product
  // they just published cannot be found.
  const sellerUnverified =
    product.seller.verificationStatus !== SELLER_VERIFICATION.APPROVED;

  return {
    status: "success",
    message: sellerUnverified
      ? `Approved — but ${product.seller.businessName} is not verified, so it stays off the storefront until they are.`
      : "Approved and live on the storefront.",
  };
}

export async function rejectProduct(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireAdminAction(PERMISSIONS.PRODUCT_APPROVE);
  if (!auth.ok) return { status: "error", message: auth.error };

  const parsed = productRejectSchema.safeParse({
    productId: formData.get("productId"),
    note: formData.get("note"),
  });
  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error) };
  }

  const product = await loadProduct(parsed.data.productId);
  if (!product) return { status: "error", message: "Product not found." };

  if (product.status === PRODUCT_STATUS.DRAFT) {
    return {
      status: "error",
      message: "A draft has not been submitted, so there is nothing to reject.",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: product.id },
      data: {
        status: PRODUCT_STATUS.REJECTED,
        rejectionReason: parsed.data.note,
        // Cleared deliberately: a previously approved listing that has been
        // rejected was not approved by anyone any more, and leaving the stamp
        // would credit an admin with a decision that has been reversed.
        approvedById: null,
        approvedAt: null,
      },
    });

    await tx.notification.create({
      data: {
        userId: product.seller.userId,
        title: "Product needs changes",
        body: `${product.name}: ${parsed.data.note}`,
        category: "PRODUCT",
        linkUrl: `/seller/products/${product.id}`,
      },
    });

    await writeAudit(
      {
        userId: auth.admin.userId,
        action: AUDIT_ACTIONS.PRODUCT_REJECTED,
        entityType: "Product",
        entityId: product.id,
        summary: `${product.name} (${product.sku}) rejected — ${parsed.data.note}`,
        meta: { from: product.status, sellerId: product.seller.id },
      },
      tx,
    );
  });

  revalidateProduct(product);

  return {
    status: "success",
    message:
      product.status === PRODUCT_STATUS.APPROVED
        ? "Rejected and withdrawn from the storefront. The seller has been told why."
        : "Rejected. The seller has been told why.",
  };
}

/**
 * Admin hide / restore — SRS §75.
 *
 * Distinct from rejection: hiding is a platform decision about a product that
 * is otherwise fine (a takedown, a seasonal pull), rejection is a verdict on
 * the listing's quality. They read differently to the seller and they leave
 * different fields set, so they are different actions.
 *
 * Restoring goes to APPROVED and not to PENDING, which is the opposite of the
 * seller's own un-hide. The difference is who hid it: a seller un-hiding their
 * own product must re-enter review, or "hide, edit, unhide" is a route around
 * approval. An admin restoring a product they themselves withdrew is undoing
 * their own action, and sending it back to the queue would ask the platform to
 * re-approve a listing it already approved.
 */
export async function setProductVisibility(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireAdminAction(PERMISSIONS.PRODUCT_APPROVE);
  if (!auth.ok) return { status: "error", message: auth.error };

  const parsed = productStatusSchema.safeParse({
    productId: formData.get("productId"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error) };
  }

  const product = await loadProduct(parsed.data.productId);
  if (!product) return { status: "error", message: "Product not found." };

  const hiding = parsed.data.status === PRODUCT_STATUS.HIDDEN;

  if (hiding && product.status !== PRODUCT_STATUS.APPROVED) {
    return { status: "error", message: "Only a live product can be hidden." };
  }
  if (!hiding && product.status !== PRODUCT_STATUS.HIDDEN) {
    return { status: "error", message: "That product is not hidden." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: product.id },
      data: { status: parsed.data.status },
    });

    await tx.notification.create({
      data: {
        userId: product.seller.userId,
        title: hiding ? "Product hidden by Saawariya" : "Product restored",
        body: hiding
          ? `${product.name} has been temporarily withdrawn from the storefront. Contact support if you need detail.`
          : `${product.name} is live on the storefront again.`,
        category: "PRODUCT",
        linkUrl: `/seller/products/${product.id}`,
      },
    });

    await writeAudit(
      {
        userId: auth.admin.userId,
        action: hiding
          ? AUDIT_ACTIONS.PRODUCT_HIDDEN
          : AUDIT_ACTIONS.PRODUCT_RESTORED,
        entityType: "Product",
        entityId: product.id,
        summary: `${product.name} (${product.sku}) ${hiding ? "hidden" : "restored"} by the platform`,
        meta: { sellerId: product.seller.id },
      },
      tx,
    );
  });

  revalidateProduct(product);

  return {
    status: "success",
    message: hiding
      ? "Hidden from the storefront."
      : "Restored to the storefront.",
  };
}
