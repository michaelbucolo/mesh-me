// Shared teardown for a connected account, used by the interactive disconnect
// route and by Meta's deauthorize / data-deletion callbacks.
//
// Meta identifies the user only by the platform-issued `user_id`, so these
// helpers operate by (platform, platformId) rather than by our internal id.

import { createHmac } from "crypto";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "./prisma";
import { OAUTH_CONFIGS, isPlatformOAuth, revokeOAuthToken } from "./oauth";
import { decryptSecret } from "./secret-store";
import { clearMeshCache } from "./mesh-cache";

// The Meta products that share a data-deletion / deauthorize surface.
const META_PLATFORMS = ["facebook", "instagram", "threads"] as const;

async function tearDownAccount(accountId: string, userId: string, platform: string, encryptedAccessToken: string | null) {
  // Best-effort provider revoke. decryptSecret throws on malformed ciphertext or
  // after an encryption-key rotation (AES-GCM auth failure); that must never stop
  // the DB teardown below, or a data-deletion request would be acknowledged while
  // the account is silently retained.
  try {
    if (isPlatformOAuth(platform) && encryptedAccessToken) {
      const config = OAUTH_CONFIGS[platform];
      if (config.revokeUrl) {
        const accessToken = decryptSecret(encryptedAccessToken);
        if (accessToken) {
          await revokeOAuthToken(config, accessToken).catch(() => false);
        }
      }
    }
  } catch {
    // Token unreadable/unrevocable — proceed with deletion regardless.
  }

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.platformPermission.deleteMany({ where: { userId, connectedAccountId: accountId } });
    await tx.connectedAccount.delete({ where: { id: accountId } });
  });

  clearMeshCache(userId);
}

// Remove every connected account matching a platform-issued user id across the
// given platforms. Returns the number of accounts removed. Errors on any single
// account are swallowed so one failure does not abort the batch — the caller
// still needs to acknowledge Meta's request.
export async function deleteConnectedAccountsByPlatformId(
  platformId: string,
  platforms: readonly string[] = META_PLATFORMS,
): Promise<number> {
  if (!platformId) return 0;

  const accounts = await prisma.connectedAccount.findMany({
    where: { platformId, platform: { in: [...platforms] } },
    select: { id: true, userId: true, platform: true, accessToken: true },
  });

  let removed = 0;
  for (const account of accounts) {
    try {
      await tearDownAccount(account.id, account.userId, account.platform, account.accessToken);
      removed += 1;
    } catch {
      // Keep going; a partial failure must not block acknowledging the request.
    }
  }
  return removed;
}

// A stable, non-guessable confirmation code Meta can display and the user can
// quote when checking deletion status. Derived from an app secret so it needs
// no persistence, yet cannot be forged by a third party.
export function buildDeletionConfirmationCode(platformId: string, secret: string): string {
  return createHmac("sha256", secret).update(`data-deletion:${platformId}`).digest("hex").slice(0, 24);
}
