import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function isLocalHost(host: string): boolean {
  return host.startsWith("localhost") || host.startsWith("127.0.0.1") || host.startsWith("[::1]");
}

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") || "";
  const proto = request.headers.get("x-forwarded-proto") || request.nextUrl.protocol.replace(":", "");

  // Enforce HTTPS in production-style deployments while allowing local development.
  if (!isLocalHost(host) && proto === "http") {
    const secureUrl = new URL(request.url);
    secureUrl.protocol = "https:";
    return NextResponse.redirect(secureUrl, 308);
  }

  const response = NextResponse.next();
  response.headers.set("X-Mesh-Trust", "privacy-first; transparency-on; security-hardened");
  response.headers.set("X-Mesh-Compliance", "terms-and-api-usage-required");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};

