-- CreateTable
CREATE TABLE "UserLocation" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "precision" TEXT NOT NULL DEFAULT 'town',
    "audience" TEXT NOT NULL DEFAULT 'nobody',
    "reportedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserLocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "UserLocation_reportedAt_idx" ON "UserLocation"("reportedAt");
