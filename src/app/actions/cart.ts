"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCustomerContext } from "@/lib/commerce/context";
import { availableFor } from "@/lib/commerce/cart";
import { availabilityOf } from "@/lib/catalogue/availability";
import { resolvePrice } from "@/lib/catalogue/pricing";
import { PUBLIC_PRODUCT_WHERE } from "@/lib/catalogue/queries";
import {
  addToCartSchema,
  cartItemSchema,
  fieldErrors,
  updateCartQuantitySchema,
  type ActionState,
} from "@/lib/validations/commerce";

/**
 * Cart mutations — SRS §42.
 *
 * Server Actions are public endpoints. Everything here therefore re-derives the
 * customer from the session cookie and never trusts a customer id from the
 * form, and every cart row is addressed by `{ id, customerId }` so one
 * customer cannot alter another's bag by guessing a cuid.
 *
 * Quantities are checked against live stock and the product's MOQ here as well
 * as at checkout. The cart page would still catch a bad quantity, but letting
 * an impossible row into the database means every later screen has to cope
 * with it.
 */

function signedOut(): ActionState {
  return {
    status: "error",
    message: "Sign in to use your bag.",
  };
}

export async function addToCart(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getCustomerContext();
  if (!context) return signedOut();

  const parsed = addToCartSchema.safeParse({
    productId: formData.get("productId"),
    variantId: formData.get("variantId") ?? undefined,
    quantity: formData.get("quantity") ?? 1,
  });

  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error) };
  }

  const { productId, variantId, quantity } = parsed.data;

  const product = await prisma.product.findFirst({
    // The public visibility rule, not just "exists" — a pending or rejected
    // product must not be addable by posting its id.
    where: { id: productId, ...PUBLIC_PRODUCT_WHERE },
    select: {
      id: true,
      name: true,
      priceRetail: true,
      priceOffer: true,
      priceWholesale: true,
      minOrderQty: true,
      maxOrderQty: true,
      isMadeToOrder: true,
      loomWeeks: true,
      variants: { select: { id: true, stockQty: true } },
      inventory: { select: { status: true, stockQty: true, reservedQty: true } },
    },
  });

  if (!product) {
    return { status: "error", message: "That product is no longer available." };
  }

  const variant = variantId
    ? (product.variants.find((v) => v.id === variantId) ?? null)
    : null;

  if (variantId && !variant) {
    return { status: "error", message: "Choose an available option." };
  }
  // A product with variants must have one chosen — otherwise the order line
  // records no length or size and the warehouse cannot pick it.
  if (!variantId && product.variants.length > 0) {
    return { status: "error", message: "Choose an option before adding to your bag." };
  }

  const price = resolvePrice(product, context.tier);
  const existing = await prisma.cartItem.findUnique({
    where: {
      customerId_productId_variantId: {
        customerId: context.customerId,
        productId,
        // "" is the no-variant sentinel — see the CartItem note in the schema.
        variantId: variantId ?? "",
      },
    },
    select: { id: true, quantity: true },
  });

  // Adding to something already in the bag tops it up rather than replacing it.
  const requested = (existing?.quantity ?? 0) + quantity;
  // A commissioned piece is not bound by the shelf — see availabilityOf(). The
  // per-order maximum below is then the only ceiling, and it still applies.
  const availability = availabilityOf(product);
  const available = availability.isOnTheLoom
    ? product.maxOrderQty
    : availableFor(product.inventory, variant);

  if (!availability.isPurchasable || available <= 0) {
    return {
      status: "error",
      message: `${product.name} is ${availability.label.toLowerCase()}.`,
    };
  }
  if (requested > available) {
    return {
      status: "error",
      message:
        existing
          ? `You already have ${existing.quantity} in your bag and only ${available} are available.`
          : `Only ${available} available.`,
    };
  }
  if (requested > product.maxOrderQty) {
    return {
      status: "error",
      message: `You can order at most ${product.maxOrderQty} of this item.`,
    };
  }
  // MOQ is a wholesale rule and resolvePrice reports it per tier: 1 at retail,
  // the product's real minimum for a trade account.
  if (requested < price.minOrderQty) {
    return {
      status: "error",
      message: `This item has a minimum order of ${price.minOrderQty}.`,
    };
  }

  await prisma.cartItem.upsert({
    where: {
      customerId_productId_variantId: {
        customerId: context.customerId,
        productId,
        // "" is the no-variant sentinel — see the CartItem note in the schema.
        variantId: variantId ?? "",
      },
    },
    update: { quantity: requested, addedAt: new Date() },
    create: {
      customerId: context.customerId,
      productId,
      variantId: variantId ?? "",
      quantity: requested,
    },
  });

  revalidateBag();

  return {
    status: "success",
    message: `${product.name} added to your bag.`,
  };
}

