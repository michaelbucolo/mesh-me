import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";
import { isSameOriginRequest } from "@/lib/request-guard";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
};

export async function GET(request: Request) {
  await destroySession();
  return NextResponse.redirect(new URL("/login?signedOut=1", request.url));
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403, headers: NO_STORE_HEADERS });
  }

  await destroySession();
  return NextResponse.json({ success: true }, { headers: NO_STORE_HEADERS });
}
