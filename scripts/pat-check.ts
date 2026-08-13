/**
 * THE PERSONAL DATA API — recognized, never recoverable; yours, never anyone
 * else's; read, never write.
 *
 * The failure shapes this gate exists to catch:
 *
 *   - THE RECOVERABLE CREDENTIAL: a token stored encrypted (or plaintext)
 *     turns a database dump into a credential-recovery kit. Only the
 *     verifier's hash may ever touch a row.
 *   - THE AMBIENT DOOR: a /api/me route that also answers to cookies is a
 *     CSRF surface. Bearer-only, or nothing.
 *   - THE SECOND READER: consent-check says outright it cannot see new
 *     readers of consented data — journal reads are ratcheted through
 *     listJournal, and any future computed-analytics endpoint is
 *     pre-registered to require hasAnalyticsConsent.
 *   - THE QUIET WIDENING: one added select field (a DM, a follower edge, an
 *     OAuth token) turns self-access into surveillance. The exclusion list
 *     is scanned, not remembered.
 *   - THE TALKATIVE 401: "expired" vs "revoked" vs "never existed" is an
 *     oracle. One constant answers everything.
 *
 * WHAT THIS CANNOT PROVE: source text, not dataflow; runtime timing; that
 * the docs page RENDERS what it imports (build-time types cover the import).
 */

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { PAT_RESOURCES } from "../src/lib/me-api";
import { PAT_SHAPE } from "../src/lib/personal-access-token";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const strip = (s: string) => s.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const failures: string[] = [];
const fail = (section: string, detail: string) => failures.push(`[${section}] ${detail}`);
let checks = 0;
const ok = () => { checks += 1; };

function walkRoutes(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${entry}`;
    if (statSync(join(ROOT, rel)).isDirectory()) out.push(...walkRoutes(rel));
    else if (entry === "route.ts") out.push(rel);
  }
  return out;
}

const tokenLib = strip(read("src/lib/personal-access-token.ts"));
const meApi = strip(read("src/lib/me-api.ts"));
const routeFiles = walkRoutes("src/app/api/me");
const routeSources = routeFiles.map((f) => ({ file: f, text: strip(read(f)) }));
const apiTree = meApi + routeSources.map((r) => r.text).join("\n");
const mintRoute = strip(read("src/app/api/settings/api-tokens/route.ts"));
const panel = strip(read("src/components/privacy/api-tokens-panel.tsx"));
const developers = strip(read("src/app/developers/page.tsx"));

// ── 1. Single definition ─────────────────────────────────────────────────────
{
  const grepped = execFileSync("grep", ["-rlE", "(prisma|tx)\\.personalAccessToken", "src"], { encoding: "utf8" })
    .split("\n").filter(Boolean).filter((f: string) => !f.startsWith("src/generated/"));
  if (grepped.length !== 1 || grepped[0] !== "src/lib/personal-access-token.ts") {
    fail("1 single", `the PersonalAccessToken table is touched outside its module: ${grepped.join(", ")}`);
  } else ok();
  for (const { file, text } of routeSources) {
    if (/@\/lib\/prisma|from "\.\.\/.*prisma"/.test(text)) {
      fail("1 single", `${file} imports prisma directly — routes go through me-api's helpers`);
    } else ok();
  }
}

// ── 2. Hash, never encrypt ───────────────────────────────────────────────────
{
  if (!/createHash\("sha256"\)/.test(tokenLib) || !/randomBytes\(32\)/.test(tokenLib)) {
    fail("2 hash", "the verifier is no longer a 256-bit CSPRNG value hashed with sha256");
  } else ok();
  if (!/verifierHash: sha256Hex\(verifier\)/.test(tokenLib)) {
    fail("2 hash", "the row no longer stores the verifier's hash");
  } else ok();
  if (/encryptSecret|decryptSecret|secret-store/.test(tokenLib + apiTree + mintRoute)) {
    fail("2 hash", "a token module reaches for encryption — a PAT is recognized, never replayed; recoverability is pure downside");
  } else ok();
  if (!PAT_SHAPE.test(`mesh_pat_${"a".repeat(12)}.${"b".repeat(43)}`) || PAT_SHAPE.test("mesh_pat_short.nope")) {
    fail("2 hash", "the published token shape drifted from selector(12).verifier(43)");
  } else ok();
}

