// THE PROTOCOL DOES NOT PARSE YOUR TEXT — YOU HAND IT BYTE RANGES.
//
// AT Protocol renders a link only where you tell it one is, as a byte range
// into the UTF-8 encoding of the post. JavaScript strings are UTF-16, so the
// moment a post contains an emoji or an accented character before a URL,
// measuring with `indexOf` points the facet at the wrong span — and the post
// renders with a mangled link for every reader, silently, with a 200 back from
// the server.
//
// That is the bug this gate exists for. It cannot be caught by types, it never
// throws, and it only shows up in the one place we cannot see: someone else's
// timeline.
//
// Also pinned: delivery must distinguish retryable from permanent. A publisher
// that retries a malformed post forever is how mesh.me gets rate-limited off a
// platform it promised the user it would keep working.
//
// Pure: no network (fetch is injected), no database. `npm run atproto:check`.

import { buildPost, detectFacets, deliverPost, isSafeService, signIn, withinProtocolLimit, type AtprotoSession } from "../src/lib/compose/atproto";

let checks = 0;
const failures: string[] = [];
const ok = () => { checks += 1; };
const fail = (s: string, m: string) => { failures.push(`[${s}] ${m}`); };

const enc = new TextEncoder();
const SESSION: AtprotoSession = { service: "https://bsky.social", accessJwt: "jwt", did: "did:plc:abc" };
const AT = "2026-01-01T00:00:00.000Z";

/** The text a facet actually points at, decoded back out of the UTF-8 bytes.
 * If this does not equal the intended substring, readers see the wrong span. */
function sliceOf(text: string, byteStart: number, byteEnd: number): string {
  return new TextDecoder().decode(enc.encode(text).slice(byteStart, byteEnd));
}

// ---------------------------------------------------------------------------
// 1. FACET RANGES ARE UTF-8 BYTES, NOT UTF-16 CODE UNITS.
// ---------------------------------------------------------------------------

for (const [label, text, expected] of [
  ["ascii", "see https://mesh.me now", "https://mesh.me"],
  // Emoji are surrogate pairs in JS (2 code units) and 4 bytes in UTF-8.
  ["emoji before link", "🎉🎉 https://mesh.me", "https://mesh.me"],
  // Accented Latin: 1 code unit, 2 bytes.
  ["accents before link", "café société https://mesh.me", "https://mesh.me"],
  // CJK: 1 code unit, 3 bytes.
  ["cjk before link", "日本語のテキスト https://mesh.me", "https://mesh.me"],
  ["emoji before tag", "🚀 #launch", "#launch"],
] as const) {
  const facets = detectFacets(text);
  if (!facets.length) {
    fail("1 bytes", `${label}: nothing detected in ${JSON.stringify(text)}`);
    continue;
  }
  const f = facets[0];
  const got = sliceOf(text, f.index.byteStart, f.index.byteEnd);
  if (got !== expected) {
    fail("1 bytes", `${label}: facet points at ${JSON.stringify(got)}, not ${JSON.stringify(expected)} — readers would see a mangled link`);
    continue;
  }
  ok();
}

// A facet must never run past the end of the encoded text.
{
  const text = "🎉 https://mesh.me/very/long/path";
  const total = enc.encode(text).length;
  for (const f of detectFacets(text)) {
    if (f.index.byteEnd > total || f.index.byteStart < 0 || f.index.byteStart >= f.index.byteEnd) {
      fail("1 bytes", `facet range ${f.index.byteStart}-${f.index.byteEnd} is outside 0-${total}`);
    } else ok();
  }
}

// ---------------------------------------------------------------------------
// 2. WHAT IS AND IS NOT MARKED UP.
// ---------------------------------------------------------------------------

if (detectFacets("no links here").length !== 0) fail("2 detect", "plain text produced facets"); else ok();
// A hashtag must start at a boundary — "abc#tag" is not a tag.
if (detectFacets("abc#tag").length !== 0) fail("2 detect", "mid-word # was treated as a hashtag"); else ok();
if (detectFacets("#tag").length !== 1) fail("2 detect", "a leading hashtag was missed"); else ok();
// Trailing punctuation belongs to the sentence, not the URL.
{
  const f = detectFacets("go to https://mesh.me.");
  const got = f.length ? sliceOf("go to https://mesh.me.", f[0].index.byteStart, f[0].index.byteEnd) : "";
  if (got !== "https://mesh.me") fail("2 detect", `trailing period swallowed into the link: ${JSON.stringify(got)}`); else ok();
}

