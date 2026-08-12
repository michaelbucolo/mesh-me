/**
 * MECHAT WRITES AND PRESENCE ARE BLOCK- AND TOGGLE-GATED — PERMANENTLY.
 *
 * Two holes in the MeChat surface were closed and must not silently reopen. A
 * blocked user still passes getAuthorizedThread (blockUser never deletes
 * threadMember rows), and hideActivityStatus is enforced route-by-route rather
 * than by a shared middleware — so a guard dropped from one handler leaks with
 * no type error to catch it. This gate reads the two route sources and asserts
 * the guard text is present, then mutation-proofs itself with sanity checks: a
 * scanner that cannot find the handler at all fails rather than reporting green.
 *
 *   1. PATCH on /api/messages/[threadId] (react / edit / unsend) must call
 *      blockedInsideThread, exactly as POST does. Without it a blocked user
 *      reacts to and edits messages in a shared thread — writes that surface to
 *      the blocker on their next poll. If the call disappears from the PATCH
 *      body, this fails.
 *
 *   2. The typing heartbeat must not broadcast a live "typing" presence when the
 *      member has hideActivityStatus on (or read receipts off) — typing is a
 *      strictly stronger activity signal than the viewing beat that already
 *      honors the toggle. An unguarded `} else { setMeChatTyping(...) }` in the
 *      keystroke branch is the exact original defect; this fails on it.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const failures: string[] = [];

// --- 1. PATCH must be block-gated -----------------------------------------
const messagesRoute = "src/app/api/messages/[threadId]/route.ts";
const messagesSrc = readFileSync(join(ROOT, messagesRoute), "utf8");

const patchStart = messagesSrc.indexOf("export async function PATCH");
if (patchStart < 0) {
  // The scanner must be able to SEE the handler. A missing match is a broken
  // scanner, not a clean codebase — fail loudly rather than pass by omission.
  failures.push(`${messagesRoute}: PATCH handler not found — scanner is broken`);
} else {
  const after = messagesSrc.indexOf("export async function", patchStart + 1);
  const patchBody = messagesSrc.slice(patchStart, after < 0 ? undefined : after);
  if (!/blockedInsideThread\s*\(/.test(patchBody)) {
    failures.push(
      `${messagesRoute}: PATCH does not call blockedInsideThread — a blocked user can react to/edit messages in a shared thread`,
    );
  }
}

// --- 2. Typing heartbeat must honor the activity-status toggle -------------
const typingRoute = "src/app/api/messages/[threadId]/typing/route.ts";
const typingSrc = readFileSync(join(ROOT, typingRoute), "utf8");

if (!/setMeChatTyping\s*\(/.test(typingSrc)) {
  failures.push(`${typingRoute}: no setMeChatTyping call found — scanner is broken`);
}
if (!/hideActivityStatus/.test(typingSrc)) {
  failures.push(
    `${typingRoute}: hideActivityStatus not referenced — the typing branch no longer honors the activity-status toggle`,
  );
}
// The original defect verbatim: a bare `else` on the keystroke path that fires
// setMeChatTyping with no toggle gate (comments between are tolerated).
if (/}\s*else\s*\{\s*(?:\/\/[^\n]*\r?\n\s*)*setMeChatTyping\s*\(/.test(typingSrc)) {
  failures.push(
    `${typingRoute}: typing branch broadcasts setMeChatTyping unconditionally — gate it behind readReceipts && !hideActivityStatus`,
  );
}

if (failures.length) {
  console.error(`\nmechat-guard: ${failures.length} MeChat guard(s) missing\n`);
  for (const f of failures) console.error(`  ${f}`);
  console.error("");
  process.exit(1);
}

console.log("mechat-guard: PATCH is block-gated and the typing heartbeat honors hideActivityStatus.");
