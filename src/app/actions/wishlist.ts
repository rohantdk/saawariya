"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCustomerContext } from "@/lib/commerce/context";
import { availableFor } from "@/lib/commerce/cart";
import { resolvePrice } from "@/lib/catalogue/pricing";
import { PUBLIC_PRODUCT_WHERE } from "@/lib/catalogue/queries";
import {
  fieldErrors,
  productRefSchema,
  type ActionState,
} from "@/lib/validations/commerce";

/**
 * Wishlist mutations — SRS §41.
 *
 * A wishlist row is only a pointer at a product, so there is far less to get
 * wrong here than in the cart — with one exception: moving an item into the bag
 * has to pass every check `addToCart` applies, because a product can be
 * wishlisted for months and be delisted, sold out or re-priced in between.
 */

function signedOut(): ActionState {
  return { status: "error", message: "Sign in to save items." };
}

/** Add if absent, remove if present. One control, one obvious behaviour. */
export async function toggleWishlist(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getCustomerContext();
  if (!context) return signedOut();

  const parsed = productRefSchema.safeParse({
    productId: formData.get("productId"),
  });
  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error) };
  }

  const product = await prisma.product.findFirst({
    where: { id: parsed.data.productId, ...PUBLIC_PRODUCT_WHERE },
    select: { id: true, name: true },
  });
  if (!product) {
    return { status: "error", message: "That product is no longer available." };
  }

  const existing = await prisma.wishlistItem.findUnique({
    where: {
      customerId_productId: {
        customerId: context.customerId,
        productId: product.id,
      },
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.wishlistItem.delete({ where: { id: existing.id } });
    revalidateBag();
    return {
      status: "success",
      saved: false,
      message: `${product.name} removed from your wishlist.`,
    };
  }

  await prisma.wishlistItem.create({
    data: { customerId: context.customerId, productId: product.id },
  });

  revalidateBag();
  return {
    status: "success",
    saved: true,
    message: `${product.name} saved to your wishlist.`,
  };
}

export async function removeWishlistItem(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getCustomerContext();
  if (!context) return signedOut();

  const parsed = productRefSchema.safeParse({
    productId: formData.get("productId"),
  });
  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error) };
  }

  await prisma.wishlistItem.deleteMany({
    where: { customerId: context.customerId, productId: parsed.data.productId },
  });

  revalidateBag();
  return { status: "success", message: "Removed from your wishlist." };
}

/**
 * Wishlist → bag.
 *
 * Products with variants are deliberately NOT moved here: the customer has not
 * chosen a length or a size, and guessing one on their behalf puts the wrong
 * item in a real order. Those send them to the product page instead.
 */
export async function moveWishlistItemToCart(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getCustomerContext();
  if (!context) return signedOut();

  const parsed = productRefSchema.safeParse({
    productId: formData.get("productId"),
  });
  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error) };
  }

  const product = await prisma.product.findFirst({
    where: { id: parsed.data.productId, ...PUBLIC_PRODUCT_WHERE },
    select: {
      id: true,
      name: true,
      slug: true,
      priceRetail: true,
      priceOffer: true,
      priceWholesale: true,
      minOrderQty: true,
      maxOrderQty: true,
      variants: { select: { id: true } },
      inventory: { select: { stockQty: true, reservedQty: true } },
    },
  });

  if (!product) {
    return { status: "error", message: "That product is no longer available." };
  }

  if (product.variants.length > 0) {
    return {
      status: "error",
      message: `${product.name} has options to choose from — open the product to pick one.`,
    };
  }

  const available = availableFor(product.inventory, null);
  if (available <= 0) {
    return { status: "error", message: `${product.name} is out of stock.` };
  }

  const price = resolvePrice(product, context.tier);
  const quantity = Math.min(
    Math.max(1, price.minOrderQty),
    available,
    product.maxOrderQty,
  );

  if (quantity < price.minOrderQty) {
    return {
      status: "error",
      message: `Only ${available} left, below the minimum order of ${price.minOrderQty}.`,
    };
  }

  await prisma.$transaction([
    prisma.cartItem.upsert({
      where: {
        customerId_productId_variantId: {
          customerId: context.customerId,
          productId: product.id,
          // Only variant-less products reach here — see the guard above.
          variantId: "",
        },
      },
      update: { quantity, addedAt: new Date() },
      create: {
        customerId: context.customerId,
        productId: product.id,
        variantId: "",
        quantity,
      },
    }),
    prisma.wishlistItem.deleteMany({
      where: { customerId: context.customerId, productId: product.id },
    }),
  ]);

  revalidateBag();
  return { status: "success", message: `${product.name} moved to your bag.` };
}

function revalidateBag() {
  revalidatePath("/", "layout");
}
