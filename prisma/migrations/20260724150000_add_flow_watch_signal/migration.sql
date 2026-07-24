-- Watch signal for Reels-style ranking: accumulated on-screen ms and best
-- video completion per impression.
ALTER TABLE "FlowImpression" ADD COLUMN "watchMs" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "FlowImpression" ADD COLUMN "completion" REAL NOT NULL DEFAULT 0;
