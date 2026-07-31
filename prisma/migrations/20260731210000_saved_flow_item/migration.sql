-- CreateTable
CREATE TABLE "SavedFlowItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "platform" TEXT,
    "title" TEXT,
    "url" TEXT,
    "thumbnailUrl" TEXT,
    "authorName" TEXT,
    "postType" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavedFlowItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SavedFlowItem_userId_idx" ON "SavedFlowItem"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedFlowItem_userId_refId_key" ON "SavedFlowItem"("userId", "refId");

