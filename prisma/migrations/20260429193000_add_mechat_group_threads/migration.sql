-- Upgrade MeChat threads so the inbox can represent WhatsApp/WeChat-style groups
-- while preserving direct-message behavior for existing conversations.
ALTER TABLE "MessageThread" ADD COLUMN "title" TEXT;
ALTER TABLE "MessageThread" ADD COLUMN "threadType" TEXT NOT NULL DEFAULT 'direct';
ALTER TABLE "MessageThread" ADD COLUMN "sourcePlatform" TEXT NOT NULL DEFAULT 'mesh';
ALTER TABLE "MessageThread" ADD COLUMN "isEncrypted" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "ThreadMember" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'member';
ALTER TABLE "ThreadMember" ADD COLUMN "notificationsMuted" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "MessageThread_threadType_idx" ON "MessageThread"("threadType");
CREATE INDEX "ThreadMember_role_idx" ON "ThreadMember"("role");
