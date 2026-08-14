import { NextRequest, NextResponse } from "next/server";
import { signInForEntry } from "@/lib/actions";
import { getCurrentUser } from "@/lib/auth";
import { isSameOriginRequest, readJsonObject } from "@/lib/request-guard";

// THE NATIVE APP'S SESSION DOOR.
//
// The website signs in through a Next server action (signInForEntry) — an
// endpoint whose wire format is Next-internal and not a stable contract for a
// URLSession client. This route gives the SwiftUI app (apple/MeshMe) a plain
// JSON surface while riding the EXACT same sign-in: same durable rate limits,
// same escalating lockouts, same enumeration-proof errors, same
// __Host-mesh_session cookie. There is one definition of signing in; this is
// a doorway to it, never a second one.
//
// GET  → who does this session belong to (the app's cold-start restore).
// POST → { identifier, password } → sets the session cookie.
// Sign-out stays at the existing /api/auth/logout POST.

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
};

function safeUser(user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    isVerified: user.isVerified,
    onboarded: user.onboarded,
  };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401, headers: NO_STORE_HEADERS });
  }
  return NextResponse.json({ user: safeUser(user) }, { headers: NO_STORE_HEADERS });
}

export async function POST(request: NextRequest) {
  // Positive same-origin proof, like every write on this backend. Browser
  // requests prove it via forbidden headers; the first-party native app
  // states it explicitly with Origin: https://meshs.me. A cross-SITE page
  // cannot do that, which is the whole point of the check.
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403, headers: NO_STORE_HEADERS });
  }

  const body = await readJsonObject(request);
  const identifier = typeof body.identifier === "string" ? body.identifier : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!identifier || !password) {
    return NextResponse.json({ error: "Identity and password are required" }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const form = new FormData();
  form.set("email", identifier);
  form.set("password", password);
  const result = await signInForEntry(form);

  if (result && "error" in result && result.error) {
    const throttled = /too many|locked/i.test(result.error);
    return NextResponse.json({ error: result.error }, { status: throttled ? 429 : 401, headers: NO_STORE_HEADERS });
  }

  // The cookie is set; the app follows with GET to learn who it is (the
  // just-written cookie is not reliably readable within this same request).
  return NextResponse.json(
    { ok: true, redirectTo: "redirectTo" in result ? result.redirectTo : "/mesh" },
    { headers: NO_STORE_HEADERS },
  );
}
