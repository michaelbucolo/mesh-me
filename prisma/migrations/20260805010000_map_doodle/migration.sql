-- CreateTable
CREATE TABLE "MapDoodle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "ink" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MapDoodle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "MapDoodle_createdAt_idx" ON "MapDoodle"("createdAt");

-- CreateIndex
CREATE INDEX "MapDoodle_userId_createdAt_idx" ON "MapDoodle"("userId", "createdAt");
