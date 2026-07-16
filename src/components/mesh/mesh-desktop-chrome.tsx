"use client";

import Link from "next/link";
import { ArrowRight, Globe2, MessageCircle, ShieldCheck } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { formatRelativeTime } from "@/lib/utils";
import type { MeshPlatform, MeshRecentComment } from "./mesh-data";

type MeshDesktopChromeProps = {
  platforms?: MeshPlatform[];
  recentComments?: MeshRecentComment[];
};

function platformLabel(platform: string) {
  const value = platform.toLowerCase();
  if (value === "twitter" || value === "x") return "X";
  if (value === "meshme" || value === "mesh") return "Mesh.me";
  return platform.charAt(0).toUpperCase() + platform.slice(1);
}

export function MeshDesktopChrome({ platforms = [], recentComments = [] }: MeshDesktopChromeProps) {
  const latestCommentLink = recentComments[0]?.post.id ? `/feed/${recentComments[0].post.id}` : "/feed";
  const manageHref = platforms[0]?.manageHref || "/connected-accounts";
  const sourcesHref = platforms[0]?.sourcesHref || "/content-hub";

  return (
    <>
      <div className="pointer-events-none absolute right-4 top-4 z-30 hidden w-[min(336px,calc(100vw-2rem))] flex-col gap-3 lg:flex">
        <section className="pointer-events-auto mesh-surface mesh-pop-in rounded-[28px] border border-[var(--mesh-border)] p-4 shadow-[var(--shadow-lg)]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Globe2 size={16} className="text-[var(--mesh-blue)]" />
              <h3 className="text-sm font-bold text-[var(--mesh-text)]">Platforms</h3>
            </div>
            <Link href={manageHref} className="text-xs font-semibold text-[var(--mesh-blue)]">
              Manage
            </Link>
          </div>

          {platforms.length > 0 ? (
            <div className="space-y-2">
              {platforms.slice(0, 4).map((platform) => (
                <div
                  key={platform.id}
                  className="rounded-2xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] px-3 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--mesh-text)]">
                        {platformLabel(platform.platform)}
                      </p>
                      <p className="truncate text-xs text-[var(--mesh-text-secondary)]">
                        {platform.platformUsername ? `@${platform.platformUsername}` : "Connected account"}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/12 px-2 py-1 text-[10px] font-bold text-emerald-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      Connected
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-[11px] text-[var(--mesh-text-secondary)]">
                    <span className="rounded-full border border-[var(--mesh-border)] px-2 py-1">Posts {platform.counts.posts}</span>
                    <span className="rounded-full border border-[var(--mesh-border)] px-2 py-1">Comments {platform.counts.comments}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] px-3 py-4 text-sm text-[var(--mesh-text-secondary)]">
              No connected platforms yet.
            </div>
          )}

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Link
              href={sourcesHref}
              className="mesh-pressable inline-flex items-center justify-between rounded-2xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] px-3 py-2.5 text-sm font-semibold text-[var(--mesh-text)]"
            >
              View all sources
              <ArrowRight size={15} className="text-[var(--mesh-text-secondary)]" />
            </Link>
          </div>
        </section>

        <section className="pointer-events-auto mesh-surface mesh-pop-in rounded-[28px] border border-[var(--mesh-border)] p-4 shadow-[var(--shadow-lg)]">
          <div className="mb-3 flex items-center gap-2">
            <MessageCircle size={16} className="text-[var(--mesh-blue)]" />
            <h3 className="text-sm font-bold text-[var(--mesh-text)]">Comments</h3>
          </div>

          {recentComments.length > 0 ? (
            <div className="space-y-2">
              {recentComments.slice(0, 3).map((comment) => (
                <div
                  key={comment.id}
                  className="rounded-2xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] px-3 py-3"
                >
                  <div className="flex items-start gap-3">
                    <Avatar src={comment.author.avatarUrl} alt={comment.author.displayName || comment.author.username} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-semibold text-[var(--mesh-text)]">
                          {comment.author.displayName || comment.author.username}
                        </p>
                        {comment.author.isVerified && <ShieldCheck size={13} className="shrink-0 text-[var(--mesh-blue)]" />}
                        <span className="text-[11px] text-[var(--mesh-text-secondary)]">
                          {formatRelativeTime(comment.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm leading-6 text-[var(--mesh-text-secondary)]">
                        {comment.content}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[var(--mesh-text-secondary)]">
                        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--mesh-border)] px-2 py-1">
                          <MessageCircle size={12} />
                          {comment.replyCount} replies
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] px-3 py-4 text-sm text-[var(--mesh-text-secondary)]">
              No recent comments yet.
            </div>
          )}

          <Link
            href={latestCommentLink}
            className="mesh-pressable mt-3 inline-flex w-full items-center justify-center rounded-2xl bg-[var(--mesh-blue)] px-3 py-2.5 text-sm font-semibold text-white"
          >
            Join the conversation
          </Link>
        </section>
      </div>

    </>
  );
}
