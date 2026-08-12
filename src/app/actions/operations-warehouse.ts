"use server";

import { prisma } from "@/lib/prisma";
import { requireOperationsAction } from "@/lib/operations/context";
import { revalidatePipeline } from "@/lib/operations/pipeline";
import { WAREHOUSE_HELD } from "@/lib/operations/queues";
import { AUDIT_ACTIONS, writeAudit } from "@/lib/admin/audit";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { deriveInventoryStatus } from "@/lib/inventory-status";
import { stockDiscrepancySchema } from "@/lib/validations/operations";
import { fieldErrors, type ActionState } from "@/lib/validations/commerce";

/**
 * Shortage and damage reporting — SRS §98.
 *
 * This is the **only** stock write the warehouse can make, and its shape is the
 * argument for allowing it at all. Phase 6 settled that no role manages all
 * stock: the ledger is append-only and every row corresponds to something that
 * happened, so a screen where an administrator types a new quantity would be a
 * number with no event behind it. Under the platform-warehouse model, though,
 * the warehouse is the only party that ever *sees* the goods — a shelf holding
 * seven where the book says ten is a fact nobody else can discover.
 *
 * So the write is allowed, and it is constrained to stay a report rather than
 * an edit:
 *
 *   - it is keyed on an **order item**, not a product, so an operator records
 *     what they found in the parcel in front of them and cannot open an
 *     arbitrary product;
 *   - it is refused unless the parcel is actually in the warehouse's hands;
 *   - it cannot exceed the quantity that line was asking for;
 *   - it only ever moves stock **down**. Finding more than expected is a
 *     restock, and a restock is the seller's to make against their own goods;
 *   - the seller is told, because it is their stock and their money.
 */
export async function reportStockDiscrepancy(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireOperationsAction(PERMISSIONS.WAREHOUSE_PROCESS);
  if (!auth.ok) return { status: "error", message: auth.error };

  const parsed = stockDiscrepancySchema.safeParse({
    subOrderId: formData.get("subOrderId"),
    orderItemId: formData.get("orderItemId"),
    kind: formData.get("kind"),
    quantity: formData.get("quantity"),
    note: formData.get("note"),
  });
  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error) };
  }
  const input = parsed.data;

  // The line, its parcel and its stock in one read — and the sub-order id is
  // part of the `where`, so an item id from a different parcel matches nothing
  // rather than being fetched and then checked.
  const item = await prisma.orderItem.findFirst({
    where: { id: input.orderItemId, subOrderId: input.subOrderId },
    select: {
      id: true,
      productId: true,
      productName: true,
      productSku: true,
      quantity: true,
      subOrder: {
        select: {
          id: true,
          subOrderNumber: true,
          status: true,
          orderId: true,
          order: { select: { orderNumber: true } },
          seller: { select: { businessName: true, userId: true } },
        },
      },
    },
  });
  if (!item) return { status: "error", message: "That line is not on this order." };

  const { subOrder } = item;

  if (!WAREHOUSE_HELD.includes(subOrder.status)) {
    return {
      status: "error",
      message:
        "This parcel is not in the warehouse — a discrepancy can only be reported while the goods are here.",
    };
  }

  if (input.quantity > item.quantity) {
    return {
      status: "error",
      errors: {
        quantity: [
          `This line is only for ${item.quantity} unit${item.quantity === 1 ? "" : "s"}.`,
        ],
      },
    };
  }

  const inventory = await prisma.inventory.findUnique({
    where: { productId: item.productId },
    select: {
      id: true,
      stockQty: true,
      reservedQty: true,
      lowStockThreshold: true,
      status: true,
    },
  });
  if (!inventory) {
    return { status: "error", message: "That product has no stock record." };
  }

  const damaged = input.kind === "DAMAGED";
  const stockQty = Math.max(0, inventory.stockQty - input.quantity);
  // A reservation larger than the stock behind it makes availability negative
  // everywhere it is computed, so the hold shrinks with the shelf.
  const reservedQty = Math.min(inventory.reservedQty, stockQty);

  await prisma.$transaction(async (tx) => {
    await tx.inventory.update({
      where: { id: inventory.id },
      data: {
        stockQty,
        reservedQty,
        status: deriveInventoryStatus(
          stockQty,
          inventory.lowStockThreshold,
          inventory.status,
        ),
      },
    });

    await tx.stockMovement.create({
      data: {
        inventoryId: inventory.id,
        changeQty: -input.quantity,
        // Both codes already exist on `StockMovement`. A shortage is a
        // correction to a book figure that was wrong; damage is stock that was
        // real and is now unsellable. Reporting both as "ADJUSTMENT" would make
        // the two indistinguishable in the ledger, and only one of them is
        // somebody's fault.
        reason: damaged ? "QC_DAMAGED" : "ADJUSTMENT",
        referenceId: subOrder.id,
        note: `${input.quantity} ${damaged ? "damaged" : "short"} while picking ${subOrder.subOrderNumber} — ${input.note}`,
      },
    });

    /**
     * The parcel does not change status — the warehouse may still be able to
     * fulfil it from the rest of the shelf — but the finding belongs on its
     * timeline, which is what the seller, the admin console and the customer's
     * tracking page all read. An `OrderEvent` whose `toStatus` equals the
     * current one is exactly that: something happened, nothing moved.
     */
    await tx.orderEvent.create({
      data: {
        orderId: subOrder.orderId,
        subOrderId: subOrder.id,
        fromStatus: subOrder.status,
        toStatus: subOrder.status,
        actorUserId: auth.ops.userId,
        actorRole: auth.ops.role,
        note: `${damaged ? "Damage" : "Shortage"} reported at picking: ${input.quantity} × ${item.productName} — ${input.note}`,
      },
    });

    await tx.notification.create({
      data: {
        userId: subOrder.seller.userId,
        title: `Stock ${damaged ? "damage" : "shortage"} on ${item.productSku}`,
        body: `Our warehouse recorded ${input.quantity} unit${input.quantity === 1 ? "" : "s"} of ${item.productName} as ${damaged ? "damaged" : "missing"} while picking ${subOrder.subOrderNumber}. Your stock now reads ${stockQty}. Reason given: ${input.note}`,
        // The vocabulary `Notification.category` documents has no INVENTORY
        // member; this is news about one of the seller's products.
        category: "PRODUCT",
        linkUrl: "/seller/inventory",
      },
    });

    await writeAudit(
      {
        userId: auth.ops.userId,
        action: AUDIT_ACTIONS.STOCK_ADJUSTED,
        entityType: "Inventory",
        entityId: inventory.id,
        summary: `${input.quantity} × ${item.productSku} (${subOrder.seller.businessName}) written off as ${damaged ? "damaged" : "short"} at picking on ${subOrder.subOrderNumber} — ${input.note}`,
        meta: {
          subOrderNumber: subOrder.subOrderNumber,
          from: inventory.stockQty,
          to: stockQty,
          kind: input.kind,
        },
      },
      tx,
    );
  });

  revalidatePipeline(subOrder.subOrderNumber, subOrder.order.orderNumber);

  return {
    status: "success",
    message: `Recorded. ${item.productSku} now reads ${stockQty} in stock and the seller has been told.`,
  };
}
