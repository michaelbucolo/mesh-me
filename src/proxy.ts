import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "__Host-mesh_session";
const LEGACY_SESSION_COOKIE = "mesh_session";
const SESSION_ID_REGEX = /^(?:[0-9a-f]{64}|[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;
const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const proxyRateLimitStore = new Map<string, { count: number; resetAt: number }>();

// NOTE: /explore, /flow, and /feed are intentionally absent — guests may
// browse content surfaces. The (app) layout decides per-path whether an
// anonymous visitor gets the guest shell or a login redirect.
const protectedPagePrefixes = [
  "/account",
  "/admin",
  "/analytics",
  "/billing",
  "/communities",
  "/connected-accounts",
  "/content-hub",
  "/feature-requests",
  "/feedback",
  "/innovation",
  "/marketplace",
  "/mesh",
  "/meshi-voice",
  "/meshpro",
  "/messages",
  "/notifications",
  "/onboarding",
  "/privacy-controls",
  "/profile",
  "/search",
  "/settings",
  "/spaces",
  "/super-app",
  "/vault",
];

const protectedApiPrefixes = [
  "/api/account",
  "/api/avatar",
  "/api/banner",
  "/api/communities",
  "/api/connected-accounts",
  "/api/data-controls",
  "/api/explore",
  "/api/feature-requests",
  "/api/feed",
  "/api/feedback",
  "/api/layout",
  "/api/mechat",
  "/api/mesh",
  "/api/meshi",
  "/api/messages",
  "/api/notifications",
  "/api/platform-content",
  "/api/search",
  "/api/security-hub",
  "/api/settings",
  "/api/status",
  "/api/stripe/checkout",
  "/api/stripe/portal",
  "/api/super-app",
  "/api/sync",
  "/api/users",
  "/api/vault",
];

function isLocalHost(host: string): boolean {
  return host.startsWith("localhost") || host.startsWith("127.0.0.1") || host.startsWith("[::1]");
}

function pathMatchesPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function hasSessionCookie(request: NextRequest) {
  const sessionId = request.cookies.get(SESSION_COOKIE)?.value || request.cookies.get(LEGACY_SESSION_COOKIE)?.value;
  return Boolean(sessionId && SESSION_ID_REGEX.test(sessionId));
}

function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || request.headers.get("x-real-ip") || "unknown";
}

function checkProxyRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): { allowed: boolean; retryAfterSeconds: number; remaining: number } {
  const now = Date.now();
  for (const [storedKey, entry] of proxyRateLimitStore.entries()) {
    if (entry.resetAt <= now) proxyRateLimitStore.delete(storedKey);
  }

  const entry = proxyRateLimitStore.get(key);
  if (!entry || entry.resetAt <= now) {
    proxyRateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: Math.ceil(windowMs / 1000), remaining: maxRequests - 1 };
  }

  if (entry.count >= maxRequests) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
      remaining: 0,
    };
  }

  entry.count += 1;
  return {
    allowed: true,
    retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    remaining: maxRequests - entry.count,
  };
}

function protectedApiLimitFor(pathname: string, method: string) {
  if (pathname.startsWith("/api/mesh/presence")) return { maxRequests: 180, windowMs: 60 * 1000 };
  if (pathname.startsWith("/api/search")) return { maxRequests: 80, windowMs: 60 * 1000 };
  if (pathname.startsWith("/api/sync") || pathname.includes("/sync")) return { maxRequests: 12, windowMs: 60 * 1000 };
  if (pathname.startsWith("/api/stripe")) return { maxRequests: 20, windowMs: 60 * 1000 };
  if (MUTATION_METHODS.has(method)) return { maxRequests: 60, windowMs: 60 * 1000 };
  return { maxRequests: 240, windowMs: 60 * 1000 };
}

function isSameOriginMutation(request: NextRequest) {
  const host = request.headers.get("host");
  if (!host) return false;

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite)) return false;

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host.toLowerCase() === host.toLowerCase();
    } catch {
      return false;
    }
  }

  const referer = request.headers.get("referer");
  if (!referer) return false;

  try {
    return new URL(referer).host.toLowerCase() === host.toLowerCase();
  } catch {
    return false;
  }
}

function isCrossSiteRequest(request: NextRequest) {
  const host = request.headers.get("host");
  if (!host) return true;

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") return true;

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host.toLowerCase() !== host.toLowerCase();
    } catch {
      return true;
    }
  }

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).host.toLowerCase() !== host.toLowerCase();
    } catch {
      return true;
    }
  }

  return false;
}