export async function updateCartQuantity(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getCustomerContext();
  if (!context) return signedOut();

  const parsed = updateCartQuantitySchema.safeParse({
    cartItemId: formData.get("cartItemId"),
    quantity: formData.get("quantity"),
  });

  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error) };
  }

  const item = await prisma.cartItem.findFirst({
    where: { id: parsed.data.cartItemId, customerId: context.customerId },
    select: {
      id: true,
      variantId: true,
      product: {
        select: {
          name: true,
          maxOrderQty: true,
          isMadeToOrder: true,
          loomWeeks: true,
          variants: { select: { id: true, stockQty: true } },
          inventory: { select: { status: true, stockQty: true, reservedQty: true } },
        },
      },
    },
  });

  if (!item) return { status: "error", message: "That item is no longer in your bag." };

  const variant = item.variantId
    ? (item.product.variants.find((v) => v.id === item.variantId) ?? null)
    : null;
  // Same rule as adding: the loom, not the shelf, sets the ceiling.
  const available = availabilityOf(item.product).isOnTheLoom
    ? item.product.maxOrderQty
    : availableFor(item.product.inventory, variant);

  if (parsed.data.quantity > available) {
    return {
      status: "error",
      message: `Only ${available} of ${item.product.name} available.`,
    };
  }
  if (parsed.data.quantity > item.product.maxOrderQty) {
    return {
      status: "error",
      message: `You can order at most ${item.product.maxOrderQty} of this item.`,
    };
  }

  await prisma.cartItem.update({
    where: { id: item.id },
    data: { quantity: parsed.data.quantity },
  });

  revalidateBag();
  return { status: "success" };
}

export async function removeCartItem(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getCustomerContext();
  if (!context) return signedOut();

  const parsed = cartItemSchema.safeParse({
    cartItemId: formData.get("cartItemId"),
  });
  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error) };
  }

  // deleteMany with the customer id in the filter: a row belonging to someone
  // else simply matches nothing, rather than throwing a "not found" that would
  // confirm the id exists.
  const result = await prisma.cartItem.deleteMany({
    where: { id: parsed.data.cartItemId, customerId: context.customerId },
  });

  if (result.count === 0) {
    return { status: "error", message: "That item is no longer in your bag." };
  }

  revalidateBag();
  return { status: "success", message: "Removed from your bag." };
}

/** Keeps the item but parks it in the wishlist — SRS §41. */
export async function moveCartItemToWishlist(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getCustomerContext();
  if (!context) return signedOut();

  const parsed = cartItemSchema.safeParse({
    cartItemId: formData.get("cartItemId"),
  });
  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error) };
  }

  const item = await prisma.cartItem.findFirst({
    where: { id: parsed.data.cartItemId, customerId: context.customerId },
    select: { id: true, productId: true, product: { select: { name: true } } },
  });

  if (!item) return { status: "error", message: "That item is no longer in your bag." };

  await prisma.$transaction([
    prisma.wishlistItem.upsert({
      where: {
        customerId_productId: {
          customerId: context.customerId,
          productId: item.productId,
        },
      },
      update: {},
      create: { customerId: context.customerId, productId: item.productId },
    }),
    prisma.cartItem.delete({ where: { id: item.id } }),
  ]);

  revalidateBag();
  return { status: "success", message: `${item.product.name} saved to your wishlist.` };
}

export async function clearCart(): Promise<ActionState> {
  const context = await getCustomerContext();
  if (!context) return signedOut();

  await prisma.cartItem.deleteMany({ where: { customerId: context.customerId } });

  revalidateBag();
  return { status: "success", message: "Your bag is empty." };
}

/**
 * The header badge is rendered on every page, so a change to the bag has to
 * invalidate more than the page the form was on.
 */
function revalidateBag() {
  revalidatePath("/", "layout");
}
