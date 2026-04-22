-- Create MeChat group browsing session tables
CREATE TABLE "MeChatSession" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "hostId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "currentItemId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "MeChatSession_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "MeChatSessionParticipant" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sessionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'participant',
  "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" DATETIME,
  CONSTRAINT "MeChatSessionParticipant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "MeChatSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MeChatSessionParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "MeChatSessionItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sessionId" TEXT NOT NULL,
  "addedById" TEXT NOT NULL,
  "sourcePlatform" TEXT NOT NULL DEFAULT 'mesh',
  "sourceUrl" TEXT,
  "title" TEXT,
  "content" TEXT,
  "postId" TEXT,
  "platformPostId" TEXT,
  "position" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MeChatSessionItem_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "MeChatSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MeChatSessionItem_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "MeChatSessionVote" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "itemId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "vote" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MeChatSessionVote_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "MeChatSessionItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MeChatSessionVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "MeChatSession_hostId_idx" ON "MeChatSession" ("hostId");
CREATE INDEX "MeChatSession_status_idx" ON "MeChatSession" ("status");
CREATE UNIQUE INDEX "MeChatSessionParticipant_sessionId_userId_key" ON "MeChatSessionParticipant" ("sessionId", "userId");
CREATE INDEX "MeChatSessionParticipant_userId_idx" ON "MeChatSessionParticipant" ("userId");
CREATE INDEX "MeChatSessionItem_sessionId_idx" ON "MeChatSessionItem" ("sessionId");
CREATE INDEX "MeChatSessionItem_addedById_idx" ON "MeChatSessionItem" ("addedById");
CREATE UNIQUE INDEX "MeChatSessionVote_itemId_userId_key" ON "MeChatSessionVote" ("itemId", "userId");
CREATE INDEX "MeChatSessionVote_userId_idx" ON "MeChatSessionVote" ("userId");
