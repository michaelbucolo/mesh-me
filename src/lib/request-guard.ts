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

// Read the body as text while enforcing `limit` even when Content-Length is
// absent (e.g. chunked/streamed requests): we stop and bail the moment the
// received bytes exceed the ceiling, so an attacker can't omit the header to
// stream an unbounded body into memory. Returns null when the body is too large.
async function readBoundedText(req: Request, limit: number): Promise<string | null> {
  if (exceedsContentLength(req, limit)) return null;

  const body = req.body;
  if (!body) {
    const text = await req.text();
    return new TextEncoder().encode(text).byteLength > limit ? null : text;
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    received += value.byteLength;
    if (received > limit) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

export async function readJsonObject(req: Request): Promise<Record<string, unknown>> {
  const text = await readBoundedText(req, MAX_JSON_BODY_BYTES);
  if (text === null) return {};
  try {
    const parsed = JSON.parse(text);
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
