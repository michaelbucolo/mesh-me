// PUBLISHING TO THE OPEN PROTOCOL — WHERE "DELETE THE OTHER APP" IS ACTUALLY TRUE.
//
// Bluesky runs on AT Protocol, which — unlike every closed platform mesh.me
// touches — permits a third party to both READ a person's timeline and WRITE
// on their behalf. That makes it the one place the full promise is deliverable
// today rather than partially: you really can post from here, read from here,
// and not install the app.
//
// ── WHAT THIS FILE IS, AND WHAT IT REFUSES TO BE ───────────────────────────
//
// It builds the exact record the protocol expects and nothing more. It does not
// hold credentials, does not decide whether a post is allowed (that is
// `plan.ts`), and does not talk to the network — the caller injects `fetch`.
// That separation is what lets the whole thing be checked without a Bluesky
// account, a token, or a live host in the room.
//
// ── FACETS ARE THE PART EVERYONE GETS WRONG ────────────────────────────────
//
// AT Protocol does not parse your text. A link or a mention is only a link or a
// mention if you send BYTE RANGES pointing at it, and those ranges are indexes
// into UTF-8 — not into a JavaScript string. Any post containing an emoji or an
// accented character before a URL will silently link the wrong span if you
// measure with `String.prototype.indexOf`, because JS counts UTF-16 code units.
// This is why the ranges here are computed over an encoded buffer.

/** A byte range into the UTF-8 encoding of the post text. */
type ByteSlice = { byteStart: number; byteEnd: number };

export type Facet =
  | { index: ByteSlice; features: Array<{ $type: "app.bsky.richtext.facet#link"; uri: string }> }
  | { index: ByteSlice; features: Array<{ $type: "app.bsky.richtext.facet#tag"; tag: string }> };

export type AtprotoPost = {
  $type: "app.bsky.feed.post";
  text: string;
  createdAt: string;
  facets?: Facet[];
  langs?: string[];
};

/** Bluesky counts GRAPHEMES for display but bytes for storage; the practical
 * ceiling people hit is 300 graphemes. `plan.ts` owns the refusal — this is
 * only the protocol's own hard byte ceiling, which is separate and larger. */
const MAX_BYTES = 10000;

const encoder = new TextEncoder();

/**
 * Find links and hashtags as BYTE ranges over the UTF-8 text.
 *
 * Deliberately conservative: it marks up what it is certain about and leaves
 * everything else as plain text. A missed link is a small loss; a facet whose
 * range is off by two bytes corrupts the post's rendering for every reader.
 */
