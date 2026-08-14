-- The Return Brief's visit cursor. Nullable: an account that has never pressed
-- "Caught up" gets the 7-day fallback window computed in code.
ALTER TABLE "User" ADD COLUMN "caughtUpAt" DATETIME;
