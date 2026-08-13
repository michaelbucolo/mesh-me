import "server-only";

import { prisma } from "@/lib/prisma";
import { hasMeshiConsent } from "@/lib/consent";
import { hasMeshPro } from "@/lib/mesh-pro";
import { sanitizeForDisplay } from "@/lib/security";

/**
 * MESHI'S JOURNAL — durable memory, consent-gated, owner-typed, deletable.
 *
 * The design's spine, in four sentences:
 *
 *  1. THE GRANT ROW IS THE CONSENT. No MeshiJournalGrant row = no journal,
 *     fail-closed — the deliberate opposite of the absent-row-permissive
 *     DataVisibilityPolicy table. Withdrawal deletes the row and the schema
 *     cascade takes every entry: off = deleted, never hidden.
 *  2. EVERY STORED BYTE IS OWNER-TYPED. Writers accept input from exactly one
 *     source — the owner's own message text. Nothing derived from grounded
 *     context, browsing, presence, timing, mood, or any other account ever
 *     becomes a durable row, so no memory can outlive a THIRD PARTY's consent.
 *  3. RECALL RE-CHECKS AT THE DOOR. Reading memory into a prompt requires
 *     both the grant AND the live "Meshi memory" read rule (hasMeshiConsent) —
 *     a paused read rule leaves the journal dormant, viewable and deletable
 *     but never egressed. Computed per-request, never cached: a memoized
 *     digest would be a derived copy that survives withdrawal until TTL.
 *  4. THE JOURNAL IS A DIARY, NOT A WAREHOUSE. Three kinds, all capped; at
 *     cap the answer is a refusal that NEVER names Pro — the /meshpro page is
 *     the sales surface, Meshi's mouth is not. No notifications, ever.
 *
 * This module is the ONLY reader/writer of either journal table
 * (meshi-memory-check ratchets that), which is the direct answer to
 * consent-check's stated blind spot about new analytics/memory readers.
 */

const MESHI_JOURNAL_KINDS = ["nickname", "keepsake", "thread"] as const;
// The closed union, kept as a value so the gate can pin it; a new kind is a
// new consent argument, not a string.
void MESHI_JOURNAL_KINDS;

const NICKNAME_MAX = 32;
const KEEPSAKE_MAX = 500;
const THREAD_MAX = 1000;
const THREAD_TTL_DAYS = 30;
/** Recall is budgeted: newest-first until this many characters, then stop.
 *  The FULL list exists only on the review surfaces, never in a prompt. */
const RECALL_BUDGET = 3000;

const MESHI_JOURNAL_CAPS = {
  free: { keepsakes: 5, thread: 0 },
  pro: { keepsakes: 100, thread: 1 },
} as const;

/** Branches on the entitlement UNION (founder + gift + paid), never the raw
 *  column — a founder or gift recipient must not lose their journal mid-gift. */
function resolveJournalCaps(user: { username?: string | null; isMeshPro?: boolean; meshProGiftUntil: Date | null }) {
  return hasMeshPro(user) ? MESHI_JOURNAL_CAPS.pro : MESHI_JOURNAL_CAPS.free;
}

type JournalUser = { id: string; username?: string | null; isMeshPro?: boolean; meshProGiftUntil: Date | null };

export async function getJournalGrant(userId: string) {
  return prisma.meshiJournalGrant.findUnique({ where: { userId }, select: { id: true, grantedAt: true } });
}

/** Consent, recorded. Idempotent — a second grant is the first one. */
export async function grantMeshiJournal(userId: string) {
  const existing = await getJournalGrant(userId);
  if (existing) return existing;
  return prisma.meshiJournalGrant.create({ data: { userId }, select: { id: true, grantedAt: true } });
}

/**
 * THE single teardown. Deleting the grant row is the withdrawal; the schema
 * cascade removes every entry. Nothing is flagged, archived, or hidden —
 * there is no column for that on purpose.
 */
export async function withdrawMeshiJournal(userId: string) {
  await prisma.meshiJournalGrant.deleteMany({ where: { userId } });
}

