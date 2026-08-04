"use client";

// THE ONE INBOX.
//
// Deliberately a LIST, not a visualisation. The mesh is the picture of your
// presence and it earns that; an inbox is a queue you work through, and the
// fastest way to work through a queue is a list with the sender's face, the
// platform it came from, and the first line of what they said.
//
// The rule the last surface broke and this one keeps: SHOW REAL THINGS. Faces,
// platform marks, actual message text. If you cannot tell at a glance who is
// waiting on you and where, the inbox has not saved you opening the other app —
// which is the entire point.

import { useMemo, useState } from "react";
import Image from "next/image";
import { PlatformLogo } from "@/components/platform/platform-logo";
import type { InboxEntry, InboxRead } from "@/lib/inbox/read-inbox";

const INK = "#f2f4f8";
const INK_DIM = "#8b93a7";
const OWED = "#60a5fa";

type Tab = "needs-you" | "all" | "messages";

export function InboxView({ initial }: { initial: InboxRead }) {
  const [tab, setTab] = useState<Tab>("needs-you");
  const [platform, setPlatform] = useState<string | null>(null);

  // Filtering happens here rather than by refetching: the read already returned
  // every row it knows about, so a tab switch is instant instead of a spinner.
  // An inbox that stalls on every filter is one people stop opening.
  const shown = useMemo(() => {
    let rows = initial.entries;
    if (tab === "needs-you") rows = rows.filter((e) => e.awaitingYou);
    else if (tab === "messages") rows = rows.filter((e) => e.kind === "message");
    if (platform) rows = rows.filter((e) => e.platform === platform);
    return rows;
  }, [initial.entries, tab, platform]);

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col" data-testid="inbox">
      <header className="px-4 pt-5 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold" style={{ color: INK }}>
            Inbox
          </h1>
          {/* The other half of one place for everything: what reaches you, and
              what you send out. Putting them on the same screen is the point. */}
          <a
            href="/compose"
            className="shrink-0 rounded-full px-3.5 py-1.5 font-semibold"
            style={{ background: OWED, color: "#04060c", fontSize: 13.5 }}
          >
            Post everywhere
          </a>
        </div>
        <p className="mt-1 text-sm" style={{ color: INK_DIM }}>
          {summarise(initial)}
        </p>

        <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Filter inbox">
          <Chip
            label="Needs you"
            count={initial.counts.needsYou}
            active={tab === "needs-you"}
            onClick={() => setTab("needs-you")}
          />
          <Chip
            label="Messages"
            count={initial.counts.messages}
            active={tab === "messages"}
            onClick={() => setTab("messages")}
          />
          <Chip
            label="Everything"
            count={initial.counts.all}
            active={tab === "all"}
            onClick={() => setTab("all")}
          />
        </div>

        {initial.platforms.length > 1 && (
          <div className="mt-2 flex flex-wrap gap-2">
            <PlatformChip active={platform === null} onClick={() => setPlatform(null)}>
              All platforms
            </PlatformChip>
            {initial.platforms.map((p) => (
              <PlatformChip key={p} active={platform === p} onClick={() => setPlatform(p)}>
                <PlatformLogo platform={p} size={14} />
                <span className="ml-1.5">{labelOf(p)}</span>
              </PlatformChip>
            ))}
          </div>
        )}
      </header>

      <div className="mt-4 flex-1 overflow-y-auto px-2 pb-24 sm:px-4" data-testid="inbox-list">
        {shown.length === 0 ? (
          <Empty tab={tab} />
        ) : (
          <ul className="flex flex-col gap-1">
            {shown.map((entry) => (
              <li key={entry.id}>
                <Row entry={entry} nowMs={initial.nowMs} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Row({ entry, nowMs }: { entry: InboxEntry; nowMs: number }) {
  return (
    <a
      href={entry.href}
      data-testid="inbox-entry"
      data-owed={entry.awaitingYou ? "1" : "0"}
      data-platform={entry.platform}
      className="flex items-start gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-white/[0.04] focus:bg-white/[0.06] focus:outline-none"
      style={{
        // A left rule rather than a filled row: the thing you owe should be
        // findable at a glance without the list turning into stripes.
        borderLeft: entry.awaitingYou ? `2px solid ${OWED}` : "2px solid transparent",
      }}
    >
      <span className="relative shrink-0">
        <span
          className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full"
          style={{ background: "#0e1626", border: "1px solid #ffffff14" }}
        >
          {entry.who?.avatarUrl ? (
            <Image
              src={entry.who.avatarUrl}
              alt=""
              width={44}
              height={44}
              className="h-full w-full object-cover"
              unoptimized
            />
          ) : (
            <span style={{ color: INK, fontSize: 14, fontWeight: 600 }}>
              {initialsOf(entry.who?.name ?? entry.title)}
            </span>
          )}
        </span>

        {/* Which platform it came from — the whole reason this inbox exists. */}
        <span
          className="absolute -bottom-0.5 -right-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full"
          style={{ background: "#0b1220", border: "1px solid #ffffff1f" }}
        >
          <PlatformLogo platform={entry.platform} size={11} />
        </span>
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span
            className="truncate font-medium"
            style={{ color: INK, fontSize: 14.5 }}
          >
            {entry.who?.name ?? entry.title}
          </span>
          <span className="ml-auto shrink-0" style={{ color: INK_DIM, fontSize: 12 }}>
            {ago(entry.atMs, nowMs)}
          </span>
        </span>

        <span className="mt-0.5 block truncate" style={{ color: entry.unread ? INK : INK_DIM, fontSize: 13.5 }}>
          {entry.preview ?? entry.title}
        </span>

        {entry.awaitingYou && (
          <span className="mt-1 inline-block rounded-full px-2 py-0.5 font-semibold" style={{ background: `${OWED}22`, color: OWED, fontSize: 11 }}>
            {entry.kind === "message" ? "Reply" : "Waiting on you"}
          </span>
        )}
      </span>
    </a>
  );
}

function Chip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className="rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
      style={{
        background: active ? OWED : "#ffffff0d",
        color: active ? "#04060c" : INK,
      }}
    >
      {label}
      {/* A zero is shown as nothing rather than as "0" — the surface this
          replaces led with "0 new for you", which is a headline that says the
          screen has nothing to say. */}
      {count > 0 && (
        <span className="ml-1.5" style={{ opacity: active ? 0.75 : 0.55 }}>
          {count}
        </span>
      )}
    </button>
  );
}

function PlatformChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="flex items-center rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
      style={{
        background: active ? "#ffffff1a" : "transparent",
        color: active ? INK : INK_DIM,
        border: `1px solid ${active ? "#ffffff26" : "#ffffff12"}`,
      }}
    >
      {children}
    </button>
  );
}

/** Empty is a real state with something true to say, never a shrug. */
function Empty({ tab }: { tab: Tab }) {
  const text =
    tab === "needs-you"
      ? "Nothing is waiting on you. That is the good state."
      : tab === "messages"
        ? "No messages yet."
        : "Nothing has reached you yet.";
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <p style={{ color: INK, fontSize: 15, fontWeight: 500 }}>{text}</p>
      {tab === "needs-you" && (
        <a
          href="/connected-accounts"
          className="mt-3 rounded-full px-3.5 py-1.5 text-sm font-semibold"
          style={{ background: `${OWED}22`, color: OWED }}
        >
          Connect another platform
        </a>
      )}
    </div>
  );
}

function summarise(read: InboxRead): string {
  const n = read.counts.needsYou;
  const places = read.platforms.length;
  const where = places === 1 ? "1 place" : `${places} places`;
  if (n === 0) return `Nothing needs you · watching ${where}`;
  return `${n} ${n === 1 ? "thing needs" : "things need"} you · across ${where}`;
}

function labelOf(platform: string): string {
  if (platform === "mesh") return "mesh.me";
  if (platform === "twitter") return "X";
  return platform.charAt(0).toUpperCase() + platform.slice(1);
}

function initialsOf(title: string): string {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "·";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** Compact relative time. Absolute dates belong in the thread, not the queue. */
function ago(atMs: number, nowMs: number): string {
  const s = Math.max(0, Math.round((nowMs - atMs) / 1000));
  if (s < 60) return "now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d`;
  return `${Math.round(d / 7)}w`;
}
