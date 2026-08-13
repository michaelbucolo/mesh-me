import "server-only";

// PERSONAL ACCESS TOKENS — the hash, never the secret.
//
// The design's spine, in three sentences:
//
//   A PAT is only ever RECOGNIZED, never replayed upstream — so it is
//   HASHED, not encrypted. encryptSecret exists for OAuth tokens mesh.me
//   must present to other platforms; using it here would make a database
//   dump plus APP_DATA_ENCRYPTION_KEY a credential-recovery kit.
//
//   The token is selector.verifier: the selector is an INDEPENDENT random
//   handle (plaintext, unique, doubles as the UI fingerprint) revealing
//   zero verifier bits, and only sha256(verifier) is stored. Looking up by
//   selector and then constant-time-comparing the hash is what makes
//   timingSafeEqual do real work — fetching by hash and comparing after
//   would be tautological theater.
//
//   Revocation is deletion (the withdrawMeshiJournal law: off = deleted,
//   never hidden) and nothing about a token is ever cached, so revocation,
//   suspension, and consent withdrawal are next-request-effective by
//   construction.
//
// This module is the ONLY reader/writer of the PersonalAccessToken table
// (pat-check §1 ratchets that).

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sanitizeForDisplay } from "@/lib/security";

const PAT_SCOPES = ["profile:read", "posts:read", "imported:read", "analytics:read", "journal:read"] as const;
export type PatScope = (typeof PAT_SCOPES)[number];

const PAT_EXPIRY_DAYS = [7, 30, 90, 365] as const;
const PAT_DEFAULT_EXPIRY_DAYS = 90;
const PAT_MAX_ACTIVE = 10;

/** Published in the docs so people can self-scan their repos and logs. */
export const PAT_SHAPE = /^mesh_pat_[A-Za-z0-9_-]{12}\.[A-Za-z0-9_-]{43}$/;

const NAME_MAX = 64;

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function parsePatScopes(raw: unknown): PatScope[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((s): s is PatScope => (PAT_SCOPES as readonly string[]).includes(String(s))))];
}

/**
 * Mint. The full token string exists exactly once, in this return value —
 * the row stores the selector and the verifier's hash, nothing recoverable.
 * Expiry is mandatory: every token dies, renewal is a re-mint, extension
 * does not exist.
 */
export async function mintPersonalAccessToken(
  userId: string,
  input: { name: string; scopes: PatScope[]; expiryDays?: number },
): Promise<{ token: string; id: string; selector: string; expiresAt: Date } | { error: string }> {
  const name = sanitizeForDisplay(String(input.name ?? "").trim()).slice(0, NAME_MAX).trim();
  if (!name) return { error: "Name the token — future you needs to know which script this is." };
  if (input.scopes.length === 0) return { error: "Pick at least one scope." };

  const expiryDays = input.expiryDays ?? PAT_DEFAULT_EXPIRY_DAYS;
  if (!(PAT_EXPIRY_DAYS as readonly number[]).includes(expiryDays)) {
    return { error: "Expiry must be 7, 30, 90, or 365 days — every token dies." };
  }

  const active = await prisma.personalAccessToken.count({
    where: { userId, expiresAt: { gt: new Date() } },
  });
  if (active >= PAT_MAX_ACTIVE) {
    return { error: "Ten live tokens is the ceiling — revoke one you're not using first." };
  }

  const selector = randomBytes(9).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

  const row = await prisma.personalAccessToken.create({
    data: {
      userId,
      name,
      selector,
      verifierHash: sha256Hex(verifier),
      scopes: input.scopes.join(" "),
      expiresAt,
    },
    select: { id: true, selector: true, expiresAt: true },
  });

  return { token: `mesh_pat_${selector}.${verifier}`, id: row.id, selector: row.selector, expiresAt: row.expiresAt };
}

export type VerifiedPat = {
  tokenId: string;
  userId: string;
  scopes: PatScope[];
};

/**
 * Verification, ordered and fail-closed at every step. Malformed input is
 * refused by shape BEFORE any database read (no enumeration, no load).
 * Both hash buffers are 32 bytes by construction, so the length-mismatch
 * throw cron-secret.ts documents cannot fire here. Nothing is cached:
 * revocation (deletion), expiry, suspension, and account merges are
 * next-request-effective because every request walks this whole path.
 */
export async function verifyPersonalAccessToken(authorization: string | null): Promise<VerifiedPat | null> {
  const presented = (authorization ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!PAT_SHAPE.test(presented)) return null;

  const [selector, verifier] = presented.slice("mesh_pat_".length).split(".");
  const row = await prisma.personalAccessToken.findUnique({
    where: { selector },
    select: {
      id: true,
      verifierHash: true,
      scopes: true,
      expiresAt: true,
      lastUsedAt: true,
      user: { select: { id: true, isSuspended: true, mergedIntoUserId: true } },
    },
  });
  if (!row) return null;

  const presentedHash = Buffer.from(sha256Hex(verifier), "hex");
  const storedHash = Buffer.from(row.verifierHash, "hex");
  if (presentedHash.length !== storedHash.length || !timingSafeEqual(presentedHash, storedHash)) return null;

  if (row.expiresAt.getTime() <= Date.now()) return null;
  // Suspension freezes tokens without deleting them; a merged account's
  // tombstone refuses too (belt — merged accounts also stay suspended).
  if (!row.user || row.user.isSuspended || row.user.mergedIntoUserId) return null;

  // Best-effort, coalesced: at most one write per 5 minutes per token, and
  // a failed write must never fail the request.
  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > 5 * 60 * 1000) {
    prisma.personalAccessToken
      .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
      .catch(() => {});
  }

  return { tokenId: row.id, userId: row.user.id, scopes: parsePatScopes(row.scopes.split(" ")) };
}

/** The index route's self-description: what THIS token is, nothing more. */
export async function introspectPersonalAccessToken(tokenId: string) {
  return prisma.personalAccessToken.findUnique({
    where: { id: tokenId },
    select: { name: true, selector: true, scopes: true, createdAt: true, expiresAt: true },
  });
}

/** The panel's list: fingerprints and facts, never anything recoverable. */
export async function listPersonalAccessTokens(userId: string) {
  return prisma.personalAccessToken.findMany({
    where: { userId },
    select: { id: true, name: true, selector: true, scopes: true, createdAt: true, expiresAt: true, lastUsedAt: true },
    orderBy: { createdAt: "desc" },
  });
}

/** Revocation is deletion — no tombstone, no state for a bug to resurrect.
 *  Anything using the token stops working on its next request. */
export async function revokePersonalAccessToken(userId: string, tokenId: string): Promise<boolean> {
  const removed = await prisma.personalAccessToken.deleteMany({ where: { id: tokenId, userId } });
  return removed.count === 1;
}

export async function renamePersonalAccessToken(userId: string, tokenId: string, name: string): Promise<boolean> {
  const clean = sanitizeForDisplay(String(name ?? "").trim()).slice(0, NAME_MAX).trim();
  if (!clean) return false;
  const updated = await prisma.personalAccessToken.updateMany({
    where: { id: tokenId, userId },
    data: { name: clean },
  });
  return updated.count === 1;
}
