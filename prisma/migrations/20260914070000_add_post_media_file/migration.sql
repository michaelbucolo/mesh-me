CREATE TABLE "PostMediaFile" (
    "postMediaId" TEXT NOT NULL PRIMARY KEY,
    "mimeType" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    CONSTRAINT "PostMediaFile_postMediaId_fkey" FOREIGN KEY ("postMediaId") REFERENCES "PostMedia" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
