-- Bring the migration history back in sync with schema.prisma. Production's
-- additive schema sync had already masked these gaps, but a fresh database
-- created only from migrations could not run the seed or MeChat queries.

-- AlterTable
ALTER TABLE "Message" ADD COLUMN "externalMessageId" TEXT;

-- AlterTable
ALTER TABLE "MessageThread" ADD COLUMN "connectedAccountId" TEXT;
ALTER TABLE "MessageThread" ADD COLUMN "externalConversationId" TEXT;

-- RedefineTables
-- Align the activity-status default with account creation and the canonical
-- schema while preserving every existing user and index.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "bio" TEXT,
    "location" TEXT,
    "website" TEXT,
    "avatarUrl" TEXT,
    "bannerUrl" TEXT,
    "accentColor" TEXT NOT NULL DEFAULT '#6366f1',
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isSuspended" BOOLEAN NOT NULL DEFAULT false,
    "onboarded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "activeTitle" TEXT,
    "isMeshPro" BOOLEAN NOT NULL DEFAULT false,
    "meshProSince" DATETIME,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "signupNumber" INTEGER,
    "showInDiscovery" BOOLEAN NOT NULL DEFAULT false,
    "hideActivityStatus" BOOLEAN NOT NULL DEFAULT false,
    "readReceipts" BOOLEAN NOT NULL DEFAULT false,
    "nsfwEnabled" BOOLEAN NOT NULL DEFAULT false,
    "adultVerificationStatus" TEXT NOT NULL DEFAULT 'unverified',
    "adultVerifiedAt" DATETIME,
    "adultVerificationExpiresAt" DATETIME,
    "adultVerificationProvider" TEXT,
    "adultVerificationRegion" TEXT,
    "adultVerificationReference" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "resetToken" TEXT,
    "resetTokenExpiry" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'offline',
    "lastSeenAt" DATETIME
);
INSERT INTO "new_User" (
    "accentColor", "activeTitle", "adultVerificationExpiresAt", "adultVerificationProvider",
    "adultVerificationReference", "adultVerificationRegion", "adultVerificationStatus",
    "adultVerifiedAt", "avatarUrl", "bannerUrl", "bio", "createdAt", "displayName",
    "email", "emailVerified", "hideActivityStatus", "id", "isAdmin", "isMeshPro",
    "isPublic", "isSuspended", "isVerified", "lastSeenAt", "location", "meshProSince",
    "nsfwEnabled", "onboarded", "passwordHash", "phoneVerified", "readReceipts",
    "resetToken", "resetTokenExpiry", "showInDiscovery", "signupNumber", "status",
    "stripeCustomerId", "stripeSubscriptionId", "updatedAt", "username", "website"
)
SELECT
    "accentColor", "activeTitle", "adultVerificationExpiresAt", "adultVerificationProvider",
    "adultVerificationReference", "adultVerificationRegion", "adultVerificationStatus",
    "adultVerifiedAt", "avatarUrl", "bannerUrl", "bio", "createdAt", "displayName",
    "email", "emailVerified", "hideActivityStatus", "id", "isAdmin", "isMeshPro",
    "isPublic", "isSuspended", "isVerified", "lastSeenAt", "location", "meshProSince",
    "nsfwEnabled", "onboarded", "passwordHash", "phoneVerified", "readReceipts",
    "resetToken", "resetTokenExpiry", "showInDiscovery", "signupNumber", "status",
    "stripeCustomerId", "stripeSubscriptionId", "updatedAt", "username", "website"
FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");
CREATE UNIQUE INDEX "User_resetToken_key" ON "User"("resetToken");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Message_externalMessageId_idx" ON "Message"("externalMessageId");

-- CreateIndex
CREATE INDEX "MessageThread_sourcePlatform_idx" ON "MessageThread"("sourcePlatform");

-- CreateIndex
CREATE UNIQUE INDEX "MessageThread_connectedAccountId_externalConversationId_key"
ON "MessageThread"("connectedAccountId", "externalConversationId");
