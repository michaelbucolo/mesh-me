-- Source-aware MeChat messages and call/session state for shared browsing.

ALTER TABLE "Message" ADD COLUMN "sourcePlatform" TEXT NOT NULL DEFAULT 'mesh';
ALTER TABLE "Message" ADD COLUMN "messageType" TEXT NOT NULL DEFAULT 'text';
ALTER TABLE "Message" ADD COLUMN "sourceUrl" TEXT;
ALTER TABLE "Message" ADD COLUMN "sourcePostId" TEXT;
ALTER TABLE "Message" ADD COLUMN "platformPostId" TEXT;
ALTER TABLE "Message" ADD COLUMN "platformCommentId" TEXT;
ALTER TABLE "Message" ADD COLUMN "metadata" TEXT;

ALTER TABLE "MeChatSession" ADD COLUMN "sessionType" TEXT NOT NULL DEFAULT 'co_browse';
ALTER TABLE "MeChatSession" ADD COLUMN "callMode" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "MeChatSession" ADD COLUMN "callStatus" TEXT NOT NULL DEFAULT 'idle';
ALTER TABLE "MeChatSession" ADD COLUMN "callStartedAt" DATETIME;
ALTER TABLE "MeChatSession" ADD COLUMN "callEndedAt" DATETIME;

CREATE INDEX "Message_sourcePlatform_idx" ON "Message"("sourcePlatform");
CREATE INDEX "Message_platformPostId_idx" ON "Message"("platformPostId");
CREATE INDEX "Message_platformCommentId_idx" ON "Message"("platformCommentId");
