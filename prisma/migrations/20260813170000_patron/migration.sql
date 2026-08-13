-- Patron: a recurring contribution that buys nothing. patronSince is the
-- permanent record the marks render from (never cleared by churn; nulled only
-- by full-refund erasure); PatronStint rows are per-subscription receipts.
ALTER TABLE "User" ADD COLUMN "patronSince" DATETIME;
ALTER TABLE "User" ADD COLUMN "showPatronChip" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "PatronStint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT NOT NULL,
    "monthlyCents" INTEGER NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "refundedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PatronStint_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PatronStint_stripeSubscriptionId_key" ON "PatronStint"("stripeSubscriptionId");
CREATE INDEX "PatronStint_userId_idx" ON "PatronStint"("userId");
