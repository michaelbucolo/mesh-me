-- Per-account Ghost Mode. Previously Ghost Mode lived only in localStorage
-- (per-device); persisting it on the User makes it follow the account across
-- devices and lets the server enforce it authoritatively.
ALTER TABLE "User" ADD COLUMN "ghostMode" BOOLEAN NOT NULL DEFAULT false;
