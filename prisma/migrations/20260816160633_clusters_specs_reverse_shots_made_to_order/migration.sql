-- CreateTable
CREATE TABLE "Cluster" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "tradition" TEXT NOT NULL,
    "blurb" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

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
    "zariType" TEXT,
    "blousePieceCm" INTEGER,
    "washCare" TEXT,
    "isMadeToOrder" BOOLEAN NOT NULL DEFAULT false,
    "loomWeeks" INTEGER,
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
INSERT INTO "new_Product" ("approvedAt", "approvedById", "brand", "categoryId", "collection", "color", "createdAt", "description", "fabric", "id", "isFeatured", "isNewArrival", "maxOrderQty", "minOrderQty", "name", "occasion", "pattern", "priceEffective", "priceOffer", "priceRetail", "priceWholesale", "ratingAvg", "ratingCount", "rejectionReason", "salesCount", "sellerId", "sku", "slug", "status", "updatedAt", "weightGrams", "workType") SELECT "approvedAt", "approvedById", "brand", "categoryId", "collection", "color", "createdAt", "description", "fabric", "id", "isFeatured", "isNewArrival", "maxOrderQty", "minOrderQty", "name", "occasion", "pattern", "priceEffective", "priceOffer", "priceRetail", "priceWholesale", "ratingAvg", "ratingCount", "rejectionReason", "salesCount", "sellerId", "sku", "slug", "status", "updatedAt", "weightGrams", "workType" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");
CREATE INDEX "Product_sellerId_idx" ON "Product"("sellerId");
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");
CREATE INDEX "Product_status_idx" ON "Product"("status");
CREATE INDEX "Product_isFeatured_idx" ON "Product"("isFeatured");
CREATE INDEX "Product_priceEffective_idx" ON "Product"("priceEffective");
CREATE TABLE "new_ProductImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isMain" BOOLEAN NOT NULL DEFAULT false,
    "kind" TEXT NOT NULL DEFAULT 'FRONT',
    CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ProductImage" ("alt", "id", "isMain", "productId", "sortOrder", "url") SELECT "alt", "id", "isMain", "productId", "sortOrder", "url" FROM "ProductImage";
DROP TABLE "ProductImage";
ALTER TABLE "new_ProductImage" RENAME TO "ProductImage";
CREATE INDEX "ProductImage_productId_idx" ON "ProductImage"("productId");
CREATE TABLE "new_Seller" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "businessType" TEXT NOT NULL,
    "clusterId" TEXT,
    "gstNumber" TEXT,
    "panNumber" TEXT,
    "logoUrl" TEXT,
    "description" TEXT,
    "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "verificationNote" TEXT,
    "verifiedAt" DATETIME,
    "addressLine" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pinCode" TEXT,
    "pickupAddress" TEXT,
    "bankAccountName" TEXT,
    "bankAccountNumber" TEXT,
    "bankIfsc" TEXT,
    "commissionPercent" INTEGER NOT NULL DEFAULT 10,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Seller_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Seller_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "Cluster" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Seller" ("addressLine", "bankAccountName", "bankAccountNumber", "bankIfsc", "businessName", "businessType", "city", "commissionPercent", "createdAt", "description", "gstNumber", "id", "logoUrl", "ownerName", "panNumber", "pickupAddress", "pinCode", "state", "updatedAt", "userId", "verificationNote", "verificationStatus", "verifiedAt") SELECT "addressLine", "bankAccountName", "bankAccountNumber", "bankIfsc", "businessName", "businessType", "city", "commissionPercent", "createdAt", "description", "gstNumber", "id", "logoUrl", "ownerName", "panNumber", "pickupAddress", "pinCode", "state", "updatedAt", "userId", "verificationNote", "verificationStatus", "verifiedAt" FROM "Seller";
DROP TABLE "Seller";
ALTER TABLE "new_Seller" RENAME TO "Seller";
CREATE UNIQUE INDEX "Seller_userId_key" ON "Seller"("userId");
CREATE INDEX "Seller_verificationStatus_idx" ON "Seller"("verificationStatus");
CREATE INDEX "Seller_clusterId_idx" ON "Seller"("clusterId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Cluster_slug_key" ON "Cluster"("slug");

-- CreateIndex
CREATE INDEX "Cluster_isActive_idx" ON "Cluster"("isActive");
