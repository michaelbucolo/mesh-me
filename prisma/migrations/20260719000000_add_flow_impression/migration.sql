-- CreateTable
CREATE TABLE "FlowImpression" (
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "seenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "liked" BOOLEAN NOT NULL DEFAULT false,
    "authorKey" TEXT,
    "format" TEXT,
    "tags" TEXT,

    PRIMARY KEY ("userId", "postId"),
    CONSTRAINT "FlowImpression_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "FlowImpression_userId_seenAt_idx" ON "FlowImpression"("userId", "seenAt");

-- CreateIndex
CREATE INDEX "FlowImpression_userId_liked_idx" ON "FlowImpression"("userId", "liked");
