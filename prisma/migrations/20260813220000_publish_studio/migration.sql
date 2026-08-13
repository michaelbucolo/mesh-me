-- AlterTable
ALTER TABLE "ConnectedAccount" ADD COLUMN "serviceUrl" TEXT;

-- CreateTable
CREATE TABLE "ScheduledPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "title" TEXT,
    "mediaJson" TEXT NOT NULL DEFAULT '[]',
    "targetsJson" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "scheduledFor" DATETIME NOT NULL,
    "tz" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" DATETIME,
    "claimedAt" DATETIME,
    "firedAt" DATETIME,
    "completedAt" DATETIME,
    "reportJson" TEXT,
    "notifiedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ScheduledPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SchedulerRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "claimed" INTEGER NOT NULL DEFAULT 0,
    "fired" INTEGER NOT NULL DEFAULT 0,
    "missed" INTEGER NOT NULL DEFAULT 0,
    "retried" INTEGER NOT NULL DEFAULT 0,
    "interrupted" INTEGER NOT NULL DEFAULT 0,
    "detail" TEXT
);

-- CreateIndex
CREATE INDEX "ScheduledPost_status_scheduledFor_idx" ON "ScheduledPost"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "ScheduledPost_status_nextAttemptAt_idx" ON "ScheduledPost"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "ScheduledPost_userId_scheduledFor_idx" ON "ScheduledPost"("userId", "scheduledFor");

-- CreateIndex
CREATE INDEX "SchedulerRun_startedAt_idx" ON "SchedulerRun"("startedAt");
