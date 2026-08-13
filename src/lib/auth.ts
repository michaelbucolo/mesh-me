import { cache } from "react";
import { isFounderUsername, isMeshProGiftActive } from "@/lib/mesh-pro";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { cookies } from "next/headers";

const SESSION_COOKIE = "__Host-mesh_session";
const LEGACY_SESSION_COOKIE = "mesh_session";
const SESSION_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days
const SESSION_ID_REGEX = /^(?:[0-9a-f]{64}|[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;

function activeSessionCookieName() {
  return process.env.NODE_ENV === "production" ? SESSION_COOKIE : LEGACY_SESSION_COOKIE;
}

// Read the session id from cookies. The unprefixed legacy cookie is only
// trusted outside production: the `__Host-` prefix is the browser's guarantee
// that the cookie was set Secure, Path=/, and host-only (no Domain), so an HTTP
// MITM or a sibling subdomain can't write it. Accepting the unprefixed fallback
// in production would void that guarantee and enable session fixation, so in
// production we read the prefixed cookie only.
function readSessionId(cookieStore: Awaited<ReturnType<typeof cookies>>): string | undefined {
  const primary = cookieStore.get(SESSION_COOKIE)?.value;
  if (primary) return primary;
  if (process.env.NODE_ENV !== "production") {
    return cookieStore.get(LEGACY_SESSION_COOKIE)?.value;
  }
  return undefined;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string): Promise<string> {
  const sessionId = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE);

  // Store session in database (works on serverless/Vercel)
  await prisma.session.create({
    data: {
      id: sessionId,
      userId,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  const cookieName = activeSessionCookieName();
  cookieStore.set(cookieName, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE / 1000,
    path: "/",
  });

  cookieStore.delete(cookieName === SESSION_COOKIE ? LEGACY_SESSION_COOKIE : SESSION_COOKIE);

  return sessionId;
}

export async function getSession() {
  const cookieStore = await cookies();
  const sessionId = readSessionId(cookieStore);

  if (!sessionId) return null;
  if (!SESSION_ID_REGEX.test(sessionId)) {
    await clearSessionCookiesBestEffort();
    return null;
  }

  // Look up session in database
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    await clearSessionCookiesBestEffort();
    return null;
  }

  if (session.expiresAt < new Date()) {
    // Clean up expired session
    await prisma.session.delete({ where: { id: sessionId } }).catch(() => {});
    await clearSessionCookiesBestEffort();
    return null;
  }

  return { userId: session.userId, expiresAt: session.expiresAt };
}

export const getCurrentUser = cache(async () => {
  // One round trip for session + user — this runs on every request, and each
  // extra query is a full network hop to the remote database in production.
  const cookieStore = await cookies();
  const sessionId = readSessionId(cookieStore);
  if (!sessionId) return null;
  if (!SESSION_ID_REGEX.test(sessionId)) {
    await clearSessionCookiesBestEffort();
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    // This runs on every authenticated request. bannerUrl holds a base64 data
    // URL up to ~4MB and is only ever read on the profile/community pages from
    // their own queries — never off the session user — so omit it here to keep
    // multi-megabyte payloads off the auth hot path. (If a caller ever needs the
    // current user's banner, tsc will flag the missing field.)
    include: { user: { omit: { bannerUrl: true } } },
  });

  if (!session) {
    await clearSessionCookiesBestEffort();
    return null;
  }
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: sessionId } }).catch(() => {});
    await clearSessionCookiesBestEffort();
    return null;
  }

  const user = session.user;
  if (!user || user.isSuspended) return null;

  // Founder accounts carry MeshPro for life, and a gifted window carries it
  // until it expires. Resolved here, at the one place every authenticated
  // request loads its user, so nothing downstream has to remember — see
  // FOUNDER_USERNAMES in lib/mesh-pro.ts for why founder status is derived
  // rather than a row, and User.meshProGiftUntil for why a gift lives outside
  // the isMeshPro column entirely. Every raw `user.isMeshPro` read of the
  // SESSION user in the codebase leans on this patch (founder-pro-check §6
  // exempts them for exactly that reason), so a new entitlement leg that is
  // not resolved here would silently read as free everywhere.
  if (!user.isMeshPro) {
    if (isFounderUsername(user.username)) {
      return { ...user, isMeshPro: true, meshProSince: user.meshProSince ?? user.createdAt };
    }
    if (isMeshProGiftActive(user.meshProGiftUntil)) {
      return { ...user, isMeshPro: true };
    }
  }
  return user;
});

export async function getCurrentUserRedirectState() {
  // Piggybacks on the cached getCurrentUser: one session+user round trip at
  // most, and zero extra queries on pages whose layout already loaded the user.
  const user = await getCurrentUser();
  if (!user) return null;

  return {
    id: user.id,
    onboarded: user.onboarded,
  };
}

export async function hasSessionCookieHint() {
  // Cookie-presence check only — no database hit. Useful for redirect-only
  // routes where a stale cookie just bounces through the protected page's own
  // auth check.
  const cookieStore = await cookies();
  const sessionId = readSessionId(cookieStore);
  return Boolean(sessionId && SESSION_ID_REGEX.test(sessionId));
}

export async function destroySession() {
  const cookieStore = await cookies();
  const sessionId = readSessionId(cookieStore);

  if (sessionId) {
    await prisma.session.delete({ where: { id: sessionId } }).catch(() => {});
  }

  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(LEGACY_SESSION_COOKIE);
}

async function clearSessionCookiesBestEffort() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE);
    cookieStore.delete(LEGACY_SESSION_COOKIE);
  } catch {
    // No-op in contexts where cookies are read-only.
  }
}

export async function invalidateAllUserSessions(userId: string): Promise<number> {
  const result = await prisma.session.deleteMany({ where: { userId } });
  return result.count;
}
