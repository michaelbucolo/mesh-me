-- Add default-off sensitive-content controls and adult-verification status.
-- Mesh.me stores verification status and provider reference only, never ID images.

ALTER TABLE "User" ADD COLUMN "nsfwEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "adultVerificationStatus" TEXT NOT NULL DEFAULT 'unverified';
ALTER TABLE "User" ADD COLUMN "adultVerifiedAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "adultVerificationExpiresAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "adultVerificationProvider" TEXT;
ALTER TABLE "User" ADD COLUMN "adultVerificationRegion" TEXT;
ALTER TABLE "User" ADD COLUMN "adultVerificationReference" TEXT;

ALTER TABLE "Post" ADD COLUMN "isNsfw" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Post" ADD COLUMN "contentRating" TEXT NOT NULL DEFAULT 'general';

ALTER TABLE "PlatformPost" ADD COLUMN "isNsfw" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PlatformPost" ADD COLUMN "contentRating" TEXT NOT NULL DEFAULT 'general';

CREATE INDEX "Post_isNsfw_createdAt_idx" ON "Post"("isNsfw", "createdAt");
CREATE INDEX "PlatformPost_isNsfw_publishedAt_idx" ON "PlatformPost"("isNsfw", "publishedAt");