function cleanOwnerText(text: string, max: number) {
  return sanitizeForDisplay(text.trim().replace(/\s+/g, " ")).slice(0, max).trim();
}

/**
 * "Remember that…" — a keepsake, from the owner's own words. Refuses without
 * a grant; refuses at cap. The at-cap copy deliberately never names Pro.
 */
export async function rememberKeepsake(user: JournalUser, text: string) {
  const grant = await getJournalGrant(user.id);
  if (!grant) return { error: "no-grant" as const };

  const value = cleanOwnerText(text, KEEPSAKE_MAX);
  if (!value) return { error: "empty" as const };

  const caps = resolveJournalCaps(user);
  const held = await prisma.meshiJournalEntry.count({ where: { grantId: grant.id, kind: "keepsake" } });
  if (held >= caps.keepsakes) {
    return { error: "at-cap" as const, message: "My journal page is full — want to let one go first? Say “what do you remember” and pick one to forget." };
  }

  const entry = await prisma.meshiJournalEntry.create({
    data: { grantId: grant.id, kind: "keepsake", value },
    select: { id: true, value: true },
  });
  return { entry };
}

/** The chosen name — one slot-shaped entry, overwritten in place. */
export async function setNickname(user: JournalUser, name: string) {
  const grant = await getJournalGrant(user.id);
  if (!grant) return { error: "no-grant" as const };

  const value = cleanOwnerText(name, NICKNAME_MAX);
  if (!value) return { error: "empty" as const };

  const existing = await prisma.meshiJournalEntry.findFirst({
    where: { grantId: grant.id, kind: "nickname" },
    select: { id: true },
  });
  if (existing) {
    await prisma.meshiJournalEntry.update({ where: { id: existing.id }, data: { value } });
  } else {
    await prisma.meshiJournalEntry.create({ data: { grantId: grant.id, kind: "nickname", value } });
  }
  return { value };
}

/**
 * The open thread: a verbatim tail of the OWNER'S OWN last message — never
 * the model's reply, never grounded context (a model-authored digest could
 * smuggle third-party names into a durable row that outlives their consent).
 * Single row, overwritten; 30-day shelf life; Pro only. Requires the live
 * read rule too — a paused rule must not keep accumulating memory.
 */
export async function saveThread(user: JournalUser, ownText: string) {
  const grant = await getJournalGrant(user.id);
  if (!grant) return;
  if (!(await hasMeshiConsent(user.id))) return;
  if (resolveJournalCaps(user).thread < 1) return;

  const value = cleanOwnerText(ownText, THREAD_MAX);
  if (!value) return;
  const expiresAt = new Date(Date.now() + THREAD_TTL_DAYS * 24 * 60 * 60 * 1000);

  const existing = await prisma.meshiJournalEntry.findFirst({
    where: { grantId: grant.id, kind: "thread" },
    select: { id: true },
  });
  if (existing) {
    await prisma.meshiJournalEntry.update({ where: { id: existing.id }, data: { value, expiresAt } });
  } else {
    await prisma.meshiJournalEntry.create({ data: { grantId: grant.id, kind: "thread", value, expiresAt } });
  }
}

export type JournalDigest = {
  nickname: string | null;
  grantedAt: Date;
  keepsakes: string[];
  thread: string | null;
};

/**
 * What the Meshi may know right now — the ENGINE-DOOR repetition: this
 * re-checks the grant AND the live read rule itself, so no caller can hoist
 * the adjudication away from the data. Computed fresh per request (no memo —
 * a cached digest survives withdrawal). Budgeted: newest keepsakes first
 * until RECALL_BUDGET characters; an expired thread reads as absent and is
 * swept. Pro-only kinds simply don't load below the Pro caps.
 */
