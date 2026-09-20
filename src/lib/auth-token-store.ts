import "server-only";

import { prisma } from "./prisma";

/** Consume the token, replace the password, and revoke sessions as one write. */
export async function consumePasswordResetToken(userId: string, tokenHash: string, passwordHash: string) {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.user.updateMany({
      where: { id: userId, resetToken: tokenHash, resetTokenExpiry: { gt: new Date() } },
      data: { passwordHash, resetToken: null, resetTokenExpiry: null },
    });
    if (claimed.count !== 1) return false;
    await tx.session.deleteMany({ where: { userId } });
    return true;
  });
}

/** A login that verified an old password cannot create a session after rotation. */
export async function createPasswordSessionRecord(userId: string, passwordHash: string, sessionId: string, expiresAt: Date) {
  const inserted = await prisma.$executeRaw`
    INSERT INTO "Session" ("id", "userId", "expiresAt", "createdAt")
    SELECT ${sessionId}, "id", ${expiresAt}, ${new Date()}
    FROM "User"
    WHERE "id" = ${userId} AND "passwordHash" = ${passwordHash} AND "isSuspended" = 0
  `;
  return inserted === 1;
}

/** Reauthentication must still match when the password change reaches storage. */
export async function replaceAccountPassword(userId: string, previousHash: string, passwordHash: string) {
  return prisma.$transaction(async (tx) => {
    const changed = await tx.user.updateMany({
      where: { id: userId, passwordHash: previousHash, isSuspended: false },
      data: { passwordHash, resetToken: null, resetTokenExpiry: null },
    });
    if (changed.count !== 1) return false;
    await tx.session.deleteMany({ where: { userId } });
    return true;
  });
}

/** Ownership is checked again inside the same transaction that consumes the link. */
export async function consumeEmailVerificationToken(tokenHash: string) {
  return prisma.$transaction(async (tx) => {
    const token = await tx.emailVerificationToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { email: true } } },
    });
    if (!token || token.consumedAt || token.expiresAt <= new Date()) {
      return { error: "Invalid or expired verification link. Please request a new one." };
    }

    const email = token.email.trim().toLowerCase();
    const isPrimary = token.user.email.toLowerCase() === email;
    const emailRecord = await tx.userEmail.findUnique({ where: { email } });
    if (emailRecord && emailRecord.userId !== token.userId) {
      return { error: "This email is already connected to another account." };
    }
    // Removing a secondary email must also remove the authority of its old links.
    if (!isPrimary && !emailRecord) {
      return { error: "This email is no longer connected to your account. Please request a new verification link." };
    }

    const claimed = await tx.emailVerificationToken.updateMany({
      where: { id: token.id, consumedAt: null, expiresAt: { gt: new Date() } },
      data: { consumedAt: new Date() },
    });
    if (claimed.count !== 1) {
      return { error: "Invalid or expired verification link. Please request a new one." };
    }

    if (isPrimary) {
      await tx.user.update({ where: { id: token.userId }, data: { emailVerified: true } });
    }
    if (emailRecord) {
      await tx.userEmail.update({
        where: { id: emailRecord.id },
        data: { isVerified: true, isPrimary: emailRecord.isPrimary || isPrimary },
      });
    } else {
      // Legacy primary addresses may predate UserEmail records. Only the user's
      // current primary address may be materialized after proving mailbox access.
      await tx.userEmail.create({
        data: { userId: token.userId, email, isPrimary: true, isVerified: true },
      });
    }
    return { success: true, email };
  });
}
