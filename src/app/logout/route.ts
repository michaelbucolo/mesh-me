import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";
import { isCrossSiteRequest } from "@/lib/request-guard";

export const dynamic = "force-dynamic";

async function logout(request: Request) {
  await destroySession();
  return NextResponse.redirect(new URL("/login?signedOut=1", request.url));
}

export async function GET(request: Request) {
  if (isCrossSiteRequest(request)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return logout(request);
}

export async function POST(request: Request) {
  return logout(request);
}
