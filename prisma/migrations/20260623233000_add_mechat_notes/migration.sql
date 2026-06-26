-- CreateTable
CREATE TABLE "MeChatNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "songTitle" TEXT,
    "songArtist" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    CONSTRAINT "MeChatNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "MeChatNote_userId_idx" ON "MeChatNote"("userId");

-- CreateIndex
CREATE INDEX "MeChatNote_expiresAt_idx" ON "MeChatNote"("expiresAt");

