import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";
import { isSameOriginRequest } from "@/lib/request-guard";

export const dynamic = "force-dynamic";

async function logout(request: Request) {
  await destroySession();
  return NextResponse.redirect(new URL("/login?signedOut=1", request.url));
}

// Session destruction is state-changing, so the GET path uses the same
// fail-closed same-origin proof as POST: a request without any origin evidence
// (e.g. a cross-site <img> with referrer suppressed) must not log the user out.
export async function GET(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return logout(request);
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return logout(request);
}
