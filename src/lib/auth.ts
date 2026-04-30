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
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value || cookieStore.get(LEGACY_SESSION_COOKIE)?.value;

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

export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
  });

  if (!user || user.isSuspended) return null;

  return user;
}

export async function getCurrentUserRedirectState() {
  const session = await getSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      onboarded: true,
      isSuspended: true,
    },
  });

  if (!user || user.isSuspended) return null;

  return {
    id: user.id,
    onboarded: user.onboarded,
  };
}

export async function destroySession() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value || cookieStore.get(LEGACY_SESSION_COOKIE)?.value;

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

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
