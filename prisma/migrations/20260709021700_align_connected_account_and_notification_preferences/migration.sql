-- Align migration history with schema.prisma for databases provisioned via
-- `prisma migrate deploy`. Databases that already received these columns via
-- `prisma db push` should baseline instead of applying:
--   npx prisma migrate resolve --applied 20260709021700_align_connected_account_and_notification_preferences

-- ConnectedAccount: sync tracking, alter-ego binding, and account labeling.
ALTER TABLE "ConnectedAccount" ADD COLUMN "scopes" TEXT;
ALTER TABLE "ConnectedAccount" ADD COLUMN "lastSyncAt" DATETIME;
ALTER TABLE "ConnectedAccount" ADD COLUMN "syncStatus" TEXT NOT NULL DEFAULT 'idle';
ALTER TABLE "ConnectedAccount" ADD COLUMN "syncError" TEXT;
ALTER TABLE "ConnectedAccount" ADD COLUMN "alterEgoId" TEXT REFERENCES "AlterEgo" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConnectedAccount" ADD COLUMN "accountLabel" TEXT;

-- Multiple accounts per platform are now supported (alter egos / account
-- labels), so the original one-account-per-platform unique index goes away.
DROP INDEX IF EXISTS "ConnectedAccount_userId_platform_key";
CREATE INDEX IF NOT EXISTS "ConnectedAccount_userId_platform_idx" ON "ConnectedAccount"("userId", "platform");
CREATE INDEX IF NOT EXISTS "ConnectedAccount_platform_idx" ON "ConnectedAccount"("platform");
CREATE INDEX IF NOT EXISTS "ConnectedAccount_alterEgoId_idx" ON "ConnectedAccount"("alterEgoId");

-- UserNotificationPreference: drop the database-level DEFAULT on updatedAt so
-- the table matches schema.prisma (@updatedAt is managed by the client).
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UserNotificationPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailDigest" TEXT NOT NULL DEFAULT 'weekly',
    "messages" BOOLEAN NOT NULL DEFAULT true,
    "mentions" BOOLEAN NOT NULL DEFAULT true,
    "comments" BOOLEAN NOT NULL DEFAULT true,
    "follows" BOOLEAN NOT NULL DEFAULT true,
    "platformAlerts" BOOLEAN NOT NULL DEFAULT true,
    "securityAlerts" BOOLEAN NOT NULL DEFAULT true,
    "productUpdates" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserNotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_UserNotificationPreference" ("id", "userId", "pushEnabled", "emailDigest", "messages", "mentions", "comments", "follows", "platformAlerts", "securityAlerts", "productUpdates", "createdAt", "updatedAt") SELECT "id", "userId", "pushEnabled", "emailDigest", "messages", "mentions", "comments", "follows", "platformAlerts", "securityAlerts", "productUpdates", "createdAt", "updatedAt" FROM "UserNotificationPreference";
DROP TABLE "UserNotificationPreference";
ALTER TABLE "new_UserNotificationPreference" RENAME TO "UserNotificationPreference";
CREATE UNIQUE INDEX "UserNotificationPreference_userId_key" ON "UserNotificationPreference"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
