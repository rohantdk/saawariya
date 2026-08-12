"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSellerContext } from "@/lib/seller/context";
import { deriveInventoryStatus } from "@/lib/inventory-status";
import {
  lowStockThresholdSchema,
  stockAdjustSchema,
} from "@/lib/validations/seller";
import { fieldErrors, type ActionState } from "@/lib/validations/commerce";

/**
 * Seller stock writes — SRS §60, §97, §98.
 *
 * `StockMovement` is an append-only ledger and `Inventory.stockQty` is the
 * running balance, so every change has to write both, in one transaction. A
 * quantity that moves without a ledger row is a balance nobody can later
 * explain, which is the failure this model exists to prevent.
 */

/** Resolve the seller's own inventory row. Ownership is in the `where`. */
async function ownedInventory(productId: string) {
  const seller = await getSellerContext();
  if (!seller) {
    return { ok: false as const, error: "You must be signed in as a seller." };
  }

  const inventory = await prisma.inventory.findFirst({
    where: { productId, product: { sellerId: seller.sellerId } },
    select: {
      id: true,
      stockQty: true,
      reservedQty: true,
      lowStockThreshold: true,
      status: true,
      product: { select: { id: true, name: true } },
    },
  });
  if (!inventory) return { ok: false as const, error: "Product not found." };

  return { ok: true as const, seller, inventory };
}

export async function adjustStock(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = stockAdjustSchema.safeParse({
    productId: formData.get("productId"),
    quantity: formData.get("quantity"),
    direction: formData.get("direction"),
    reason: formData.get("reason"),
    note: formData.get("note") ?? undefined,
  });

  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error) };
  }
  const input = parsed.data;

  const owned = await ownedInventory(input.productId);
  if (!owned.ok) return { status: "error", message: owned.error };

  const { inventory } = owned;
  const nextQty = inventory.stockQty + input.changeQty;

  if (nextQty < 0) {
    return {
      status: "error",
      errors: {
        quantity: [
          `You only have ${inventory.stockQty} in stock, so you cannot remove ${Math.abs(input.changeQty)}.`,
        ],
      },
    };
  }

  /**
   * Stock cannot drop below what is already promised to paid orders. Allowing it
   * would let a seller "correct" their count into a position where the warehouse
   * cannot fulfil orders the customer has already been charged for — the
   * shortfall would only surface at picking, days later.
   */
  if (nextQty < inventory.reservedQty) {
    return {
      status: "error",
      errors: {
        quantity: [
          `${inventory.reservedQty} unit${inventory.reservedQty === 1 ? " is" : "s are"} reserved for orders already placed, so stock cannot go below that.`,
        ],
      },
    };
  }

  const nextStatus = deriveInventoryStatus(
    nextQty,
    inventory.lowStockThreshold,
    inventory.status,
  );

  await prisma.$transaction([
    prisma.inventory.update({
      where: { id: inventory.id },
      data: { stockQty: nextQty, status: nextStatus },
    }),
    prisma.stockMovement.create({
      data: {
        inventoryId: inventory.id,
        changeQty: input.changeQty,
        reason: input.reason,
        note: input.note || null,
      },
    }),
  ]);

  revalidatePath("/seller/inventory");
  revalidatePath("/seller");
  revalidatePath(`/seller/products/${input.productId}`);

  return {
    status: "success",
    message:
      input.changeQty > 0
        ? `Added ${input.changeQty}. Now ${nextQty} in stock.`
        : `Removed ${Math.abs(input.changeQty)}. Now ${nextQty} in stock.`,
  };
}

/**
 * The point at which a product starts reporting "low stock".
 *
 * Changing it re-derives the status immediately — otherwise raising the
 * threshold would leave a product sitting at IN_STOCK until the next sale
 * happened to recompute it, and the seller would conclude the setting does
 * nothing.
 */
export async function setLowStockThreshold(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = lowStockThresholdSchema.safeParse({
    productId: formData.get("productId"),
    lowStockThreshold: formData.get("lowStockThreshold"),
  });

  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error) };
  }
  const input = parsed.data;

  const owned = await ownedInventory(input.productId);
  if (!owned.ok) return { status: "error", message: owned.error };

  const { inventory } = owned;

  await prisma.inventory.update({
    where: { id: inventory.id },
    data: {
      lowStockThreshold: input.lowStockThreshold,
      status: deriveInventoryStatus(
        inventory.stockQty,
        input.lowStockThreshold,
        inventory.status,
      ),
    },
  });

  revalidatePath("/seller/inventory");
  revalidatePath("/seller");

  return { status: "success", message: "Low stock alert updated." };
}
