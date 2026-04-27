import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getCachedSuperAppReadinessReport } from "@/lib/super-app-readiness";

function jsonNoStore(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      ...(init?.headers ?? {}),
    },
  });
}

function isSameOriginRequest(req: NextRequest): boolean {
  const host = req.headers.get("host");
  if (!host) return false;

  const origin = req.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }

  const referer = req.headers.get("referer");
  if (!referer) return false;
  try {
    return new URL(referer).host === host;
  } catch {
    return false;
  }
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return jsonNoStore({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const report = await getCachedSuperAppReadinessReport(user.id);
    return jsonNoStore(report);
  } catch {
    return jsonNoStore({ error: "Unable to calculate super-app readiness" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isSameOriginRequest(req)) {
    return jsonNoStore({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return jsonNoStore({ error: "Not authenticated" }, { status: 401 });
  }

  const payload = await req.json().catch(() => ({}));
  if (payload?.action !== "refresh") {
    return jsonNoStore({ error: "Unsupported action" }, { status: 400 });
  }

  revalidateTag(`super-app-readiness:${user.id}`, "max");

  const report = await getCachedSuperAppReadinessReport(user.id);
  return jsonNoStore(report);
}
