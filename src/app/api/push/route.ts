import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getVapidPublicKey } from "@/lib/push";
import { isSameOriginRequest, readJsonObject } from "@/lib/request-guard";

// GET — the VAPID public key the browser needs to subscribe. `key: null`
// means push is not configured on this deployment and the client should
// simply not subscribe; that is a state, not an error.
export async function GET() {
  return NextResponse.json({ key: getVapidPublicKey() });
}

type SubscriptionBody = {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
};

function parseSubscription(body: Record<string, unknown>) {
  const { endpoint, keys } = body as SubscriptionBody;
  if (typeof endpoint !== "string" || !endpoint.startsWith("https://") || endpoint.length > 1024) return null;
  const p256dh = keys?.p256dh;
  const auth = keys?.auth;
  if (typeof p256dh !== "string" || typeof auth !== "string") return null;
  if (p256dh.length === 0 || p256dh.length > 256 || auth.length === 0 || auth.length > 256) return null;
  return { endpoint, p256dh, auth };
}

// POST — register this browser's subscription for the signed-in user. The
// endpoint is the natural key: if the same browser subscription was ever
// registered under a different mesh.me login, it moves to the current one —
// a device pushes to whoever is signed in on it, never a previous occupant.
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await readJsonObject(request);
  const subscription = parseSubscription(body);
  if (!subscription) return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });

  const userAgent = request.headers.get("user-agent")?.slice(0, 256) ?? null;
  await prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    create: { userId: user.id, ...subscription, userAgent },
    update: { userId: user.id, p256dh: subscription.p256dh, auth: subscription.auth, userAgent },
  });
  return NextResponse.json({ ok: true });
}

// DELETE — drop this browser's subscription (sign-out, permission revoked).
export async function DELETE(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await readJsonObject(request);
  const endpoint = body.endpoint;
  if (typeof endpoint !== "string" || endpoint.length === 0 || endpoint.length > 1024) {
    return NextResponse.json({ error: "Invalid endpoint" }, { status: 400 });
  }
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } });
  return NextResponse.json({ ok: true });
}
