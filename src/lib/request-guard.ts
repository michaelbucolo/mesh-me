export function isSameOriginRequest(req: Request): boolean {
  const host = req.headers.get("host");
  if (!host) return false;

  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite)) {
    return false;
  }

  const origin = req.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host.toLowerCase() === host.toLowerCase();
    } catch {
      return false;
    }
  }

  const referer = req.headers.get("referer");
  if (!referer) return false;

  try {
    return new URL(referer).host.toLowerCase() === host.toLowerCase();
  } catch {
    return false;
  }
}

// Body-size ceilings. JSON mutations are small text payloads; form bodies must
// accommodate the largest upload (banner, 4MB) plus multipart overhead. The
// Content-Length check rejects oversized bodies before we buffer/parse them, so
// a client can't force the server to spool a 100MB body into memory first.
const MAX_JSON_BODY_BYTES = 512 * 1024;
const MAX_FORM_BODY_BYTES = 6 * 1024 * 1024;

function exceedsContentLength(req: Request, limit: number): boolean {
  const header = req.headers.get("content-length");
  if (!header) return false;
  const length = Number.parseInt(header, 10);
  return Number.isFinite(length) && length > limit;
}

export async function readJsonObject(req: Request): Promise<Record<string, unknown>> {
  if (exceedsContentLength(req, MAX_JSON_BODY_BYTES)) return {};
  try {
    const parsed = await req.json();
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // fall through to empty object
  }
  return {};
}

export async function readFormData(req: Request): Promise<FormData | null> {
  if (exceedsContentLength(req, MAX_FORM_BODY_BYTES)) return null;
  try {
    return await req.formData();
  } catch {
    return null;
  }
}

// Validate a caller-supplied post-auth redirect target. Returns a same-origin
// path (pathname+search+hash) or null. Parsing against `baseOrigin` is what
// makes this safe: the WHATWG URL parser normalizes backslashes to slashes for
// http(s), so a raw `startsWith("//")` check misses `/\evil.com` — but the
// resulting origin won't match ours, so the origin comparison rejects it.
export function safeInternalPath(value: string | null | undefined, baseOrigin: string): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || !trimmed.startsWith("/")) return null;

  try {
    const parsed = new URL(trimmed, baseOrigin);
    if (parsed.origin !== baseOrigin) return null;
    if (parsed.pathname === "/login" || parsed.pathname === "/signup" || parsed.pathname === "/reset-password") {
      return null;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

export function isCrossSiteRequest(req: Request): boolean {
  const host = req.headers.get("host");
  if (!host) return true;

  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") return true;

  const origin = req.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host.toLowerCase() !== host.toLowerCase();
    } catch {
      return true;
    }
  }

  const referer = req.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).host.toLowerCase() !== host.toLowerCase();
    } catch {
      return true;
    }
  }

  return false;
}
