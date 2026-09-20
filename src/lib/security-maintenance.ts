import "server-only";
import { prisma } from "./prisma";

/** Expired credentials only. Content, accounts and active sessions are retained. */
export async function pruneExpiredSecurityData(now = new Date()) {
  if (!Number.isFinite(now.getTime())) throw new Error("Invalid maintenance time");
  // Historical Prisma SQLite writes can be Unix milliseconds while the current
  // libSQL adapter writes ISO text. SQLite compares numbers before text, so a
  // plain <= Date query could remove a future numeric session. Normalize each
  // supported representation; unknown text stays untouched.
  const nowMs = now.getTime();
  const [sessions, verificationTokens, passwordResetTokens] = await prisma.$transaction([
    prisma.$executeRaw`DELETE FROM "Session" WHERE
      (typeof("expiresAt") IN ('integer', 'real') AND "expiresAt" <= ${nowMs}) OR
      (typeof("expiresAt") = 'text' AND julianday("expiresAt") <= julianday(${now}))`,
    prisma.$executeRaw`DELETE FROM "EmailVerificationToken" WHERE
      (typeof("expiresAt") IN ('integer', 'real') AND "expiresAt" <= ${nowMs}) OR
      (typeof("expiresAt") = 'text' AND julianday("expiresAt") <= julianday(${now}))`,
    prisma.$executeRaw`UPDATE "User" SET "resetToken" = NULL, "resetTokenExpiry" = NULL, "updatedAt" = ${now} WHERE
      (typeof("resetTokenExpiry") IN ('integer', 'real') AND "resetTokenExpiry" <= ${nowMs}) OR
      (typeof("resetTokenExpiry") = 'text' AND julianday("resetTokenExpiry") <= julianday(${now}))`,
  ]);
  return {
    sessions,
    verificationTokens,
    passwordResetTokens,
  };
}
