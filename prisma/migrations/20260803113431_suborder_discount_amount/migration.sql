-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SubOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subOrderNumber" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLACED',
    "subtotal" INTEGER NOT NULL,
    "discountAmount" INTEGER NOT NULL DEFAULT 0,
    "shippingAmount" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" INTEGER NOT NULL,
    "confirmedAt" DATETIME,
    "pickedAt" DATETIME,
    "qcAt" DATETIME,
    "packedAt" DATETIME,
    "dispatchedAt" DATETIME,
    "deliveredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SubOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SubOrder_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_SubOrder" ("confirmedAt", "createdAt", "deliveredAt", "dispatchedAt", "id", "orderId", "packedAt", "pickedAt", "qcAt", "sellerId", "shippingAmount", "status", "subOrderNumber", "subtotal", "totalAmount", "updatedAt") SELECT "confirmedAt", "createdAt", "deliveredAt", "dispatchedAt", "id", "orderId", "packedAt", "pickedAt", "qcAt", "sellerId", "shippingAmount", "status", "subOrderNumber", "subtotal", "totalAmount", "updatedAt" FROM "SubOrder";
DROP TABLE "SubOrder";
ALTER TABLE "new_SubOrder" RENAME TO "SubOrder";
CREATE UNIQUE INDEX "SubOrder_subOrderNumber_key" ON "SubOrder"("subOrderNumber");
CREATE INDEX "SubOrder_orderId_idx" ON "SubOrder"("orderId");
CREATE INDEX "SubOrder_sellerId_idx" ON "SubOrder"("sellerId");
CREATE INDEX "SubOrder_status_idx" ON "SubOrder"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
