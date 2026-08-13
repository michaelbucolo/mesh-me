-- AlterTable
ALTER TABLE "OwnedMeshiItem" ADD COLUMN "labelQuietedAt" DATETIME;

-- CreateTable
CREATE TABLE "MeshiRecipe" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hatStyle" TEXT NOT NULL,
    "faceStyle" TEXT NOT NULL,
    "colorTheme" TEXT NOT NULL,
    "hairStyle" TEXT NOT NULL,
    "hairColor" TEXT NOT NULL,
    "accessoryStyle" TEXT NOT NULL,
    "eyeStyle" TEXT NOT NULL,
    "badgeStyle" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MeshiRecipe_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "MeshiRecipe_userId_idx" ON "MeshiRecipe"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MeshiRecipe_userId_name_key" ON "MeshiRecipe"("userId", "name");
