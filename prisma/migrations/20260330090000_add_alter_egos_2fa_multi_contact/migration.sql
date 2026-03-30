-- AlterEgo (Account Merging)
CREATE TABLE IF NOT EXISTS "AlterEgo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "bio" TEXT,
    "avatarUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AlterEgo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "AlterEgo_username_key" ON "AlterEgo"("username");
CREATE INDEX IF NOT EXISTS "AlterEgo_userId_idx" ON "AlterEgo"("userId");

-- UserEmail (Multi-Email)
CREATE TABLE IF NOT EXISTS "UserEmail" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserEmail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "UserEmail_email_key" ON "UserEmail"("email");
CREATE INDEX IF NOT EXISTS "UserEmail_userId_idx" ON "UserEmail"("userId");

-- UserPhone (Multi-Phone)
CREATE TABLE IF NOT EXISTS "UserPhone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserPhone_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "UserPhone_phone_key" ON "UserPhone"("phone");
CREATE INDEX IF NOT EXISTS "UserPhone_userId_idx" ON "UserPhone"("userId");

-- TwoFactorMethod (2FA)
CREATE TABLE IF NOT EXISTS "TwoFactorMethod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "secret" TEXT,
    "publicKey" TEXT,
    "label" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TwoFactorMethod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "TwoFactorMethod_userId_idx" ON "TwoFactorMethod"("userId");

-- AccountMergeRequest
CREATE TABLE IF NOT EXISTS "AccountMergeRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "primaryUserId" TEXT NOT NULL,
    "secondaryEmail" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "verifyToken" TEXT,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "AccountMergeRequest_primaryUserId_idx" ON "AccountMergeRequest"("primaryUserId");
CREATE INDEX IF NOT EXISTS "AccountMergeRequest_secondaryEmail_idx" ON "AccountMergeRequest"("secondaryEmail");
