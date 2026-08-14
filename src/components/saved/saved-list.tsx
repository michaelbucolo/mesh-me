"use client";

// THE UTILITY DOOR FOR SAVES.
//
// The profile's Collection tab is identity display — "what I keep" as part of
// who you are. This list is the tool: everything you saved, wherever it came
// from, newest save first, with a Remove that actually removes. Every platform
// imprisons saves inside its own app; one list spanning all of them — reachable
// from the command palette in a keystroke — is the "save it for tonight"
// muscle an aggregator can uniquely have.

import { useState, useTransition } from "react";
import Link from "next/link";
import { Bookmark, ExternalLink, Heart, MessageCircle, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { PlatformLogo } from "@/components/platform/platform-logo";
import { useToast } from "@/components/ui/toast";
import { toggleSavePost } from "@/lib/actions";
import { formatCount, formatRelativeTime, safeHref } from "@/lib/utils";

export type SavedRow =
  | {
      kind: "native";
      id: string;
      postId: string;
      content: string;
      authorName: string;
      authorUsername: string;
      authorAvatarUrl: string | null;
      reactionCount: number;
      commentCount: number;
      savedAtMs: number;
    }
  | {
      kind: "external";
      id: string;
      refId: string;
      platform: string | null;
      title: string | null;
      url: string | null;
      thumbnailUrl: string | null;
      authorName: string | null;
      savedAtMs: number;
    };

export function SavedList({ initial }: { initial: SavedRow[] }) {
  const [rows, setRows] = useState(initial);
  const [, startTransition] = useTransition();
  const { addToast } = useToast();

  const remove = (row: SavedRow) => {
    const previous = rows;
    setRows((current) => current.filter((r) => r.id !== row.id));
    startTransition(async () => {
      try {
        if (row.kind === "native") {
          const result = await toggleSavePost(row.postId);
          if (result && "error" in result) throw new Error(String(result.error));
        } else {
          // /api/saves POST is a toggle — refId alone unsaves.
          const response = await fetch("/api/saves", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refId: row.refId }),
          });
          if (!response.ok) throw new Error();
        }
      } catch {
        setRows(previous);
        addToast("Couldn't remove that from your saved list", "error");
      }
    });
  };

  if (rows.length === 0) {
    return (
      <section className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-6 py-12 text-center">
        <Bookmark size={22} aria-hidden="true" className="text-[var(--text-muted)]" />
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Nothing saved yet</h2>
        <p className="max-w-sm text-sm leading-6 text-[var(--text-secondary)]">
          The bookmark on any post — from mesh.me or any platform — lands here, in one list.
        </p>
      </section>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => {
        const open = row.kind === "external" ? safeHref(row.url) : `/feed/${row.postId}`;
        return (
          <li
            key={row.id}
            data-testid="saved-row"
            className="relative rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4 transition-colors hover:border-[var(--border-secondary)]"
          >
            <div className="flex items-start gap-3">
              {row.kind === "external" ? (
                row.thumbnailUrl ? (
                  <>
                    {/* A bookmark must outlive the cache that fed it — and its
                        thumbnail URL. A rotted host rendered the browser's
                        broken-image glyph (audit 2); onError degrades to the
                        same calm logo tile as a missing thumbnail. */}
                    {/* eslint-disable-next-line @next/next/no-img-element -- snapshot thumbnails are remote platform URLs; next/image adds a loader round-trip for a 64px preview. */}
                    <img
                      src={row.thumbnailUrl}
                      alt=""
                      className="h-16 w-16 shrink-0 rounded-xl object-cover"
                      onError={(event) => {
                        const img = event.currentTarget;
                        img.style.display = "none";
                        const fallback = img.nextElementSibling as HTMLElement | null;
                        if (fallback) fallback.style.display = "flex";
                      }}
                    />
                    {/* display controlled inline: the `hidden` attribute loses
                        to the flex class's display. */}
                    <span style={{ display: "none" }} className="h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-tertiary)]">
                      <PlatformLogo platform={row.platform || "meshme"} size={28} className="rounded-full" />
                    </span>
                  </>
                ) : (
                  <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-tertiary)]">
                    <PlatformLogo platform={row.platform || "meshme"} size={28} className="rounded-full" />
                  </span>
                )
              ) : (
                <Avatar src={row.authorAvatarUrl} alt={row.authorName} size="md" className="h-10 w-10 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {row.kind === "external" ? (
                    <PlatformLogo platform={row.platform || "meshme"} size={16} className="shrink-0 rounded-full" />
                  ) : null}
                  {(row.kind === "external" ? row.authorName : row.authorName) && (
                    <span className="truncate text-sm font-semibold text-[var(--text-primary)]">{row.authorName}</span>
                  )}
                  {row.kind === "native" && (
                    <span className="truncate text-xs text-[var(--text-muted)]">@{row.authorUsername}</span>
                  )}
                  <span className="text-xs text-[var(--text-muted)]">·</span>
                  <span className="text-xs text-[var(--text-muted)]">Saved {formatRelativeTime(new Date(row.savedAtMs))}</span>
                </div>
                {(row.kind === "external" ? row.title : row.content) ? (
                  <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-[var(--text-primary)]">
                    {row.kind === "external" ? row.title : row.content}
                  </p>
                ) : null}
                <div className="mt-2 flex items-center gap-4 text-xs text-[var(--text-muted)]">
                  {row.kind === "native" ? (
                    <>
                      <span className="flex items-center gap-1.5"><Heart size={14} aria-hidden="true" /> {formatCount(row.reactionCount)}</span>
                      <span className="flex items-center gap-1.5"><MessageCircle size={14} aria-hidden="true" /> {formatCount(row.commentCount)}</span>
                    </>
                  ) : null}
                  {open ? (
                    row.kind === "external" ? (
                      <a href={open} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-semibold text-[var(--accent-text)]">
                        <ExternalLink size={12} aria-hidden="true" /> Open
                      </a>
                    ) : (
                      <Link href={open} className="flex items-center gap-1 font-semibold text-[var(--accent-text)]">
                        <ExternalLink size={12} aria-hidden="true" /> Open
                      </Link>
                    )
                  ) : null}
                  <button
                    type="button"
                    onClick={() => remove(row)}
                    className="ml-auto flex min-h-11 items-center gap-1 rounded-md px-2 font-semibold text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                  >
                    <X size={13} aria-hidden="true" /> Remove
                  </button>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
