import { MESH_API_USER_AGENT } from "@/lib/oauth";

/**
 * THE ONLY WAY THIS LAYER TALKS TO A PLATFORM.
 *
 * Lanes never call global `fetch`. They get `ctx.get`, which is this — so
 * every outbound request in the public supply is identifiable, bounded, and
 * incapable of taking a page down with it.
 *
 * WHY BOUNDED MATTERS HERE SPECIFICALLY: this codebase already has a route
 * hitting the 300-second Vercel function ceiling (/api/mesh/presence/stream,
 * 105 times since June). An unbounded fetch inside a request path is exactly
 * how that happens. Every call here has a hard deadline and every failure is
 * contained — a platform being slow or down degrades the Flow's supply, it
 * does not fail the request that touched it.
 *
 * WHY THE USER-AGENT MATTERS: identifying yourself honestly is a term of
 * service on several of these APIs, not a nicety. Reddit in particular
 * requires a descriptive UA and rate-limits anonymous ones harshly.
 * MESH_API_USER_AGENT is the same identity the connected-account sync already
 * uses, so mesh.me is one recognisable client rather than several.
 */

/** Hard ceiling for a single platform call. Nothing here is worth more. */
const TIMEOUT_MS = 8_000;

export class PublicSupplyHttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
    message: string,
  ) {
    super(message);
    this.name = "PublicSupplyHttpError";
  }

  /** 429 and 5xx mean "come back later", not "this lane is broken". */
  get isRetryable() {
    return this.status === 429 || this.status >= 500;
  }
}

/** Strip anything credential-shaped before a URL reaches a log or a database. */
function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    for (const key of [...parsed.searchParams.keys()]) {
      if (/key|token|secret|auth|password|client_id/i.test(key)) {
        parsed.searchParams.set(key, "REDACTED");
      }
    }
    return parsed.toString();
  } catch {
    return "(unparseable url)";
  }
}

export async function publicGet(
  url: string,
  init?: { headers?: Record<string, string> },
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": MESH_API_USER_AGENT,
        Accept: "application/json",
        ...(init?.headers ?? {}),
      },
      signal: controller.signal,
      // Public supply is refreshed on a schedule and stored; the platform's
      // own cache headers are irrelevant to us and caching here would make
      // retention harder to reason about.
      cache: "no-store",
    });
    if (!res.ok) {
      // The body may echo the request, which may contain a key.
      throw new PublicSupplyHttpError(res.status, redactUrl(url), `HTTP ${res.status}`);
    }
    return await res.json();
  } catch (error) {
    if (error instanceof PublicSupplyHttpError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new PublicSupplyHttpError(504, redactUrl(url), `timed out after ${TIMEOUT_MS}ms`);
    }
    throw new PublicSupplyHttpError(0, redactUrl(url), error instanceof Error ? error.message : "network error");
  } finally {
    clearTimeout(timer);
  }
}

/**
 * POST, used only for OAuth2 client_credentials token exchange. Separate from
 * `publicGet` so a lane cannot accidentally POST to a platform: this layer
 * reads, and the only write it ever performs is asking for its OWN app token.
 */
export async function appTokenPost(
  url: string,
  body: Record<string, string>,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "User-Agent": MESH_API_USER_AGENT,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams(body).toString(),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      throw new PublicSupplyHttpError(res.status, redactUrl(url), `token exchange HTTP ${res.status}`);
    }
    return await res.json();
  } catch (error) {
    if (error instanceof PublicSupplyHttpError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new PublicSupplyHttpError(504, redactUrl(url), `token exchange timed out after ${TIMEOUT_MS}ms`);
    }
    throw new PublicSupplyHttpError(0, redactUrl(url), error instanceof Error ? error.message : "network error");
  } finally {
    clearTimeout(timer);
  }
}

/**
 * App access tokens, cached in module memory for their real lifetime.
 *
 * Per-instance and lost on cold start, which is correct: the alternative is
 * storing a credential in the database, and an app token is cheap to re-mint
 * but expensive to leak. Re-minting a few times an hour is well inside every
 * provider's limits; persisting it is a new secret at rest for no gain.
 */
const tokenCache = new Map<string, { token: string; expiresAtMs: number }>();

export async function cachedAppToken(
  cacheKey: string,
  mint: () => Promise<{ token: string; expiresInSeconds: number }>,
): Promise<string> {
  const hit = tokenCache.get(cacheKey);
  // 60s of headroom so a token cannot expire mid-flight.
  if (hit && hit.expiresAtMs > Date.now() + 60_000) return hit.token;
  const minted = await mint();
  tokenCache.set(cacheKey, {
    token: minted.token,
    expiresAtMs: Date.now() + Math.max(60, minted.expiresInSeconds) * 1000,
  });
  return minted.token;
}

