import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { durableRateLimit } from "@/lib/durable-rate-limit";
import {
  forgetEntry,
  getJournalGrant,
  grantMeshiJournal,
  rememberKeepsake,
  setNickname,
  withdrawMeshiJournal,
} from "@/lib/meshi-memory";
import { isSameOriginRequest, readJsonObject } from "@/lib/request-guard";
import { rateLimit } from "@/lib/security";

/**
 * MESHI'S JOURNAL — the write door.
 *
 * Adjudication happens BEFORE the action switch (the meshi-actions precedent:
 * one route taught the rule late is the bug class this ordering exists for).
 * `grant` and `forget-all` are the two verbs that may run WITHOUT an existing
 * grant — one creates the consent, the other is idempotent teardown; every
 * remembering verb requires the grant and refuses 403 without it.
 *
 * No notifications from any path here, ever. Deletion is deletion: forget-all
 * removes the grant row and the schema cascade takes every entry.
 */

type JournalAction = "grant" | "remember" | "set-nickname" | "forget-entry" | "forget-all";

export async function POST(req: Request) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await readJsonObject(req)) as { action?: JournalAction; text?: string; entryId?: string };
    const action = body.action;
    if (!action) {
      return NextResponse.json({ error: "Action is required" }, { status: 400 });
    }

    // Both limiters, matching the other Meshi write routes: the in-memory one
    // answers fast, the durable one is the real ceiling on serverless.
    const rl = rateLimit(`meshi-journal:${user.id}`, 30, 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Slow down a moment." }, { status: 429 });
    }
    const durableRl = await durableRateLimit(`meshi-journal:${user.id}`, 30, 60 * 1000);
    if (!durableRl.allowed) {
      return NextResponse.json({ error: "Slow down a moment." }, { status: 429 });
    }

    // THE JOURNAL RULE, adjudicated before the switch: no grant row means the
    // journal does not exist — fail-closed — and every remembering verb is
    // refused here, not inside its branch where a new verb could forget to ask.
    const grant = await getJournalGrant(user.id);
    if (!grant && action !== "grant" && action !== "forget-all") {
      return NextResponse.json(
        { error: "Meshi's journal is off. Turn it on first — nothing is remembered without it." },
        { status: 403 },
      );
    }

    switch (action) {
      case "grant": {
        const created = await grantMeshiJournal(user.id);
        return NextResponse.json({ ok: true, grantedAt: created.grantedAt });
      }
      case "remember": {
        const result = await rememberKeepsake(user, String(body.text ?? ""));
        if ("error" in result) {
          if (result.error === "at-cap") return NextResponse.json({ error: result.message }, { status: 409 });
          if (result.error === "empty") return NextResponse.json({ error: "Nothing to remember." }, { status: 400 });
          return NextResponse.json({ error: "Meshi's journal is off." }, { status: 403 });
        }
        return NextResponse.json({ ok: true, entryId: result.entry.id });
      }
      case "set-nickname": {
        const result = await setNickname(user, String(body.text ?? ""));
        if ("error" in result) {
          if (result.error === "empty") return NextResponse.json({ error: "That name came through empty." }, { status: 400 });
          return NextResponse.json({ error: "Meshi's journal is off." }, { status: 403 });
        }
        return NextResponse.json({ ok: true, nickname: result.value });
      }
      case "forget-entry": {
        const result = await forgetEntry(user.id, String(body.entryId ?? ""));
        if ("error" in result) {
          return NextResponse.json({ error: "That memory is already gone." }, { status: 404 });
        }
        return NextResponse.json({ ok: true });
      }
      case "forget-all": {
        // Deleted, not hidden: the grant row goes and the cascade takes every
        // entry. Idempotent — forgetting an absent journal is already done.
        await withdrawMeshiJournal(user.id);
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Meshi journal error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
