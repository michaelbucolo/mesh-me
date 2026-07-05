-- CreateTable
CREATE TABLE "PlatformFeedItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "connectedAccountId" TEXT NOT NULL,
    "platformItemId" TEXT NOT NULL,
    "authorName" TEXT,
    "authorUsername" TEXT,
    "authorAvatarUrl" TEXT,
    "authorUrl" TEXT,
    "title" TEXT,
    "content" TEXT,
    "url" TEXT,
    "thumbnailUrl" TEXT,
    "mediaUrl" TEXT,
    "postType" TEXT NOT NULL DEFAULT 'post',
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "isNsfw" BOOLEAN NOT NULL DEFAULT false,
    "contentRating" TEXT NOT NULL DEFAULT 'general',
    "publishedAt" DATETIME,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawMetadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlatformFeedItem_connectedAccountId_fkey" FOREIGN KEY ("connectedAccountId") REFERENCES "ConnectedAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformFeedItem_connectedAccountId_platformItemId_key" ON "PlatformFeedItem"("connectedAccountId", "platformItemId");

-- CreateIndex
CREATE INDEX "PlatformFeedItem_connectedAccountId_publishedAt_idx" ON "PlatformFeedItem"("connectedAccountId", "publishedAt");

-- CreateIndex
CREATE INDEX "PlatformFeedItem_isNsfw_publishedAt_idx" ON "PlatformFeedItem"("isNsfw", "publishedAt");
