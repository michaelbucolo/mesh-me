"use client";

// THE ROOM THAT WAS ALREADY BUILT AND HAD NO DOOR.
//
// src/app/api/mechat/sessions/** is 560 lines of working co-browse: a positioned
// item queue, keep/skip votes, a current item, participants, invites, calls. It
// has five Prisma models behind it. And a grep for "mechat/sessions" across every
// non-API file in src returned NOTHING — six MeChat components exist and not one
// of them ever called it. A whole feature, shipped and unreachable.
//
// This is the door.
//
// ── WHY A QUEUE AND NOT A SECOND FEED ───────────────────────────────────────
//
// Watching something at the same time as someone else is the part of the
// internet that stayed good, and no feed does it: a feed is a private surface
// that happens to contain other people's things. Here the queue is ONE object
// that several people can see, add to and reorder, and what is on the wall right
// now is the same for everybody in the room.
//
// Votes are keep/skip, not a like count. A like is a verdict recorded forever; a
// keep is a preference about WHAT WE DO NEXT, and it expires the moment the
// queue moves on. That is the difference between scoring content and deciding
// together, and it is why this cannot be a leaderboard.

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2, Plus, SkipForward, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PlatformLogo } from "@/components/platform/platform-logo";
import { cn } from "@/lib/utils";
import { EASE_OUT } from "@/lib/motion";

type RoomVote = { id: string; itemId: string; userId: string; vote: string };
export type RoomItem = {
  id: string;
  sourcePlatform: string;
  sourceUrl: string | null;
  title: string | null;
  content: string | null;
  position: number;
  addedById: string;
  votes: RoomVote[];
};
type RoomParticipant = {
  userId: string;
  user: { id: string; username: string; displayName: string; avatarUrl: string | null };
};
export type Room = {
  id: string;
  title: string;
  status: string;
  currentItemId: string | null;
  items: RoomItem[];
  participants: RoomParticipant[];
};

