-- AlterTable
ALTER TABLE "User" ADD COLUMN "meshProGiftUntil" DATETIME;

-- CreateTable
CREATE TABLE "MeshProGift" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "purchaserId" TEXT,
    "recipientId" TEXT NOT NULL,
    "months" INTEGER NOT NULL,
    "message" TEXT,
    "occasion" TEXT,
    "stripeSessionId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MeshProGift_purchaserId_fkey" FOREIGN KEY ("purchaserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MeshProGift_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "MeshProGift_stripeSessionId_key" ON "MeshProGift"("stripeSessionId");

-- CreateIndex
CREATE INDEX "MeshProGift_recipientId_idx" ON "MeshProGift"("recipientId");

-- CreateIndex
CREATE INDEX "MeshProGift_purchaserId_idx" ON "MeshProGift"("purchaserId");