export function detectFacets(text: string): Facet[] {
  const facets: Facet[] = [];
  const bytes = encoder.encode(text);

  // Walk the string once, tracking the byte offset alongside the code-unit
  // offset. Doing it this way means a single pass answers both questions and
  // the two can never disagree.
  const spans: Array<{ start: number; end: number; kind: "link" | "tag"; value: string }> = [];

  const linkRe = /https?:\/\/[^\s<>()]+[^\s<>().,!?;:'"]/g;
  for (const m of text.matchAll(linkRe)) {
    if (m.index === undefined) continue;
    spans.push({ start: m.index, end: m.index + m[0].length, kind: "link", value: m[0] });
  }

  // A hashtag must start at a boundary, so "#tag" counts and "abc#tag" does not.
  const tagRe = /(^|\s)(#[^\s#.,!?;:'"]+)/g;
  for (const m of text.matchAll(tagRe)) {
    if (m.index === undefined) continue;
    const start = m.index + m[1].length;
    spans.push({ start, end: start + m[2].length, kind: "tag", value: m[2].slice(1) });
  }

  spans.sort((a, b) => a.start - b.start);

  for (const span of spans) {
    const byteStart = encoder.encode(text.slice(0, span.start)).length;
    const byteEnd = byteStart + encoder.encode(text.slice(span.start, span.end)).length;
    if (byteEnd > bytes.length) continue;

    if (span.kind === "link") {
      facets.push({
        index: { byteStart, byteEnd },
        features: [{ $type: "app.bsky.richtext.facet#link", uri: span.value }],
      });
    } else {
      facets.push({
        index: { byteStart, byteEnd },
        features: [{ $type: "app.bsky.richtext.facet#tag", tag: span.value }],
      });
    }
  }

  return facets;
}

/** Build the record. `createdAt` is passed in rather than read from the clock
 * so the result is a pure function of its inputs and can be asserted exactly. */
export function buildPost(text: string, createdAtIso: string, langs?: string[]): AtprotoPost {
  const facets = detectFacets(text);
  const post: AtprotoPost = {
    $type: "app.bsky.feed.post",
    text,
    createdAt: createdAtIso,
  };
  if (facets.length) post.facets = facets;
  if (langs?.length) post.langs = langs;
  return post;
}

export function withinProtocolLimit(text: string): boolean {
  return encoder.encode(text).length <= MAX_BYTES;
}

/** The minimum a caller must give us to act on someone's behalf. */
export type AtprotoSession = {
  /** Their PDS, e.g. https://bsky.social — never assumed, because AT Protocol
   * is federated and hard-coding bsky.social would break self-hosted users. */
  service: string;
  accessJwt: string;
  did: string;
};

export type DeliveryResult =
  | { ok: true; uri: string; cid: string }
  | { ok: false; retryable: boolean; message: string };

/**
 * Send the record. `fetchImpl` is injected so the delivery path is testable
 * without a network, and so the caller owns timeouts and proxying.
 *
 * Returns a RESULT rather than throwing, and distinguishes retryable from
 * permanent: a 429 or a 5xx should be tried again, a 400 never should. A
 * publisher that retries a malformed post forever is how you get rate-limited
 * off a platform you promised the user you would keep working.
 */
export async function deliverPost(
  session: AtprotoSession,
  post: AtprotoPost,
  fetchImpl: typeof fetch = fetch,
): Promise<DeliveryResult> {
  if (!withinProtocolLimit(post.text)) {
    return { ok: false, retryable: false, message: "Post is past the protocol's byte limit." };
  }

  let res: Response;
  try {
    res = await fetchImpl(`${session.service.replace(/\/$/, "")}/xrpc/com.atproto.repo.createRecord`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${session.accessJwt}`,
      },
      body: JSON.stringify({
        repo: session.did,
        collection: "app.bsky.feed.post",
        record: post,
      }),
    });
  } catch {
    // The network failing is the definition of retryable.
    return { ok: false, retryable: true, message: "Could not reach the server." };
  }

  if (res.status === 429 || res.status >= 500) {
    return { ok: false, retryable: true, message: `The server asked us to try later (${res.status}).` };
  }

  if (!res.ok) {
    // 401 is permanent for THIS session — the token is stale and the fix is
    // re-authenticating, not retrying with the same credential.
    return {
      ok: false,
      retryable: false,
      message:
        res.status === 401
          ? "Bluesky no longer accepts this sign-in — reconnect the account."
          : `Bluesky refused the post (${res.status}).`,
    };
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { ok: false, retryable: true, message: "The server sent a reply we could not read." };
  }

  const uri = typeof body === "object" && body && "uri" in body ? String((body as { uri: unknown }).uri) : "";
  const cid = typeof body === "object" && body && "cid" in body ? String((body as { cid: unknown }).cid) : "";

  // A 200 with no uri is not a success we can prove. Saying "posted" on the
  // strength of a status code alone is exactly the claim this product cannot
  // make loosely — the user would have to open the app to check, which is the
  // chore we are removing.
  if (!uri) {
    return { ok: false, retryable: false, message: "The server accepted it but returned nothing we can link to." };
  }

  return { ok: true, uri, cid };
}

// ── SIGNING IN, AND THE ONE WAY THIS COULD LEAK A CREDENTIAL ───────────────
//
// AT Protocol is federated: the account tells us which server to talk to. That
// is the right design and it is also the attack. If someone can influence the
// stored service URL, every field below is sent to whatever host it names —
// including the app password.
//
// So the host is validated before the credential is ever assembled:
//
//   • https only. An http:// PDS would put the password on the wire in clear.
//   • no credentials in the URL itself (https://user:pass@host), which some
//     fetch implementations will happily forward as an Authorization header.
//   • a real hostname, not an empty or relative one that would resolve
//     against our own origin and post the password back into our own logs.
//
// A rejected host is a permanent failure, never a retry: hammering a bad host
// with a password is worse than failing once.

export type SignInResult =
  | { ok: true; session: AtprotoSession; handle: string }
  | { ok: false; retryable: boolean; message: string };

/** Is this a host we are willing to send an app password to? */
export function isSafeService(service: string): boolean {
  let url: URL;
  try {
    url = new URL(service);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  // Credentials embedded in the URL are forwarded by some clients.
  if (url.username || url.password) return false;
  if (!url.hostname) return false;
  return true;
}

/**
 * Exchange a handle + app password for a session.
 *
 * The password is used once, here, and never returned in the result — the
 * caller gets tokens it can store, not the secret it was given.
 */
export async function signIn(
  service: string,
  identifier: string,
  appPassword: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SignInResult> {
  if (!isSafeService(service)) {
    return {
      ok: false,
      retryable: false,
      message: "That server address is not one we can sign in to safely — it must be https.",
    };
  }

  let res: Response;
  try {
    res = await fetchImpl(`${service.replace(/\/$/, "")}/xrpc/com.atproto.server.createSession`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifier, password: appPassword }),
    });
  } catch {
    return { ok: false, retryable: true, message: "Could not reach that server." };
  }

  if (res.status === 429 || res.status >= 500) {
    return { ok: false, retryable: true, message: `The server asked us to try later (${res.status}).` };
  }
  if (!res.ok) {
    // Deliberately does not echo the server's message: it can contain the
    // identifier, and this string ends up in logs and on screens.
    return { ok: false, retryable: false, message: "That handle or app password was not accepted." };
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { ok: false, retryable: true, message: "The server sent a reply we could not read." };
  }

  const get = (k: string) =>
    typeof body === "object" && body && k in body ? String((body as Record<string, unknown>)[k]) : "";

  const accessJwt = get("accessJwt");
  const did = get("did");
  if (!accessJwt || !did) {
    return { ok: false, retryable: false, message: "The server signed us in but sent nothing we can use." };
  }

  return { ok: true, session: { service, accessJwt, did }, handle: get("handle") };
}
