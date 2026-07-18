-- Composite indexes for the hottest polled queries.
-- Notification: unread badge count (recipientId + read) and the ordered
-- notification page (recipientId ordered by createdAt).
-- Message: the polled "latest N messages in a thread, newest first" window
-- and the unread scan (threadId + createdAt).

-- CreateIndex
CREATE INDEX "Notification_recipientId_read_idx" ON "Notification"("recipientId", "read");

-- CreateIndex
CREATE INDEX "Notification_recipientId_createdAt_idx" ON "Notification"("recipientId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_threadId_createdAt_idx" ON "Message"("threadId", "createdAt");