// ---------------------------------------------------------------------------
// 3. THE RECORD IS EXACTLY WHAT THE LEXICON EXPECTS.
// ---------------------------------------------------------------------------

{
  const post = buildPost("hello", AT);
  if (post.$type !== "app.bsky.feed.post") fail("3 record", "wrong $type"); else ok();
  if (post.createdAt !== AT) fail("3 record", "createdAt was not the one passed in — the record must be a pure function of its inputs"); else ok();
  if ("facets" in post) fail("3 record", "an empty facets array was sent rather than omitted"); else ok();
}
{
  const post = buildPost("hi https://mesh.me", AT, ["en"]);
  if (!post.facets?.length) fail("3 record", "a link produced no facets"); else ok();
  if (post.langs?.[0] !== "en") fail("3 record", "langs was dropped"); else ok();
}
if (!withinProtocolLimit("x".repeat(100))) fail("3 record", "a short post was called too long"); else ok();
if (withinProtocolLimit("x".repeat(10001))) fail("3 record", "a 10001-byte post passed the limit"); else ok();
// Bytes, not characters: 4000 emoji is 16000 bytes.
if (withinProtocolLimit("🎉".repeat(4000))) fail("3 record", "the limit counted characters rather than bytes"); else ok();

// ---------------------------------------------------------------------------
// 4. DELIVERY TELLS THE TRUTH, AND KNOWS WHAT MAY BE RETRIED.
// ---------------------------------------------------------------------------

