-- Viewer-side muted mesh sources: a private JSON list of "author:{userId}" /
-- "account:{connectedAccountId}" keys on the viewer's own feed preferences.
-- Muting only subtracts from THIS viewer's mesh + Flow — never from others.
ALTER TABLE "FeedPreference" ADD COLUMN "mutedSources" TEXT NOT NULL DEFAULT '[]';
