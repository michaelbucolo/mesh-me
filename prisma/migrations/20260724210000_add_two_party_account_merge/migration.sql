-- Two-party account merge: bind a merge request to the resolved secondary
-- user, track secondary-side approval and request expiry, and tombstone merged
-- accounts with a pointer to the surviving account (deactivated, never
-- hard-deleted). All columns are nullable so the change is purely additive.
ALTER TABLE "AccountMergeRequest" ADD COLUMN "secondaryUserId" TEXT;
ALTER TABLE "AccountMergeRequest" ADD COLUMN "approvedAt" DATETIME;
ALTER TABLE "AccountMergeRequest" ADD COLUMN "expiresAt" DATETIME;

-- CreateIndex
CREATE INDEX "AccountMergeRequest_secondaryUserId_idx" ON "AccountMergeRequest"("secondaryUserId");

-- Tombstone pointer on the merged-away account.
ALTER TABLE "User" ADD COLUMN "mergedIntoUserId" TEXT;