// ── 3. Constant-time, shape before any read ──────────────────────────────────
{
  if (!/timingSafeEqual/.test(tokenLib)) {
    fail("3 timing", "verification lost timingSafeEqual");
  } else ok();
  const verifyBody = tokenLib.slice(tokenLib.indexOf("export async function verifyPersonalAccessToken"));
  const shapeAt = verifyBody.indexOf("PAT_SHAPE.test");
  const dbAt = verifyBody.indexOf("findUnique");
  if (shapeAt < 0 || dbAt < 0 || shapeAt > dbAt) {
    fail("3 timing", "the shape check no longer precedes the database read — malformed input reaches the selector index");
  } else ok();
  const grepped = execFileSync("grep", ["-rn", "verifierHash", "src", "--include=*.ts", "--include=*.tsx"], { encoding: "utf8" })
    .split("\n").filter(Boolean).filter((l: string) => !l.startsWith("src/generated/"));
  if (grepped.some((l: string) => /===|==/.test(l.split(":").slice(2).join(":")))) {
    fail("3 timing", "a direct equality touches verifierHash somewhere — the timing oracle");
  } else ok();
}

// ── 4. No ambient authority under /api/me ────────────────────────────────────
{
  for (const { file, text } of routeSources) {
    if (/getCurrentUser|isSameOriginRequest|next\/headers|cookies\(/.test(text)) {
      fail("4 bearer-only", `${file} grew a session path — the CSRF surface this design exists to not have`);
    } else ok();
  }
  if (/getCurrentUser|isSameOriginRequest|cookies\(/.test(meApi)) {
    fail("4 bearer-only", "me-api.ts reaches for ambient auth");
  } else ok();
  if (/Access-Control-Allow-Origin/.test(apiTree)) {
    fail("4 bearer-only", "CORS headers appeared — a PAT in browser JavaScript is a leak in progress");
  } else ok();
}

// ── 5. Read-only ─────────────────────────────────────────────────────────────
{
  for (const { file, text } of routeSources) {
    if (!/export async function GET/.test(text)) {
      fail("5 read-only", `${file} exports no GET`);
    } else ok();
    if (/export (async function|const) (POST|PUT|PATCH|DELETE)/.test(text)) {
      fail("5 read-only", `${file} exports a write verb`);
    } else ok();
  }
  if (/\.create\(|\.update\(|\.updateMany\(|\.upsert\(|\.delete\(|\.deleteMany\(|executeRaw/.test(meApi)) {
    fail("5 read-only", "me-api.ts writes — the API is a read of your data, never a writer");
  } else ok();
}

// ── 6. Owner-pinned everywhere ───────────────────────────────────────────────
{
  for (const pin of ["where: { authorId: userId }", "where: { userId }", "connectedAccount: { userId }", "where: { id: postId, authorId: userId }"]) {
    if (!meApi.includes(pin)) {
      fail("6 owner", `an owner pin vanished from me-api.ts: ${pin}`);
    } else ok();
  }
  for (const { file, text } of routeSources) {
    if (/userId|username|email/.test(text.replace(/auth\.userId/g, ""))) {
      fail("6 owner", `${file} handles a user identifier outside auth.userId — identity comes from the token alone`);
    } else ok();
  }
}

// ── 7. Closed resource table ─────────────────────────────────────────────────
{
  const declared = new Set(PAT_RESOURCES.map((r) => r.path));
  for (const file of routeFiles) {
    const url = "/" + file.replace(/^src\/app\//, "").replace(/\/route\.ts$/, "");
    const parent = url.replace(/\/\[[^\]]+\]$/, "");
    if (!declared.has(url as never) && !declared.has(parent as never)) {
      fail("7 closed", `${url} exists but PAT_RESOURCES doesn't declare it — the docs would omit a live endpoint`);
    } else ok();
  }
  if (PAT_RESOURCES.length !== 12) {
    fail("7 closed", `PAT_RESOURCES has ${PAT_RESOURCES.length} entries — the table and this gate move together`);
  } else ok();
}

// ── 8. Consent chokepoints ───────────────────────────────────────────────────
{
  if (!/import \{ listJournal \} from "@\/lib\/meshi-memory"/.test(read("src/lib/me-api.ts"))) {
    fail("8 consent", "the journal resource no longer rides listJournal — the meshi-memory single-reader ratchet broke");
  } else ok();
  if (/meshiJournal/.test(apiTree)) {
    fail("8 consent", "a me-api surface touches the journal tables directly");
  } else ok();
  // Pre-registered rule: computed analytics must bring their consent check.
  if (/analytics-dashboard|pro-analytics|analytics-lifetime|analytics-report/.test(apiTree)) {
    fail("8 consent", "a computed-analytics loader is imported under /api/me without this gate being updated to require hasAnalyticsConsent beside it");
  } else ok();
}

// ── 9. The exclusion ratchet ─────────────────────────────────────────────────
{
  if (/prisma\.(message|messageThread|meChatSession|notification|flowImpression|platformFeedItem|platformFollower|follow|block|mutedSource|report|session|authIdentity)\b/.test(apiTree)) {
    fail("9 exclusions", "an excluded table is read under /api/me — one widened select turns self-access into surveillance");
  } else ok();
  if (/accessToken: true|refreshToken: true|passwordHash|resetToken|twoFactor|stripeCustomerId|stripeSubscriptionId|adultVerification|bannerUrl: true|mergedIntoUserId: true|isAdmin: true/.test(apiTree)) {
    fail("9 exclusions", "a credential or security field is selected under /api/me");
  } else ok();
}

// ── 10. Uniform 401 ──────────────────────────────────────────────────────────
{
  if ((meApi.match(/const UNAUTHORIZED = /g) ?? []).length !== 1 || !/WWW-Authenticate/.test(meApi)) {
    fail("10 uniform", "the single UNAUTHORIZED constant (with WWW-Authenticate) is gone");
  } else ok();
  if (/"[^"]*(expired|revoked|suspended)[^"]*"/i.test(apiTree)) {
    fail("10 uniform", "a response literal names WHY a token died — the oracle this design refuses to be");
  } else ok();
  const verifyBody = tokenLib.slice(tokenLib.indexOf("export async function verifyPersonalAccessToken"));
  if ((verifyBody.match(/return null;/g) ?? []).length < 4) {
    fail("10 uniform", "verification lost a fail-closed step (shape/row/hash/expiry/user must all refuse identically)");
  } else ok();
}

// ── 11. Both limiters + the RateLimitHit law ─────────────────────────────────
{
  if (!/rateLimit\(`pat:t:/.test(meApi) || !/durableRateLimit\(`pat:t:/.test(meApi) || !/durableRateLimit\(`pat:u:/.test(meApi)) {
    fail("11 limits", "a limiter tier vanished from the wrapper");
  } else ok();
  if (!/durableRateLimit\(`pat:bad:/.test(meApi) || !/durableRateLimit\(`pat:bad-sel:/.test(meApi)) {
    fail("11 limits", "failed-attempt budgeting vanished — the selector index can be ground offline");
  } else ok();
  if (!/durableRateLimit\(`pat:mint:/.test(mintRoute)) {
    fail("11 limits", "minting lost its durable daily ceiling — churn is a compromise signal");
  } else ok();
  const grepped = execFileSync("grep", ["-rlE", "rateLimitHit\\.(delete|deleteMany)", "src"], { encoding: "utf8" })
    .split("\n").filter(Boolean).filter((f: string) => !f.startsWith("src/generated/"));
  if (grepped.length !== 1 || grepped[0] !== "src/lib/durable-rate-limit.ts") {
    fail("11 limits", `RateLimitHit rows are deleted outside durable-rate-limit.ts: ${grepped.join(", ")}`);
  } else ok();
}

// ── 12. Nothing cached ───────────────────────────────────────────────────────
{
  if (/unstable_cache|mesh-cache|ttl-memo|memoizeWithTtl/.test(apiTree + tokenLib)) {
    fail("12 no-cache", "a cache appeared — revocation and consent withdrawal must be next-request-effective");
  } else ok();
  for (const { file, text } of routeSources) {
    if (!/export const dynamic = "force-dynamic"/.test(text)) {
      fail("12 no-cache", `${file} is not force-dynamic`);
    } else ok();
  }
  if ((meApi.match(/private, no-store/g) ?? []).length !== 1) {
    fail("12 no-cache", "the no-store header is set in more or fewer than one builder");
  } else ok();
}

// ── 13. Expiry policy + cascade in both files ────────────────────────────────
{
  if (!/PAT_EXPIRY_DAYS = \[7, 30, 90, 365\] as const/.test(tokenLib) || !/PAT_DEFAULT_EXPIRY_DAYS = 90/.test(tokenLib)) {
    fail("13 expiry", "the expiry menu drifted — every token dies, 90 days by default, a year at most");
  } else ok();
  if (!/includes\(expiryDays\)/.test(tokenLib)) {
    fail("13 expiry", "minting no longer refuses off-menu expiries");
  } else ok();
  const model = /model PersonalAccessToken \{[\s\S]*?\n\}/.exec(read("prisma/schema.prisma"))?.[0] ?? "";
  if (/expiresAt\s+DateTime\?/.test(model) || !/expiresAt\s+DateTime/.test(model)) {
    fail("13 expiry", "expiresAt went nullable — a token that never dies");
  } else ok();
  if (!/onDelete: Cascade/.test(model)) {
    fail("13 expiry", "the user cascade left schema.prisma");
  } else ok();
  const ensure = /CREATE TABLE IF NOT EXISTS "PersonalAccessToken" \([\s\S]*?\);/.exec(read("prisma/ensure-schema.sql"))?.[0] ?? "";
  if (!/ON DELETE CASCADE/.test(ensure)) {
    fail("13 expiry", "the cascade is missing from ensure-schema.sql — production tokens would outlive their accounts");
  } else ok();
}

// ── 14. UI hygiene + docs honesty ────────────────────────────────────────────
{
  if (/localStorage|sessionStorage/.test(panel)) {
    fail("14 hygiene", "the panel persists the token — component state only, once, then gone");
  } else ok();
  // Count USES of the minted string, not one property shape — a second
  // field ("tokenAgain: result.token") must count as a second serialization.
  if ((mintRoute.match(/result\.token\b/g) ?? []).length !== 1) {
    fail("14 hygiene", "the mint route must touch result.token exactly once — the show-once response field");
  } else ok();
  if (!/return \{ token: `mesh_pat_\$\{selector\}\.\$\{verifier\}`/.test(tokenLib)) {
    fail("14 hygiene", "the mint return no longer assembles selector.verifier — the one place the full token exists");
  } else ok();
  if (!/import \{ PAT_RESOURCES \} from "@\/lib\/me-api"/.test(read("src/app/developers/page.tsx"))) {
    fail("14 hygiene", "/developers no longer generates from PAT_RESOURCES — the docs can drift from the code");
  } else ok();
  if (!/What is deliberately not here/.test(developers)) {
    fail("14 hygiene", "/developers lost its exclusions section — honesty about absence is part of the product");
  } else ok();
  if (!/The data API is the same for everyone\. Your data doesn/.test(developers)) {
    fail("14 hygiene", "the pinned same-for-everyone sentence left the docs");
  } else ok();
  if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(panel + developers)) {
    fail("14 hygiene", "emoji appeared in chrome");
  } else ok();
}

if (failures.length) {
  console.error(`\npat: ${failures.length} failure(s) across ${checks + failures.length} assertions\n`);
  for (const f of failures) console.error("  " + f);
  process.exit(1);
}
console.log(`pat: all ${checks} assertions passed — recognized never recoverable, yours never anyone else's, read never write.`);
