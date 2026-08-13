-- Owned Meshi wardrobe pieces: one row per paid $1.99 purchase (self or gift).
-- Deliberately NO unique on (ownerId, category, value): a revoked receipt
-- (refund) must never block an honest re-purchase of the same piece.
-- stripeSessionId unique = webhook redelivery idempotency, same as MeshProGift.
CREATE TABLE "OwnedMeshiItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "purchaserId" TEXT,
    "category" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "message" TEXT,
    "stripeSessionId" TEXT NOT NULL,
    "paymentIntentId" TEXT,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OwnedMeshiItem_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OwnedMeshiItem_purchaserId_fkey" FOREIGN KEY ("purchaserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "OwnedMeshiItem_stripeSessionId_key" ON "OwnedMeshiItem"("stripeSessionId");
CREATE UNIQUE INDEX "OwnedMeshiItem_paymentIntentId_key" ON "OwnedMeshiItem"("paymentIntentId");
CREATE INDEX "OwnedMeshiItem_ownerId_idx" ON "OwnedMeshiItem"("ownerId");
CREATE INDEX "OwnedMeshiItem_purchaserId_idx" ON "OwnedMeshiItem"("purchaserId");
