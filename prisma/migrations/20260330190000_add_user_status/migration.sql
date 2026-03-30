-- Add online status and last seen fields to User
ALTER TABLE "User" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'offline';
ALTER TABLE "User" ADD COLUMN "lastSeenAt" DATETIME;