function hardenResponse(response: NextResponse, options: { sensitive?: boolean; noRobots?: boolean } = {}) {
  response.headers.set("X-Mesh-Trust", "privacy-first; transparency-on; security-hardened");
  response.headers.set("X-Mesh-Compliance", "terms-and-api-usage-required");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "0");
  response.headers.set("Referrer-Policy", "no-referrer");
  // Autoplay + encrypted-media are granted to the video embed players the
  // Flow and mesh hover previews rely on — everything else stays locked down.
  response.headers.set("Permissions-Policy", "accelerometer=(), autoplay=(self \"https://www.youtube-nocookie.com\" \"https://player.vimeo.com\" \"https://clips.twitch.tv\" \"https://player.twitch.tv\" \"https://www.tiktok.com\"), browsing-topics=(), camera=(), clipboard-read=(), display-capture=(), encrypted-media=(self \"https://www.youtube-nocookie.com\" \"https://player.vimeo.com\"), geolocation=(), gyroscope=(), hid=(), interest-cohort=(), magnetometer=(), microphone=(), midi=(), payment=(), publickey-credentials-get=(self), screen-wake-lock=(), serial=(), sync-xhr=(), usb=(), xr-spatial-tracking=()");
  response.headers.set("X-DNS-Prefetch-Control", "off");
  response.headers.set("X-Download-Options", "noopen");
  response.headers.set("X-Permitted-Cross-Domain-Policies", "none");
  if (options.sensitive) {
    response.headers.set("Cache-Control", "no-store, max-age=0, must-revalidate, private");
    response.headers.set("Pragma", "no-cache");
  }
  // Robots suppression is separate from cache sensitivity: some pages must not
  // be cached yet should still be indexed (e.g. /signup, which the sitemap
  // submits). Defaults to the sensitive flag so existing callers are unchanged.
  const noRobots = options.noRobots ?? options.sensitive;
  if (noRobots) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }
  return response;
}

export function proxy(request: NextRequest) {
  const host = request.headers.get("host") || "";
  const proto = request.headers.get("x-forwarded-proto") || request.nextUrl.protocol.replace(":", "");
  const pathname = request.nextUrl.pathname;
  const returnPath = `${pathname}${request.nextUrl.search}`;

  if (!isLocalHost(host) && proto === "http") {
    const secureUrl = new URL(request.url);
    secureUrl.protocol = "https:";
    return hardenResponse(NextResponse.redirect(secureUrl, 308));
  }

  if (pathname === "/" && hasSessionCookie(request)) {
    return hardenResponse(NextResponse.redirect(new URL("/mesh", request.url), 307), { sensitive: true });
  }

  const isProtectedApi = pathMatchesPrefix(pathname, protectedApiPrefixes);
  const isProtectedPage = pathMatchesPrefix(pathname, protectedPagePrefixes);

  if (isProtectedApi) {
    const limit = protectedApiLimitFor(pathname, request.method);
    const clientIp = getClientIp(request);
    const bucket = checkProxyRateLimit(`${clientIp}:${request.method}:${pathname}`, limit.maxRequests, limit.windowMs);
    if (!bucket.allowed) {
      const response = NextResponse.json({ error: "Too many requests" }, { status: 429 });
      response.headers.set("Retry-After", String(bucket.retryAfterSeconds));
      response.headers.set("RateLimit-Limit", String(limit.maxRequests));
      response.headers.set("RateLimit-Remaining", "0");
      response.headers.set("RateLimit-Reset", String(bucket.retryAfterSeconds));
      return hardenResponse(response, { sensitive: true });
    }
  }

  if (isProtectedApi && isCrossSiteRequest(request)) {
    return hardenResponse(NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 }), { sensitive: true });
  }

  if (isProtectedApi && MUTATION_METHODS.has(request.method) && !isSameOriginMutation(request)) {
    return hardenResponse(NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 }), { sensitive: true });
  }

  if (isProtectedApi && !hasSessionCookie(request)) {
    return hardenResponse(NextResponse.json({ error: "Not authenticated" }, { status: 401 }), { sensitive: true });
  }

  if (isProtectedPage && !hasSessionCookie(request)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", returnPath);
    return hardenResponse(NextResponse.redirect(loginUrl, 307), { sensitive: true });
  }

  const requestHeaders = new Headers(request.headers);
  // Every page render gets its true path (guest shells and login redirects
  // both key off it); always overwritten here so it can't be spoofed.
  if (!pathname.startsWith("/api/")) {
    requestHeaders.set("x-mesh-current-path", returnPath);
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  const sensitive = isProtectedApi || isProtectedPage || pathname === "/login" || pathname === "/signup" || pathname === "/reset-password" || pathname === "/verify-email";
  // /signup is a public marketing landing page listed in the sitemap, so keep it
  // out of no-store-only robots suppression while every other auth/app surface
  // stays noindexed.
  return hardenResponse(response, { sensitive, noRobots: sensitive && pathname !== "/signup" });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
