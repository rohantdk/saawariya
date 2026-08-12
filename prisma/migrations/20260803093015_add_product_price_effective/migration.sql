-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "brand" TEXT,
    "collection" TEXT,
    "fabric" TEXT,
    "pattern" TEXT,
    "occasion" TEXT,
    "workType" TEXT,
    "color" TEXT,
    "weightGrams" INTEGER,
    "priceRetail" INTEGER NOT NULL,
    "priceWholesale" INTEGER,
    "priceOffer" INTEGER,
    "priceEffective" INTEGER NOT NULL DEFAULT 0,
    "minOrderQty" INTEGER NOT NULL DEFAULT 1,
    "maxOrderQty" INTEGER NOT NULL DEFAULT 100,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "rejectionReason" TEXT,
    "approvedById" TEXT,
    "approvedAt" DATETIME,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isNewArrival" BOOLEAN NOT NULL DEFAULT false,
    "salesCount" INTEGER NOT NULL DEFAULT 0,
    "ratingAvg" INTEGER NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Product_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Product_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Product" ("approvedAt", "approvedById", "brand", "categoryId", "collection", "color", "createdAt", "description", "fabric", "id", "isFeatured", "isNewArrival", "maxOrderQty", "minOrderQty", "name", "occasion", "pattern", "priceOffer", "priceRetail", "priceWholesale", "ratingAvg", "ratingCount", "rejectionReason", "salesCount", "sellerId", "sku", "slug", "status", "updatedAt", "weightGrams", "workType") SELECT "approvedAt", "approvedById", "brand", "categoryId", "collection", "color", "createdAt", "description", "fabric", "id", "isFeatured", "isNewArrival", "maxOrderQty", "minOrderQty", "name", "occasion", "pattern", "priceOffer", "priceRetail", "priceWholesale", "ratingAvg", "ratingCount", "rejectionReason", "salesCount", "sellerId", "sku", "slug", "status", "updatedAt", "weightGrams", "workType" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");
CREATE INDEX "Product_sellerId_idx" ON "Product"("sellerId");
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");
CREATE INDEX "Product_status_idx" ON "Product"("status");
CREATE INDEX "Product_isFeatured_idx" ON "Product"("isFeatured");
CREATE INDEX "Product_priceEffective_idx" ON "Product"("priceEffective");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