// PATCH, NOT POST — and this is the one thing that only driving it revealed.
//
// The route exports GET and PATCH. Every action verb reads like a creation
// ("add-item", "vote"), so a client written from the action names alone reaches
// for POST, gets a bare 405 with no body, and looks like an auth problem. I did
// exactly that. It is worth wondering whether that is part of why this API sat
// unreachable for so long.
async function act(sessionId: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/mechat/sessions/${sessionId}`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "That didn't work");
  return data;
}

function tallyOf(item: RoomItem) {
  let keep = 0;
  let skip = 0;
  for (const v of item.votes) {
    if (v.vote === "keep") keep += 1;
    else if (v.vote === "skip") skip += 1;
  }
  return { keep, skip };
}

export function CoBrowseRoom({
  sessionId,
  viewerId,
  onClose,
}: {
  sessionId: string;
  viewerId: string;
  onClose?: () => void;
}) {
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draftUrl, setDraftUrl] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/mechat/sessions/${sessionId}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Could not open the room");
      const data = await res.json();
      setRoom(data.session ?? null);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open the room");
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
    // A SHARED object needs to be shared, so it re-reads while the room is open.
    // Four seconds, not four hundred milliseconds: this is people deciding what to
    // watch, not a cursor position, and hammering the endpoint to feel "live"
    // would cost battery for a responsiveness nobody asked for.
    const timer = setInterval(() => void load(), 4000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  async function run(key: string, body: Record<string, unknown>) {
    setBusy(key);
    setError(null);
    try {
      await act(sessionId, body);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work");
    } finally {
      setBusy(null);
    }
  }

  async function addItem(event: React.FormEvent) {
    event.preventDefault();
    const url = draftUrl.trim();
    if (!url) return;
    await run("add", { action: "add-item", sourceUrl: url, title: url.replace(/^https?:\/\//, "").slice(0, 80) });
    setDraftUrl("");
    setAdding(false);
  }

  if (error && !room) {
    return (
      <div className="rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface)] p-4 text-sm text-[var(--ds-danger)]">
        {error}
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex items-center gap-2 rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface)] p-4 text-sm text-[var(--text-muted)]">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Opening the room…
      </div>
    );
  }

  const current = room.items.find((i) => i.id === room.currentItemId) ?? null;
  const queue = room.items.filter((i) => i.id !== room.currentItemId);

  return (
    <section className="grid gap-3 rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface)] p-4">
      <header className="flex items-center gap-2">
        <Users className="size-4 shrink-0 text-[var(--accent-text)]" aria-hidden="true" />
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--text-primary)]">{room.title}</h2>
        <div className="flex -space-x-1.5">
          {room.participants.slice(0, 5).map((p) => (
            <Avatar key={p.userId} src={p.user.avatarUrl} alt={p.user.displayName || p.user.username} size="xs" />
          ))}
        </div>
        {onClose && (
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        )}
      </header>

      {/* ON THE WALL. One item, the same one for everybody. */}
      <AnimatePresence mode="wait">
        {current ? (
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.26, ease: EASE_OUT }}
            className="grid gap-2 rounded-[var(--ds-radius-md)] border border-[var(--accent)]/40 bg-[var(--bg-primary)]/45 p-3.5"
          >
            <div className="flex items-center gap-2">
              <PlatformLogo platform={current.sourcePlatform} size={18} className="shrink-0" />
              <p className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--text-primary)]">
                {current.title || current.sourceUrl || "Untitled"}
              </p>
            </div>
            {current.content && (
              <p className="line-clamp-3 text-xs leading-5 text-[var(--text-secondary)]">{current.content}</p>
            )}
            {current.sourceUrl && (
              <a
                href={current.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-xs font-semibold text-[var(--accent-text)] underline underline-offset-4"
              >
                Open ↗
              </a>
            )}
            <VoteRow
              item={current}
              viewerId={viewerId}
              busy={busy === `vote-${current.id}`}
              onVote={(vote) => run(`vote-${current.id}`, { action: "vote", itemId: current.id, vote })}
            />
          </motion.div>
        ) : (
          <motion.p
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-[var(--ds-radius-md)] border border-dashed border-[var(--ds-border)] px-3.5 py-6 text-center text-sm text-[var(--text-muted)]"
          >
            Nothing on the wall yet. Add a link and it goes up for everyone here.
          </motion.p>
        )}
      </AnimatePresence>

      {/* NEXT UP. Tapping one puts it on the wall for the whole room. */}
      {queue.length > 0 && (
        <ul className="grid gap-1.5">
          {queue.map((item, i) => {
            const { keep, skip } = tallyOf(item);
            return (
              <motion.li
                key={item.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: Math.min(i, 6) * 0.03 }}
              >
                <button
                  type="button"
                  onClick={() => run(`focus-${item.id}`, { action: "set-current-item", itemId: item.id })}
                  disabled={busy !== null}
                  className="ds-focus-ring flex w-full items-center gap-2 rounded-[var(--ds-radius-md)] border border-[var(--ds-border)] bg-[var(--bg-primary)]/35 px-3 py-2 text-left transition-colors hover:border-[var(--accent)]/45"
                >
                  <PlatformLogo platform={item.sourcePlatform} size={16} className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-xs text-[var(--text-secondary)]">
                    {item.title || item.sourceUrl || "Untitled"}
                  </span>
                  {(keep > 0 || skip > 0) && (
                    <span className="shrink-0 text-[0.6875rem] tabular-nums text-[var(--text-muted)]">
                      {keep > 0 && `${keep} keep`}
                      {keep > 0 && skip > 0 && " · "}
                      {skip > 0 && `${skip} skip`}
                    </span>
                  )}
                </button>
              </motion.li>
            );
          })}
        </ul>
      )}

      {adding ? (
        <form onSubmit={addItem} className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={draftUrl}
            onChange={(e) => setDraftUrl(e.target.value)}
            placeholder="Paste a link"
            className="ds-focus-ring min-w-0 flex-1 rounded-[var(--ds-radius-md)] border border-[var(--ds-border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)]"
            aria-label="Link to add to the room"
          />
          <Button type="submit" size="sm" loading={busy === "add"} disabled={!draftUrl.trim()}>
            Add
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>
            Cancel
          </Button>
        </form>
      ) : (
        <Button type="button" variant="secondary" size="sm" onClick={() => setAdding(true)} className="justify-self-start">
          <Plus className="size-4" aria-hidden="true" />
          Add something
        </Button>
      )}

      {error && <p className="text-xs text-[var(--ds-danger)]">{error}</p>}
    </section>
  );
}

/** Keep or skip — a preference about what happens NEXT, not a score. */
function VoteRow({
  item,
  viewerId,
  busy,
  onVote,
}: {
  item: RoomItem;
  viewerId: string;
  busy: boolean;
  onVote: (vote: "keep" | "skip") => void;
}) {
  const mine = item.votes.find((v) => v.userId === viewerId)?.vote ?? null;
  const { keep, skip } = tallyOf(item);

  return (
    <div className="flex items-center gap-2">
      {(["keep", "skip"] as const).map((vote) => {
        const active = mine === vote;
        const count = vote === "keep" ? keep : skip;
        return (
          <button
            key={vote}
            type="button"
            onClick={() => onVote(vote)}
            disabled={busy}
            aria-pressed={active}
            className={cn(
              "ds-focus-ring inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
              active
                ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast,#fff)]"
                : "border-[var(--ds-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
            )}
          >
            {vote === "keep" ? (
              <Check className="size-3.5" aria-hidden="true" />
            ) : (
              <SkipForward className="size-3.5" aria-hidden="true" />
            )}
            {vote === "keep" ? "Keep" : "Skip"}
            {count > 0 && <span className="tabular-nums opacity-80">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
