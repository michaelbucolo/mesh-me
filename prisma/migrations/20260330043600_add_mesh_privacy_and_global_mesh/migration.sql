-- CreateTable
CREATE TABLE IF NOT EXISTS "MeshPrivacy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "meshVisibility" TEXT NOT NULL DEFAULT 'friends',
    "branchOverrides" TEXT NOT NULL DEFAULT '{}',
    "showConnections" BOOLEAN NOT NULL DEFAULT true,
    "showStats" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MeshPrivacy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "GlobalMeshMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sharedBranches" TEXT NOT NULL DEFAULT '[]',
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GlobalMeshMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MeshPrivacy_userId_key" ON "MeshPrivacy"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "GlobalMeshMember_userId_key" ON "GlobalMeshMember"("userId");
