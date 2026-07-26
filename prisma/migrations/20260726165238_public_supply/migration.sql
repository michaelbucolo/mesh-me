-- CreateTable
CREATE TABLE "PublicPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "platform" TEXT NOT NULL,
    "platformPostId" TEXT NOT NULL,
    "lane" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT,
    "url" TEXT,
    "postType" TEXT NOT NULL DEFAULT 'video',
    "thumbnailUrl" TEXT,
    "mediaUrl" TEXT,
    "durationSeconds" INTEGER,
    "lang" TEXT,
    "authorName" TEXT,
    "authorUsername" TEXT,
    "authorAvatarUrl" TEXT,
    "authorUrl" TEXT,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "isNsfw" BOOLEAN NOT NULL DEFAULT false,
    "contentRating" TEXT NOT NULL DEFAULT 'general',
    "publishedAt" DATETIME,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PublicSupplyRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "platform" TEXT NOT NULL,
    "lane" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "itemsFetched" INTEGER NOT NULL DEFAULT 0,
    "itemsStored" INTEGER NOT NULL DEFAULT 0,
    "detail" TEXT,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "PublicPost_platform_publishedAt_idx" ON "PublicPost"("platform", "publishedAt");

-- CreateIndex
CREATE INDEX "PublicPost_expiresAt_idx" ON "PublicPost"("expiresAt");

-- CreateIndex
CREATE INDEX "PublicPost_lane_fetchedAt_idx" ON "PublicPost"("lane", "fetchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PublicPost_platform_platformPostId_key" ON "PublicPost"("platform", "platformPostId");

-- CreateIndex
CREATE INDEX "PublicSupplyRun_platform_startedAt_idx" ON "PublicSupplyRun"("platform", "startedAt");

-- CreateIndex
CREATE INDEX "PublicSupplyRun_startedAt_idx" ON "PublicSupplyRun"("startedAt");