export async function recallJournalDigest(user: JournalUser): Promise<JournalDigest | null> {
  const grant = await getJournalGrant(user.id);
  if (!grant) return null;
  if (!(await hasMeshiConsent(user.id))) return null;

  const caps = resolveJournalCaps(user);
  const entries = await prisma.meshiJournalEntry.findMany({
    where: { grantId: grant.id },
    select: { id: true, kind: true, value: true, expiresAt: true },
    orderBy: { createdAt: "desc" },
  });

  const now = Date.now();
  const expiredThreadIds = entries
    .filter((e) => e.kind === "thread" && e.expiresAt && e.expiresAt.getTime() <= now)
    .map((e) => e.id);
  if (expiredThreadIds.length) {
    await prisma.meshiJournalEntry.deleteMany({ where: { id: { in: expiredThreadIds } } });
  }

  const nickname = entries.find((e) => e.kind === "nickname")?.value ?? null;
  const liveThread = caps.thread > 0
    ? entries.find((e) => e.kind === "thread" && (!e.expiresAt || e.expiresAt.getTime() > now))?.value ?? null
    : null;

  let budget = RECALL_BUDGET - (nickname?.length ?? 0) - (liveThread?.length ?? 0);
  const keepsakes: string[] = [];
  for (const entry of entries) {
    if (entry.kind !== "keepsake") continue;
    if (entry.value.length > budget) break;
    keepsakes.push(entry.value);
    budget -= entry.value.length;
  }

  return { nickname, grantedAt: grant.grantedAt, keepsakes, thread: liveThread };
}

/**
 * Review surfaces: ownership only, deliberately NOT consent-gated — someone
 * who paused the read rule must still be able to see and delete everything.
 */
export async function listJournal(userId: string) {
  const grant = await getJournalGrant(userId);
  if (!grant) return null;
  const entries = await prisma.meshiJournalEntry.findMany({
    where: { grantId: grant.id },
    select: { id: true, kind: true, value: true, createdAt: true, expiresAt: true },
    orderBy: [{ kind: "asc" }, { createdAt: "desc" }],
  });
  return { grantedAt: grant.grantedAt, entries };
}

/** Forget one thing — deleted, not hidden. Ownership only. */
export async function forgetEntry(userId: string, entryId: string) {
  const grant = await getJournalGrant(userId);
  if (!grant) return { error: "no-grant" as const };
  const removed = await prisma.meshiJournalEntry.deleteMany({
    where: { id: entryId, grantId: grant.id },
  });
  return removed.count === 1 ? { ok: true as const } : { error: "not-found" as const };
}

// ─── The journal's spoken verbs ─────────────────────────────────

export type JournalIntent =
  | { kind: "remember"; text: string }
  | { kind: "nickname"; text: string }
  | { kind: "list" }
  | { kind: "forget-all" }
  | { kind: "forget"; text: string }
  | { kind: "grant" };

/**
 * Pure text matching for the chat surface — the handlers call the lib, which
 * re-checks the grant itself, so this parses and never decides.
 */
export function detectJournalIntent(message: string): JournalIntent | null {
  const text = message.trim();

  const remember = /^(?:meshi[,!]?\s*)?(?:please\s+)?remember(?:\s+that)?\s+(.+)$/i.exec(text);
  if (remember) return { kind: "remember", text: remember[1].trim() };

  const nickname = /^(?:meshi[,!]?\s*)?(?:please\s+)?call me\s+(.+)$/i.exec(text);
  if (nickname) return { kind: "nickname", text: nickname[1].trim().replace(/[.!]+$/, "") };

  if (/^(?:meshi[,!]?\s*)?what do you remember\??$/i.test(text)) return { kind: "list" };

  if (/^(?:meshi[,!]?\s*)?forget everything\.?$/i.test(text)) return { kind: "forget-all" };

  const forget = /^(?:meshi[,!]?\s*)?forget\s+(.+)$/i.exec(text);
  if (forget) return { kind: "forget", text: forget[1].trim().replace(/[.!]+$/, "") };

  if (/^(?:yes[,.]?\s*)?(?:please\s+)?(?:keep|start)\s+(?:a|the|your)?\s*journal\.?$/i.test(text)) {
    return { kind: "grant" };
  }

  return null;
}
