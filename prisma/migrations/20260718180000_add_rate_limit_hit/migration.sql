-- CreateTable
CREATE TABLE "RateLimitHit" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "count" INTEGER NOT NULL DEFAULT 0,
    "resetAt" DATETIME NOT NULL,
    "lockedUntil" DATETIME,
    "lockCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "RateLimitHit_resetAt_idx" ON "RateLimitHit"("resetAt");
