import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest, readJsonObject } from "@/lib/request-guard";
import { durableRateLimit } from "@/lib/durable-rate-limit";
import { decodeInk, encodeInk } from "@/lib/meshimap/ink";
import { DOODLE_TTL_MS, MAX_PER_AUTHOR } from "@/lib/meshimap/doodles";

// SENDING A DRAWING.
//
// ── YOU CANNOT DRAW WHERE YOU ARE NOT ──────────────────────────────────────
//
// A doodle renders at its author's pin and is visible exactly where that pin
// is. So sending one without a live location is not "a message with no
// position" — it is a message with no audience and no place, which would sit
// in the table until its TTL doing nothing. The endpoint refuses it, and the
// error says the actual reason rather than a generic 400.
//
// ── THE RATE LIMIT IS THE SHARED ONE ───────────────────────────────────────
//
// `durableRateLimit`, like every other limit on this codebase. A feature-local
// counter would be a bypass with extra steps, and an in-memory one resets on
// every cold start — which on serverless means no limit at all.

/** A dozen a minute. Enough to have a conversation, not enough to paper a
 * neighbourhood before anybody can report you. */
const SEND_LIMIT = 12;
const SEND_WINDOW_MS = 60_000;

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Ghost mode is server-authoritative everywhere else and this is no
  // exception: a ghosting account has no pin, so it has nowhere to draw.
  if (user.ghostMode) {
    return NextResponse.json({ error: "You're in ghost mode, so nobody can see you draw." }, { status: 409 });
  }

  const body = await readJsonObject(request);

  // VALIDATE BEFORE SPENDING THE LIMIT? No — the other way round. Checking the
  // limit first means a flood of malformed payloads still costs the attacker
  // their budget instead of costing us the parse.
  const limit = await durableRateLimit(`meshimap-doodle:${user.id}`, SEND_LIMIT, SEND_WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Slow down a moment.", retryInMs: limit.resetInMs },
      { status: 429 },
    );
  }

  const decoded = decodeInk(body.ink);
  if (!decoded.ok) {
    return NextResponse.json({ error: `That drawing didn't come through (${decoded.reason}).` }, { status: 400 });
  }
  // Store the CANONICAL re-encoding rather than the bytes that arrived. The
  // decoder only accepts canonical input today, so these are equal — writing
  // the re-encoding anyway means that stays true even if the decoder is ever
  // loosened, and it is one line.
  const ink = encodeInk(decoded.ink);

  const now = Date.now();
  const cutoff = new Date(now - DOODLE_TTL_MS);

  // You must be on the map to draw on it.
  const location = await prisma.userLocation.findUnique({
    where: { userId: user.id },
    select: { reportedAt: true, audience: true },
  });
  if (!location || location.audience === "nobody" || location.reportedAt < new Date(now - 60 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Put yourself on the map first — a drawing goes where you are." },
      { status: 409 },
    );
  }

  // Sweep on write, so the table stays small without a cron. Expired rows are
  // invisible to readers anyway; this is what stops them accumulating forever.
  await prisma.mapDoodle.deleteMany({ where: { createdAt: { lt: cutoff } } }).catch(() => undefined);

  await prisma.mapDoodle.create({ data: { userId: user.id, ink } });

  // Keep only this author's most recent few. The read caps per author too, but
  // capping here as well is what stops one person's history filling the table
  // between sweeps — and the read's cap alone would leave rows nobody sees.
  const mine = await prisma.mapDoodle.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true },
    skip: MAX_PER_AUTHOR,
  });
  if (mine.length > 0) {
    await prisma.mapDoodle
      .deleteMany({ where: { id: { in: mine.map((d) => d.id) } } })
      .catch(() => undefined);
  }

  return NextResponse.json({ ok: true });
}
