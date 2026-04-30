-- Privacy/security lockdown defaults.
-- Existing accounts are moved to private/discovery-off defaults; users can opt back in.

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
  "hideActivityStatus" BOOLEAN NOT NULL DEFAULT true,
  "readReceipts" BOOLEAN NOT NULL DEFAULT false,
  "emailVerified" BOOLEAN NOT NULL DEFAULT false,
  "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
  "resetToken" TEXT,
  "resetTokenExpiry" DATETIME,
  "status" TEXT NOT NULL DEFAULT 'offline',
  "lastSeenAt" DATETIME
);

INSERT INTO "new_User" (
  "id", "email", "username", "displayName", "passwordHash", "bio", "location", "website",
  "avatarUrl", "bannerUrl", "accentColor", "isPublic", "isAdmin", "isVerified", "isSuspended",
  "onboarded", "createdAt", "updatedAt", "activeTitle", "isMeshPro", "meshProSince",
  "stripeCustomerId", "stripeSubscriptionId", "signupNumber", "showInDiscovery",
  "hideActivityStatus", "readReceipts", "emailVerified", "phoneVerified", "resetToken",
  "resetTokenExpiry", "status", "lastSeenAt"
)
SELECT
  "id", "email", "username", "displayName", "passwordHash", "bio", "location", "website",
  "avatarUrl", "bannerUrl", "accentColor", false, "isAdmin", "isVerified", "isSuspended",
  "onboarded", "createdAt", "updatedAt", "activeTitle", "isMeshPro", "meshProSince",
  "stripeCustomerId", "stripeSubscriptionId", "signupNumber", false,
  true, false, "emailVerified", "phoneVerified", "resetToken",
  "resetTokenExpiry", "status", "lastSeenAt"
FROM "User";

DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");
CREATE UNIQUE INDEX "User_resetToken_key" ON "User"("resetToken");

CREATE TABLE "new_MeshPrivacy" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "meshVisibility" TEXT NOT NULL DEFAULT 'private',
  "branchOverrides" TEXT NOT NULL DEFAULT '{}',
  "showConnections" BOOLEAN NOT NULL DEFAULT false,
  "showStats" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "MeshPrivacy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_MeshPrivacy" (
  "id", "userId", "meshVisibility", "branchOverrides", "showConnections", "showStats", "createdAt", "updatedAt"
)
SELECT
  "id", "userId", 'private', "branchOverrides", false, false, "createdAt", "updatedAt"
FROM "MeshPrivacy";

DROP TABLE "MeshPrivacy";
ALTER TABLE "new_MeshPrivacy" RENAME TO "MeshPrivacy";
CREATE UNIQUE INDEX "MeshPrivacy_userId_key" ON "MeshPrivacy"("userId");

CREATE TABLE "new_GlobalMeshMember" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "sharedBranches" TEXT NOT NULL DEFAULT '[]',
  "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "GlobalMeshMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_GlobalMeshMember" (
  "id", "userId", "isActive", "sharedBranches", "joinedAt", "updatedAt"
)
SELECT
  "id", "userId", false, '[]', "joinedAt", "updatedAt"
FROM "GlobalMeshMember";

DROP TABLE "GlobalMeshMember";
ALTER TABLE "new_GlobalMeshMember" RENAME TO "GlobalMeshMember";
CREATE UNIQUE INDEX "GlobalMeshMember_userId_key" ON "GlobalMeshMember"("userId");

CREATE TABLE "new_DataVisibilityPolicy" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "visibility" TEXT NOT NULL,
  "allowDiscovery" BOOLEAN NOT NULL DEFAULT false,
  "allowAnalytics" BOOLEAN NOT NULL DEFAULT false,
  "allowAiUse" BOOLEAN NOT NULL DEFAULT false,
  "expiresAt" DATETIME,
  "metadata" TEXT NOT NULL DEFAULT '{}',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "DataVisibilityPolicy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_DataVisibilityPolicy" (
  "id", "userId", "entityType", "entityId", "visibility", "allowDiscovery", "allowAnalytics",
  "allowAiUse", "expiresAt", "metadata", "createdAt", "updatedAt"
)
SELECT
  "id", "userId", "entityType", "entityId", "visibility", false, false,
  false, "expiresAt", "metadata", "createdAt", "updatedAt"
FROM "DataVisibilityPolicy";

DROP TABLE "DataVisibilityPolicy";
ALTER TABLE "new_DataVisibilityPolicy" RENAME TO "DataVisibilityPolicy";
CREATE INDEX "DataVisibilityPolicy_userId_entityType_idx" ON "DataVisibilityPolicy"("userId", "entityType");
CREATE INDEX "DataVisibilityPolicy_visibility_idx" ON "DataVisibilityPolicy"("visibility");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