const reply = (status: number, body: unknown): typeof fetch =>
  (async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;

async function main() {
  const post = buildPost("hello", AT);

  {
    const r = await deliverPost(SESSION, post, reply(200, { uri: "at://did:plc:abc/app.bsky.feed.post/1", cid: "bafy" }));
    if (!r.ok) fail("4 delivery", `a good reply was reported as failure: ${r.message}`); else ok();
  }
  {
    // A 200 with no uri is not a success we can prove.
    const r = await deliverPost(SESSION, post, reply(200, { ok: true }));
    if (r.ok) fail("4 delivery", "claimed success on a 200 that returned no uri — the user would have to open the app to check"); else ok();
  }
  for (const [status, retryable] of [[429, true], [500, true], [503, true], [400, false], [401, false], [403, false]] as const) {
    const r = await deliverPost(SESSION, post, reply(status, { error: "x" }));
    if (r.ok) { fail("4 delivery", `${status} was treated as success`); continue; }
    if (r.retryable !== retryable) {
      fail("4 delivery", `${status} marked retryable=${r.retryable}; retrying a permanent refusal is how we get rate-limited off the platform`);
      continue;
    }
    ok();
  }
  {
    const boom: typeof fetch = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
    const r = await deliverPost(SESSION, post, boom);
    if (r.ok || !r.retryable) fail("4 delivery", "a network failure must be retryable"); else ok();
  }
  {
    const long = buildPost("🎉".repeat(4000), AT);
    let called = false;
    const spy: typeof fetch = (async () => { called = true; return new Response("{}", { status: 200 }); }) as unknown as typeof fetch;
    const r = await deliverPost(SESSION, long, spy);
    if (r.ok) fail("4 delivery", "an over-limit post was sent");
    else if (called) fail("4 delivery", "an over-limit post still hit the network — refuse before spending the request");
    else ok();
  }
  {
    // Federation: the PDS is whatever the account says it is, never assumed.
    let seen = "";
    const spy: typeof fetch = (async (url: string) => { seen = String(url); return new Response(JSON.stringify({ uri: "at://x", cid: "c" }), { status: 200, headers: { "content-type": "application/json" } }); }) as unknown as typeof fetch;
    await deliverPost({ ...SESSION, service: "https://pds.example.com/" }, post, spy);
    if (!seen.startsWith("https://pds.example.com/xrpc/com.atproto.repo.createRecord")) {
      fail("4 delivery", `posted to ${seen} — a self-hosted PDS must be honoured, not replaced with bsky.social`);
    } else ok();
  }

  // -------------------------------------------------------------------------
  // 5. THE APP PASSWORD ONLY EVER GOES TO A HOST WE VETTED.
  // -------------------------------------------------------------------------
  //
  // AT Protocol is federated, so the account names its own server. That is the
  // right design and it is also the attack: whoever controls that string
  // controls where the password is sent.

  for (const bad of [
    "http://bsky.social",              // plaintext — the password on the wire
    "http://localhost:3000",           // still plaintext
    "https://user:pw@bsky.social",     // embedded credentials get forwarded
    "//bsky.social",                   // protocol-relative, resolves to us
    "/xrpc",                           // relative, posts back into our own logs
    "javascript:alert(1)",
    "",
    "not a url",
  ]) {
    if (isSafeService(bad)) { fail("5 secrets", `${JSON.stringify(bad)} was accepted as a place to send an app password`); continue; }
    let touched = false;
    const spy: typeof fetch = (async () => { touched = true; return new Response("{}", { status: 200 }); }) as unknown as typeof fetch;
    const r = await signIn(bad, "me.bsky.social", "app-password", spy);
    if (touched) { fail("5 secrets", `signIn sent the password to ${JSON.stringify(bad)} before validating it`); continue; }
    if (r.ok || r.retryable) { fail("5 secrets", `a rejected host must fail permanently, not retry with the password`); continue; }
    ok();
  }

  if (!isSafeService("https://bsky.social")) fail("5 secrets", "a legitimate https PDS was rejected"); else ok();
  if (!isSafeService("https://pds.example.com/")) fail("5 secrets", "a self-hosted https PDS was rejected"); else ok();

  {
    const good = (async () => new Response(JSON.stringify({ accessJwt: "jwt", did: "did:plc:x", handle: "me.bsky.social" }), { status: 200, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;
    const r = await signIn("https://bsky.social", "me.bsky.social", "secret-app-password", good);
    if (!r.ok) { fail("5 secrets", `a valid sign-in failed: ${r.message}`); }
    else {
      // The result must carry tokens, never the secret it was handed.
      if (JSON.stringify(r).includes("secret-app-password")) fail("5 secrets", "the app password came back in the result");
      else ok();
      if (r.session.service !== "https://bsky.social" || !r.session.accessJwt) fail("5 secrets", "the session was incomplete"); else ok();
    }
  }

  {
    // A wrong password must not be retried — that is how an account gets locked.
    const denied = (async () => new Response(JSON.stringify({ error: "AuthenticationRequired", message: "me.bsky.social is wrong" }), { status: 401, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;
    const r = await signIn("https://bsky.social", "me.bsky.social", "wrong", denied);
    if (r.ok) fail("5 secrets", "a 401 sign-in was reported as success");
    else if (r.retryable) fail("5 secrets", "a rejected password was marked retryable — that locks accounts");
    else if (r.message.includes("me.bsky.social")) fail("5 secrets", "the server's message echoed the identifier into ours, and this string reaches logs");
    else ok();
  }

  if (failures.length) {
    console.error(`\natproto: ${failures.length} failure(s) across ${checks + failures.length} assertions\n`);
    for (const f of failures) console.error("  " + f);
    console.error("");
    process.exit(1);
  }

  console.log(
    `atproto OK — ${checks} assertions. Facet ranges are UTF-8 byte offsets, checked by decoding the range back out\n` +
      "  and comparing it to the intended text — so an emoji, an accent or a CJK character before a link cannot\n" +
      "  silently point the facet at the wrong span. Trailing punctuation stays out of the URL and a mid-word # is\n" +
      "  not a hashtag. The record is a pure function of its inputs. Delivery never claims success without a uri to\n" +
      "  prove it, refuses an over-limit post before spending the request, honours a self-hosted PDS, and separates\n" +
      "  retryable (429, 5xx, network) from permanent (400, 401, 403).\n" +
      "  An app password is only ever sent to a vetted https host — never http, never one with embedded\n" +
    "  credentials, never a relative URL that would resolve against our own origin — and a rejected host or\n" +
    "  password fails permanently rather than retrying with the secret in hand.\n" +
    "  Does NOT cover: whether a real Bluesky server accepts these records. That needs a live account.",
  );
}

main();
