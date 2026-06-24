"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Download,
  Loader2,
  LockKeyhole,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { createCommunity, createPost, markNotificationsRead } from "@/lib/actions";
import type { PlatformSection } from "./platform-suite";

type WorkspaceRow = {
  id: string;
  label: string;
  value: string;
  meta: string;
  href?: string;
};

type StatItem = {
  label: string;
  value: string;
};

type AccountSummary = {
  id: string;
  platform: string;
  username: string;
  status: string;
  isActive: boolean;
  posts: number;
};

type UserSearchResult = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

type LiveSummary = {
  rows: WorkspaceRow[];
  stats: StatItem[];
  accounts: AccountSummary[];
  emptyTitle: string;
  emptyBody: string;
  isMeshPro?: boolean;
};

type LoadState = "loading" | "ready" | "auth" | "error";

type ApiResult = {
  ok: boolean;
  status: number;
  data: Record<string, unknown>;
};

type ActionState = {
  type: "success" | "error" | "info";
  message: string;
} | null;

const MANUAL_PLATFORMS = [
  "bluesky",
  "applemusic",
  "mastodon",
  "substack",
  "medium",
  "devto",
  "behance",
  "whatsapp",
  "telegram",
  "signal",
  "line",
  "kakao",
  "viber",
  "wechat",
  "messenger",
  "tumblr",
];

const OAUTH_PLATFORMS = [
  "github",
  "discord",
  "spotify",
  "twitter",
  "twitch",
  "youtube",
  "instagram",
  "facebook",
  "linkedin",
  "reddit",
  "tiktok",
  "pinterest",
  "snapchat",
  "threads",
  "soundcloud",
  "patreon",
  "dribbble",
];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown, fallback = "") {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function formatNumber(value: unknown) {
  return asNumber(value).toLocaleString();
}

function truncate(value: string, length = 88) {
  return value.length > length ? `${value.slice(0, length - 3)}...` : value;
}

function fallbackSummary(fallbackRows: string[][]): LiveSummary {
  return {
    rows: fallbackRows.map((row, index) => ({
      id: `${row[0] ?? "row"}-${index}`,
      label: row[0] ?? "Ready",
      value: row[1] ?? "Live",
      meta: row[2] ?? "Available",
    })),
    stats: [
      { label: "Privacy", value: "First" },
      { label: "Security", value: "First" },
      { label: "Ads", value: "None" },
    ],
    accounts: [],
    emptyTitle: "Ready when you are",
    emptyBody: "Create an account or log in to turn this from a safe public preview into your live private workspace.",
  };
}

async function requestJson(path: string, init?: RequestInit): Promise<ApiResult> {
  const response = await fetch(path, {
    cache: "no-store",
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const data = asRecord(await response.json().catch(() => ({})));
  return { ok: response.ok, status: response.status, data };
}

function buildAccounts(data: Record<string, unknown>): AccountSummary[] {
  return asArray(data.accounts).map((item) => {
    const account = asRecord(item);
    const counts = asRecord(account._count);
    return {
      id: asString(account.id),
      platform: asString(account.platform, "platform"),
      username: asString(account.platformUsername || account.accountLabel, "not named"),
      status: asString(account.syncStatus, account.isActive ? "active" : "paused"),
      isActive: account.isActive !== false,
      posts: asNumber(counts.platformPosts),
    };
  }).filter((account) => account.id);
}

function buildRowsFromAccounts(accounts: AccountSummary[]): WorkspaceRow[] {
  return accounts.map((account) => ({
    id: account.id,
    label: account.platform,
    value: account.username,
    meta: `${account.isActive ? "Active" : "Paused"} - ${account.status} - ${account.posts.toLocaleString()} posts`,
    href: `/connected-accounts`,
  }));
}

function buildRowsFromFeed(data: Record<string, unknown>): WorkspaceRow[] {
  return asArray(data.posts).map((item) => {
    const post = asRecord(item);
    const author = asRecord(post.author);
    const counts = asRecord(post._count);
    return {
      id: asString(post.id),
      label: asString(author.displayName, "Mesh post"),
      value: truncate(asString(post.content, "No text content")),
      meta: `${formatNumber(counts.reactions)} likes - ${formatNumber(counts.comments)} comments`,
      href: `/feed/${asString(post.id)}`,
    };
  }).filter((row) => row.id);
}

function buildRowsFromPlatformContent(data: Record<string, unknown>): WorkspaceRow[] {
  return asArray(data.posts).map((item) => {
    const post = asRecord(item);
    const account = asRecord(post.connectedAccount);
    const title = asString(post.title) || asString(post.content, "Synced content");
    return {
      id: asString(post.id),
      label: asString(account.platform, "platform"),
      value: truncate(title, 78),
      meta: `${formatNumber(post.likeCount)} likes - ${formatNumber(post.commentCount)} comments - ${asString(post.visibility, "public")}`,
      href: asString(post.url) || undefined,
    };
  }).filter((row) => row.id);
}

function buildRowsFromCommunities(data: Record<string, unknown>): WorkspaceRow[] {
  return asArray(data.communities).map((item) => {
    const community = asRecord(item);
    const slug = asString(community.slug);
    return {
      id: asString(community.id) || slug,
      label: asString(community.name, "Community"),
      value: truncate(asString(community.description, asString(community.category, "Public community")), 78),
      meta: `${formatNumber(community.memberCount)} members - ${formatNumber(community.postCount)} posts`,
      href: slug ? `/communities/${slug}` : "/communities",
    };
  }).filter((row) => row.id);
}

function buildRowsFromSearch(data: Record<string, unknown>): WorkspaceRow[] {
  const users = asArray(data.users).map((item) => {
    const user = asRecord(item);
    const username = asString(user.username);
    return {
      id: `user-${asString(user.id, username)}`,
      label: asString(user.displayName, "Person"),
      value: username ? `@${username}` : "Mesh identity",
      meta: `${formatNumber(asRecord(user._count).followers)} followers`,
      href: username ? `/profile/${username}` : "/search",
    };
  });

  const posts = asArray(data.posts).map((item) => {
    const post = asRecord(item);
    return {
      id: `post-${asString(post.id)}`,
      label: "Post",
      value: truncate(asString(post.content, "Post result")),
      meta: `${formatNumber(asRecord(post._count).reactions)} likes`,
      href: `/feed/${asString(post.id)}`,
    };
  });

  const communities = asArray(data.communities).map((item) => {
    const community = asRecord(item);
    const slug = asString(community.slug);
    return {
      id: `community-${asString(community.id, slug)}`,
      label: asString(community.name, "Community"),
      value: truncate(asString(community.description, "Community result")),
      meta: `${formatNumber(asRecord(community._count).members)} members`,
      href: slug ? `/communities/${slug}` : "/communities",
    };
  });

  return [...users, ...posts, ...communities].filter((row) => row.id);
}

function buildRowsFromMesh(data: Record<string, unknown>): WorkspaceRow[] {
  const following = asArray(data.following).slice(0, 3).map((item) => {
    const user = asRecord(item);
    const username = asString(user.username);
    return {
      id: `following-${asString(user.id, username)}`,
      label: asString(user.displayName, "Connected person"),
      value: username ? `@${username}` : "Mesh connection",
      meta: `${formatNumber(user.followerCount)} followers - ${formatNumber(user.interactionCount)} interactions`,
      href: username ? `/profile/${username}` : "/mesh",
    };
  });
  const communities = buildRowsFromCommunities(data).slice(0, 3);
  const posts = asArray(data.posts).slice(0, 3).map((item) => {
    const post = asRecord(item);
    return {
      id: `mesh-post-${asString(post.id)}`,
      label: "Native post",
      value: truncate(asString(post.content, "Mesh post"), 78),
      meta: `${formatNumber(post.likeCount)} likes - ${formatNumber(post.commentCount)} comments`,
      href: `/feed/${asString(post.id)}`,
    };
  });
  return [...following, ...communities, ...posts];
}

async function loadLiveSummary(section: PlatformSection, fallbackRows: string[][]): Promise<{ state: LoadState; summary: LiveSummary; message?: string }> {
  const fallback = fallbackSummary(fallbackRows);

  try {
    if (section === "feed") {
      const feed = await requestJson("/api/feed/paginated?page=1&limit=10&source=all");
      if (feed.status === 401) return { state: "auth", summary: fallback };
      const rows = buildRowsFromFeed(feed.data);
      return {
        state: "ready",
        summary: {
          ...fallback,
          rows,
          stats: [
            { label: "Visible posts", value: String(rows.length) },
            { label: "Next page", value: asString(feed.data.nextPage, "none") },
            { label: "Source", value: "All" },
          ],
          emptyTitle: "Your feed is waiting",
          emptyBody: "Follow people, join communities, connect platforms, or make your first post.",
        },
      };
    }

    if (section === "mesh") {
      const mesh = await requestJson("/api/mesh");
      if (mesh.status === 401) return { state: "auth", summary: fallback };
      const stats = asRecord(mesh.data.stats);
      return {
        state: "ready",
        summary: {
          ...fallback,
          rows: buildRowsFromMesh(mesh.data),
          stats: [
            { label: "Following", value: formatNumber(stats.followingCount) },
            { label: "Followers", value: formatNumber(stats.followerCount) },
            { label: "Platforms", value: formatNumber(stats.connectedPlatformCount) },
            { label: "Posts", value: formatNumber(stats.postCount) },
          ],
          accounts: buildAccounts({ accounts: mesh.data.connectedAccounts }),
          emptyTitle: "Your Mesh is private and empty",
          emptyBody: "Connect platforms, follow people, join communities, and post to make your living map visible to you.",
        },
      };
    }

    if (section === "mechat") {
      const [messages, sessions] = await Promise.all([
        requestJson("/api/messages"),
        requestJson("/api/mechat/sessions"),
      ]);
      if (messages.status === 401 || sessions.status === 401) return { state: "auth", summary: fallback };
      const threads = asArray(messages.data.threads).map((item) => {
        const thread = asRecord(item);
        const user = asRecord(thread.otherUser);
        const last = asRecord(thread.lastMessage);
        return {
          id: asString(thread.id),
          label: asString(user.displayName, "Conversation"),
          value: truncate(asString(last.content, "No messages yet"), 78),
          meta: asString(thread.platform, "mesh"),
          href: `/messages/${asString(thread.id)}`,
        };
      }).filter((row) => row.id);
      const rooms = asArray(sessions.data.sessions).map((item) => {
        const room = asRecord(item);
        return {
          id: `room-${asString(room.id)}`,
          label: asString(room.title, "Group scrolling room"),
          value: asString(room.status, "draft"),
          meta: `${asArray(room.participants).length} people - ${asArray(room.items).length} items`,
          href: "/messages",
        };
      });
      return {
        state: "ready",
        summary: {
          ...fallback,
          rows: [...threads, ...rooms],
          stats: [
            { label: "Threads", value: String(threads.length) },
            { label: "Rooms", value: String(rooms.length) },
            { label: "Layer", value: "MeChat" },
          ],
          emptyTitle: "No conversations yet",
          emptyBody: "Start a chat or create a group scrolling session.",
        },
      };
    }

    if (section === "analytics") {
      const [security, analytics, accounts] = await Promise.all([
        requestJson("/api/security-hub/overview"),
        requestJson("/api/platform-content?view=analytics"),
        requestJson("/api/connected-accounts"),
      ]);
      if (security.status === 401 || analytics.status === 401 || accounts.status === 401) {
        return { state: "auth", summary: fallback };
      }
      const content = asRecord(security.data.content);
      const platformRows = asArray(analytics.data.analytics).map((item) => {
        const account = asRecord(item);
        return {
          id: `${asString(account.platform)}-${asString(account.platformUsername, "account")}`,
          label: asString(account.platform, "Platform"),
          value: `${formatNumber(account.postCount)} posts - ${formatNumber(account.followerCount)} followers`,
          meta: `${formatNumber(account.totalViews)} views - ${asString(account.syncStatus, "idle")}`,
          href: "/analytics",
        };
      });
      return {
        state: "ready",
        summary: {
          ...fallback,
          rows: platformRows,
          accounts: buildAccounts(accounts.data),
          stats: [
            { label: "Posts/photos", value: formatNumber(content.postsAndPhotos) },
            { label: "Videos", value: formatNumber(content.videos) },
            { label: "Comments", value: formatNumber(content.commentsAndReplies) },
            { label: "Apps", value: String(buildAccounts(accounts.data).length) },
          ],
          emptyTitle: "No synced analytics yet",
          emptyBody: "Connect platforms and run sync to build your private analytics center.",
        },
      };
    }

    if (section === "content" || section === "create") {
      const [content, accounts] = await Promise.all([
        requestJson("/api/platform-content?limit=10"),
        requestJson("/api/connected-accounts"),
      ]);
      if (content.status === 401 || accounts.status === 401) return { state: "auth", summary: fallback };
      return {
        state: "ready",
        summary: {
          ...fallback,
          rows: buildRowsFromPlatformContent(content.data),
          accounts: buildAccounts(accounts.data),
          stats: [
            { label: "Synced items", value: formatNumber(content.data.total) },
            { label: "Accounts", value: String(buildAccounts(accounts.data).length) },
            { label: "Mode", value: section === "create" ? "Create" : "Manage" },
          ],
          emptyTitle: "No synced content yet",
          emptyBody: "Create native Mesh posts now, then connect platforms for source-aware management.",
        },
      };
    }

    if (section === "connections") {
      const accounts = await requestJson("/api/connected-accounts");
      if (accounts.status === 401) return { state: "auth", summary: fallback };
      const accountList = buildAccounts(accounts.data);
      return {
        state: "ready",
        summary: {
          ...fallback,
          rows: buildRowsFromAccounts(accountList),
          accounts: accountList,
          stats: [
            { label: "Connected", value: String(accountList.length) },
            { label: "Active", value: String(accountList.filter((account) => account.isActive).length) },
            { label: "OAuth", value: String(OAUTH_PLATFORMS.length) },
          ],
          emptyTitle: "Connect with consent",
          emptyBody: "Start with OAuth where available or add a manual public account link.",
        },
      };
    }

    if (section === "notifications") {
      const notifications = await requestJson("/api/notifications?limit=12");
      if (notifications.status === 401) return { state: "auth", summary: fallback };
      const rows = asArray(notifications.data.notifications).map((item) => {
        const notification = asRecord(item);
        return {
          id: asString(notification.id),
          label: asString(notification.type, "Notification"),
          value: truncate(asString(notification.message, "Mesh.me activity"), 78),
          meta: notification.read ? "Read" : "Unread",
          href: asString(notification.postId) ? `/feed/${asString(notification.postId)}` : "/notifications",
        };
      }).filter((row) => row.id);
      return {
        state: "ready",
        summary: {
          ...fallback,
          rows,
          stats: [
            { label: "Unread", value: formatNumber(notifications.data.unreadCount) },
            { label: "Loaded", value: String(rows.length) },
            { label: "Hub", value: "On" },
          ],
          emptyTitle: "No alerts",
          emptyBody: "Mesh.me will keep notifications grouped and readable as activity arrives.",
        },
      };
    }

    if (section === "super-app") {
      const readiness = await requestJson("/api/super-app/readiness");
      if (readiness.status === 401) return { state: "auth", summary: fallback };
      const replacementJobs = asArray(readiness.data.replacementJobs ?? readiness.data.jobs ?? readiness.data.items);
      const rows = replacementJobs.map((item, index) => {
        const job = asRecord(item);
        return {
          id: asString(job.id, `job-${index}`),
          label: asString(job.label || job.name, "Replacement job"),
          value: asString(job.status || job.coverage, "Mapped"),
          meta: asString(job.description || job.note, "Readiness tracked"),
          href: "/super-app",
        };
      });
      return {
        state: "ready",
        summary: {
          ...fallback,
          rows,
          stats: [
            { label: "Readiness", value: asString(readiness.data.overallScore ?? readiness.data.score, "Live") },
            { label: "Gaps", value: String(asArray(readiness.data.gaps).length) },
            { label: "Updated", value: "Now" },
          ],
          emptyTitle: "Replacement map ready",
          emptyBody: "Use the planner to see what Mesh.me can already replace and what depends on platform permissions.",
        },
      };
    }

    if (section === "explore") {
      const explore = await requestJson("/api/explore?limit=10");
      const rows = [
        ...asArray(explore.data.users).map((item) => {
          const user = asRecord(item);
          const username = asString(user.username);
          return {
            id: `user-${asString(user.id, username)}`,
            label: asString(user.displayName, "Creator"),
            value: username ? `@${username}` : "Mesh identity",
            meta: `${formatNumber(user.followerCount)} followers - ${formatNumber(user.postCount)} posts`,
            href: username ? `/profile/${username}` : "/explore",
          };
        }),
        ...buildRowsFromCommunities(explore.data),
      ];
      return {
        state: "ready",
        summary: {
          ...fallback,
          rows,
          stats: [
            { label: "People", value: String(asArray(explore.data.users).length) },
            { label: "Posts", value: String(asArray(explore.data.posts).length) },
            { label: "Communities", value: String(asArray(explore.data.communities).length) },
          ],
          emptyTitle: "Explore is ready",
          emptyBody: "Follow people and join communities to personalize this surface.",
        },
      };
    }

    if (section === "communities") {
      const communities = await requestJson("/api/communities");
      return {
        state: "ready",
        summary: {
          ...fallback,
          rows: buildRowsFromCommunities(communities.data),
          stats: [
            { label: "Spaces", value: String(asArray(communities.data.communities).length) },
            { label: "Visibility", value: "Public" },
            { label: "Create", value: "Ready" },
          ],
          emptyTitle: "No communities yet",
          emptyBody: "Create the first shared space for cross-platform discussion.",
        },
      };
    }

    if (section === "search") {
      return {
        state: "ready",
        summary: {
          ...fallback,
          rows: [],
          stats: [
            { label: "Index", value: "Unified" },
            { label: "Privacy", value: "Scoped" },
            { label: "Min query", value: "2 chars" },
          ],
          emptyTitle: "Search from one field",
          emptyBody: "Type a name, post, topic, or community to search your Mesh.me world.",
        },
      };
    }

    if (section === "settings" || section === "profile" || section === "pro" || section === "feedback") {
      const settings = await requestJson("/api/settings");
      if (settings.status === 401) return { state: "auth", summary: fallback };
      const userSettings = asRecord(settings.data.settings);
      return {
        state: "ready",
        summary: {
          ...fallback,
          rows: [
            { id: "profile", label: "Profile", value: asString(userSettings.displayName, "Your identity"), meta: asString(userSettings.username, "username"), href: "/settings" },
            { id: "privacy", label: "Public profile", value: userSettings.isPublic === false ? "Off" : "On", meta: "User controlled", href: "/settings" },
            { id: "meshpro", label: "Mesh Pro", value: userSettings.isMeshPro ? "Active" : "Free", meta: "Optional upgrade", href: "/meshpro" },
          ],
          stats: [
            { label: "Privacy", value: userSettings.isPublic === false ? "Private" : "Public" },
            { label: "Discovery", value: userSettings.showInDiscovery === false ? "Off" : "On" },
            { label: "Pro", value: userSettings.isMeshPro ? "Active" : "Free" },
          ],
          emptyTitle: "Settings are ready",
          emptyBody: "Manage your profile, security, privacy, Meshi, Mesh Pro, and data controls.",
          isMeshPro: Boolean(userSettings.isMeshPro),
        },
      };
    }

    return { state: "ready", summary: fallback };
  } catch {
    return {
      state: "error",
      summary: fallback,
      message: "Live workspace could not load. The safe preview is still available.",
    };
  }
}

function formatResult(value: unknown) {
  const result = asRecord(value);
  const rawResults = asRecord(result.results ?? result.crossPostResults);
  const entries = Object.entries(rawResults);
  if (entries.length === 0) return null;

  const successCount = entries.filter(([, item]) => asRecord(item).success === true).length;
  const failed = entries
    .filter(([, item]) => asRecord(item).success !== true)
    .map(([key, item]) => `${key}: ${asString(asRecord(item).error, "not supported")}`);

  if (failed.length === 0) return `Synced to ${successCount} platform${successCount === 1 ? "" : "s"}.`;
  return `${successCount} synced. ${failed.join("; ")}`;
}

function RowList({ rows, emptyTitle, emptyBody }: { rows: WorkspaceRow[]; emptyTitle: string; emptyBody: string }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)]/64 p-5">
        <p className="font-bold text-[var(--text-primary)]">{emptyTitle}</p>
        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{emptyBody}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      {rows.map((row, index) => {
        const content = (
          <div
            className="mesh-link-row mesh-pop-in grid gap-2 rounded-md px-4 py-3 text-sm md:grid-cols-[1fr_1.35fr_1fr_auto]"
            style={{ animationDelay: `${index * 0.035}s` }}
          >
            <span className="font-bold capitalize text-[var(--text-primary)]">{row.label}</span>
            <span className="text-[var(--text-secondary)]">{row.value}</span>
            <span className="text-[var(--text-muted)]">{row.meta}</span>
            {row.href && (
              <span className="inline-flex items-center justify-end text-[var(--accent)]" aria-label="Open">
                <ArrowRight size={14} aria-hidden="true" />
              </span>
            )}
          </div>
        );

        return row.href ? (
          <Link key={row.id} href={row.href} target={row.href.startsWith("http") ? "_blank" : undefined} rel={row.href.startsWith("http") ? "noreferrer" : undefined}>
            {content}
          </Link>
        ) : (
          <div key={row.id}>{content}</div>
        );
      })}
    </div>
  );
}

function AuthPanel() {
  return (
    <div className="mb-4 rounded-md border border-emerald-300/25 bg-emerald-300/10 p-4 text-sm text-emerald-100">
      <div className="flex items-start gap-3">
        <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-bold">Account required.</p>
          <p className="mt-1 leading-6">Log in to use private Mesh.me features.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/login" className="mesh-action mesh-action-secondary mesh-pressable px-3 text-sm">Log in</Link>
            <Link href="/signup" className="mesh-action mesh-action-primary mesh-pressable px-3 text-sm">
              Create account
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function AccountManager({
  accounts,
  busy,
  onSync,
  onDisconnect,
}: {
  accounts: AccountSummary[];
  busy: boolean;
  onSync: (accountId: string) => void;
  onDisconnect: (accountId: string) => void;
}) {
  if (accounts.length === 0) return null;

  return (
    <div className="mt-3 grid gap-2">
      {accounts.map((account) => (
        <div key={account.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)]/60 px-3 py-2 text-sm">
          <div>
            <p className="font-bold capitalize">{account.platform}</p>
            <p className="text-xs text-[var(--text-muted)]">{account.username} - {account.status}</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => onSync(account.id)}
              className="mesh-action mesh-action-secondary mesh-pressable px-3 text-xs"
            >
              Sync
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onDisconnect(account.id)}
              className="mesh-action mesh-pressable border-red-400/25 bg-red-500/10 px-3 text-xs text-red-200"
            >
              Remove
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function LivePlatformWorkspace({ section, fallbackRows }: { section: PlatformSection; fallbackRows: string[][] }) {
  const searchParams = useSearchParams();
  const urlSearchQuery = section === "search" ? searchParams.get("q") ?? "" : "";
  const initialSummary = useMemo(() => fallbackSummary(fallbackRows), [fallbackRows]);
  const [summary, setSummary] = useState<LiveSummary>(initialSummary);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [actionState, setActionState] = useState<ActionState>(null);
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState("");
  const [tags, setTags] = useState("");
  const [manualPlatform, setManualPlatform] = useState(MANUAL_PLATFORMS[0]);
  const [manualUsername, setManualUsername] = useState("");
  const [manualLabel, setManualLabel] = useState("");
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState(() => urlSearchQuery);
  const [feedbackType, setFeedbackType] = useState("general");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [communityName, setCommunityName] = useState("");
  const [communityDescription, setCommunityDescription] = useState("");
  const [mechatTitle, setMechatTitle] = useState("Shared browsing room");
  const [mechatUrl, setMechatUrl] = useState("");
  const [mechatRecipientQuery, setMechatRecipientQuery] = useState("");
  const [mechatRecipients, setMechatRecipients] = useState<UserSearchResult[]>([]);

  const applySearchRows = useCallback((query: string, data: Record<string, unknown>) => {
    const rows = buildRowsFromSearch(data);
    setSummary((current) => ({
      ...current,
      rows,
      stats: [
        { label: "Results", value: String(rows.length) },
        { label: "Query", value: query },
        { label: "Scope", value: "Unified" },
      ],
    }));
    setLoadState("ready");
  }, []);

  const refresh = useCallback(async () => {
    setLoadState("loading");
    const result = await loadLiveSummary(section, fallbackRows);
    setSummary(result.summary);
    setLoadState(result.state);
    if (result.message) setActionState({ type: "error", message: result.message });
  }, [fallbackRows, section]);

  useEffect(() => {
    let cancelled = false;
    void loadLiveSummary(section, fallbackRows).then((result) => {
      if (cancelled) return;
      setSummary(result.summary);
      setLoadState(result.state);
      if (result.message) setActionState({ type: "error", message: result.message });
    });
    return () => {
      cancelled = true;
    };
  }, [fallbackRows, section]);

  useEffect(() => {
    const incomingQuery = urlSearchQuery.trim();
    if (section !== "search" || incomingQuery.length < 2) return;

    let cancelled = false;
    startTransition(async () => {
      const result = await requestJson(`/api/search?q=${encodeURIComponent(incomingQuery)}`);
      if (cancelled) return;
      if (!result.ok) {
        setActionState({ type: "error", message: asString(result.data.error, "Search failed") });
        return;
      }
      applySearchRows(incomingQuery, result.data);
    });

    return () => {
      cancelled = true;
    };
  }, [applySearchRows, section, startTransition, urlSearchQuery]);

  const busy = isPending || loadState === "loading";

  function runAction(action: () => Promise<void>) {
    startTransition(async () => {
      setActionState(null);
      await action();
    });
  }

  function submitPost() {
    runAction(async () => {
      const formData = new FormData();
      formData.set("content", draft);
      if (tags.trim()) formData.set("tags", tags);
      if (selectedAccountIds.length > 0) formData.set("crossPostAccountIds", JSON.stringify(selectedAccountIds));
      const result = await createPost(formData);
      const record = asRecord(result);
      if (record.error) {
        setActionState({ type: "error", message: asString(record.error, "Post failed") });
        return;
      }
      const syncMessage = formatResult(record);
      setDraft("");
      setTags("");
      setSelectedAccountIds([]);
      setActionState({ type: "success", message: syncMessage ? `Post created. ${syncMessage}` : "Post created." });
      await refresh();
    });
  }

  function connectManualAccount() {
    runAction(async () => {
      const result = await requestJson("/api/connected-accounts", {
        method: "POST",
        body: JSON.stringify({
          platform: manualPlatform,
          username: manualUsername,
          accountLabel: manualLabel,
        }),
      });
      if (!result.ok) {
        setActionState({ type: "error", message: asString(result.data.error, "Could not connect account") });
        return;
      }
      setManualUsername("");
      setManualLabel("");
      setActionState({ type: "success", message: "Manual account connected with revocable access." });
      await refresh();
    });
  }

  function syncAccount(accountId: string) {
    runAction(async () => {
      const result = await requestJson(`/api/connected-accounts/${accountId}/sync`, {
        method: "POST",
        body: JSON.stringify({ syncType: "full" }),
      });
      if (!result.ok) {
        setActionState({ type: "error", message: asString(result.data.error, "Sync failed") });
        return;
      }
      setActionState({ type: "success", message: "Sync finished or was safely queued." });
      await refresh();
    });
  }

  function disconnectAccount(accountId: string) {
    if (!window.confirm("Remove this connected account from Mesh.me? Imported data tied to it may be removed by cascade rules.")) return;
    runAction(async () => {
      const result = await requestJson(`/api/connected-accounts/${accountId}`, { method: "DELETE" });
      if (!result.ok) {
        setActionState({ type: "error", message: asString(result.data.error, "Could not remove account") });
        return;
      }
      setActionState({ type: "success", message: "Connected account removed." });
      await refresh();
    });
  }

  function crossPost() {
    runAction(async () => {
      const result = await requestJson("/api/platform-content", {
        method: "POST",
        body: JSON.stringify({
          action: "cross-post",
          content: draft,
          accountIds: selectedAccountIds,
        }),
      });
      if (!result.ok) {
        setActionState({ type: "error", message: asString(result.data.error, "Cross-post failed") });
        return;
      }
      setDraft("");
      setSelectedAccountIds([]);
      setActionState({ type: "info", message: formatResult(result.data) ?? "Cross-post action completed." });
      await refresh();
    });
  }

  function exportData() {
    runAction(async () => {
      const result = await requestJson("/api/data-controls?action=export");
      if (!result.ok) {
        setActionState({ type: "error", message: asString(result.data.error, "Export failed") });
        return;
      }
      const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "meshme-data-export.json";
      link.click();
      URL.revokeObjectURL(url);
      setActionState({ type: "success", message: "Private data export prepared." });
    });
  }

  function deleteSyncedData() {
    if (!window.confirm("Delete imported platform posts, comments, followers, media, analytics, and sync history?")) return;
    runAction(async () => {
      const result = await requestJson("/api/data-controls", {
        method: "POST",
        body: JSON.stringify({ action: "delete-synced-data" }),
      });
      if (!result.ok) {
        setActionState({ type: "error", message: asString(result.data.error, "Delete failed") });
        return;
      }
      setActionState({ type: "success", message: `Deleted ${formatNumber(asRecord(result.data.deleted).total)} synced records.` });
      await refresh();
    });
  }

  function markRead() {
    runAction(async () => {
      const result = await markNotificationsRead();
      const record = asRecord(result);
      if (record.error) {
        setActionState({ type: "error", message: asString(record.error, "Could not mark notifications read") });
        return;
      }
      setActionState({ type: "success", message: "Notifications marked read." });
      await refresh();
    });
  }

  function runSearch() {
    runAction(async () => {
      if (searchQuery.trim().length < 2) {
        setActionState({ type: "error", message: "Search needs at least 2 characters." });
        return;
      }
      const result = await requestJson(`/api/search?q=${encodeURIComponent(searchQuery.trim())}`);
      applySearchRows(searchQuery.trim(), result.data);
    });
  }

  function submitCommunity() {
    runAction(async () => {
      const formData = new FormData();
      formData.set("name", communityName);
      formData.set("description", communityDescription);
      const result = await createCommunity(formData);
      const record = asRecord(result);
      if (record.error) {
        setActionState({ type: "error", message: asString(record.error, "Community creation failed") });
        return;
      }
      setCommunityName("");
      setCommunityDescription("");
      setActionState({ type: "success", message: "Community created. You are the admin." });
      await refresh();
    });
  }

  function submitFeedback() {
    runAction(async () => {
      const result = await requestJson("/api/feedback", {
        method: "POST",
        body: JSON.stringify({
          type: feedbackType,
          message: feedbackMessage,
          page: section,
        }),
      });
      if (!result.ok) {
        setActionState({ type: "error", message: asString(result.data.error, "Feedback failed") });
        return;
      }
      setFeedbackMessage("");
      setActionState({ type: "success", message: "Feedback sent to the product queue." });
    });
  }

  function createMeChatSession() {
    runAction(async () => {
      const result = await requestJson("/api/mechat/sessions", {
        method: "POST",
        body: JSON.stringify({
          title: mechatTitle,
          items: mechatUrl.trim()
            ? [{ sourcePlatform: "mesh", sourceUrl: mechatUrl.trim(), title: "Shared link" }]
            : [],
        }),
      });
      if (!result.ok) {
        setActionState({ type: "error", message: asString(result.data.error, "Could not create session") });
        return;
      }
      setMechatUrl("");
      setActionState({ type: "success", message: "Group scrolling session created." });
      await refresh();
    });
  }

  function searchMeChatRecipients() {
    runAction(async () => {
      const query = mechatRecipientQuery.trim();
      if (query.length < 2) {
        setMechatRecipients([]);
        setActionState({ type: "error", message: "Type at least 2 characters to find a Mesh.me user." });
        return;
      }

      const result = await requestJson(`/api/search/users?q=${encodeURIComponent(query)}`);
      if (result.status === 401) {
        setLoadState("auth");
        return;
      }
      if (!result.ok) {
        setMechatRecipients([]);
        setActionState({ type: "error", message: asString(result.data.error, "Could not search users") });
        return;
      }

      const users = asArray(result.data.users).map((item) => {
        const user = asRecord(item);
        return {
          id: asString(user.id),
          username: asString(user.username),
          displayName: asString(user.displayName, "Mesh.me user"),
          avatarUrl: asString(user.avatarUrl) || null,
        };
      }).filter((item) => item.id);

      setMechatRecipients(users);
      setActionState({
        type: "info",
        message: users.length ? `Found ${users.length} user${users.length === 1 ? "" : "s"}.` : "No matching users found.",
      });
    });
  }

  function startCheckout(plan: "monthly" | "yearly") {
    runAction(async () => {
      const result = await requestJson("/api/stripe/checkout", {
        method: "POST",
        body: JSON.stringify({ plan }),
      });
      if (!result.ok) {
        if (result.data.alreadyActive) {
          setActionState({ type: "info", message: "Mesh Pro is already active. Open billing management to make changes." });
          return;
        }
        setActionState({ type: "error", message: asString(result.data.error, "Checkout is not available") });
        return;
      }
      const url = asString(result.data.url);
      if (url) window.location.href = url;
    });
  }

  function openBillingPortal() {
    runAction(async () => {
      const result = await requestJson("/api/stripe/portal", {
        method: "POST",
      });
      if (!result.ok) {
        setActionState({ type: "error", message: asString(result.data.error, "Billing management is not available") });
        return;
      }
      const url = asString(result.data.url);
      if (url) window.location.href = url;
    });
  }

  function toggleSelectedAccount(accountId: string) {
    setSelectedAccountIds((current) => current.includes(accountId) ? current.filter((id) => id !== accountId) : [...current, accountId]);
  }

  const showComposer = section === "feed" || section === "content" || section === "create";
  const showDataControls = section === "analytics" || section === "settings";
  const canCrossPost = (section === "content" || section === "create") && summary.accounts.length > 0;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {summary.stats.map((stat) => (
            <div key={`${stat.label}-${stat.value}`} className="rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)]/64 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">{stat.label}</p>
              <p className="mt-1 text-sm font-bold text-[var(--text-primary)]">{stat.value}</p>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => void refresh()} disabled={busy} className="mesh-action mesh-action-secondary mesh-pressable px-3 text-sm">
          {busy ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <RefreshCw size={15} aria-hidden="true" />}
          Refresh
        </button>
      </div>

      {loadState === "auth" && <AuthPanel />}

      {actionState && (
        <div className={`rounded-md border px-4 py-3 text-sm ${
          actionState.type === "error"
            ? "border-red-400/25 bg-red-500/10 text-red-100"
            : actionState.type === "success"
              ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100"
              : "border-[var(--border-primary)] bg-[var(--bg-primary)]/64 text-[var(--text-secondary)]"
        }`}>
          <div className="flex items-center gap-2">
            {actionState.type === "error" ? <ShieldCheck size={15} aria-hidden="true" /> : <CheckCircle2 size={15} aria-hidden="true" />}
            {actionState.message}
          </div>
        </div>
      )}

      {showComposer && loadState !== "auth" && (
        <div className="rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)]/64 p-4">
          <label className="grid gap-2 text-sm font-bold">
            {section === "feed" ? "Post to Mesh.me" : "Create or cross-post content"}
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={3}
              maxLength={500}
              className="simple-input w-full resize-none px-3 py-3 text-sm"
              placeholder="Write something clear, useful, or fun..."
            />
          </label>
          {section === "feed" && (
            <input
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              className="simple-input mt-2 h-10 w-full px-3 text-sm"
              placeholder="Optional tags, comma separated"
            />
          )}
          {canCrossPost && (
            <div className="mt-3 flex flex-wrap gap-2">
              {summary.accounts.filter((account) => account.isActive).map((account) => (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => toggleSelectedAccount(account.id)}
                  className={`mesh-pressable rounded-full border px-3 py-1.5 text-xs font-bold ${
                    selectedAccountIds.includes(account.id)
                      ? "border-emerald-300/35 bg-emerald-300/15 text-emerald-100"
                      : "border-[var(--border-primary)] text-[var(--text-secondary)]"
                  }`}
                >
                  {account.platform}
                </button>
              ))}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={submitPost} disabled={busy || !draft.trim()} className="mesh-action mesh-action-primary mesh-pressable px-4 text-sm">
              <Plus size={15} aria-hidden="true" />
              Post
            </button>
            {canCrossPost && (
              <button type="button" onClick={crossPost} disabled={busy || !draft.trim() || selectedAccountIds.length === 0} className="mesh-action mesh-action-secondary mesh-pressable px-4 text-sm">
                <Sparkles size={15} aria-hidden="true" />
                Cross-post
              </button>
            )}
          </div>
        </div>
      )}

      {section === "connections" && loadState !== "auth" && (
        <div className="rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)]/64 p-4">
          <div className="grid gap-2 md:grid-cols-[11rem_1fr_1fr_auto]">
            <select value={manualPlatform} onChange={(event) => setManualPlatform(event.target.value)} className="simple-input h-11 px-3 text-sm">
              {MANUAL_PLATFORMS.map((platform) => <option key={platform} value={platform}>{platform}</option>)}
            </select>
            <input value={manualUsername} onChange={(event) => setManualUsername(event.target.value)} className="simple-input h-11 px-3 text-sm" placeholder="username" />
            <input value={manualLabel} onChange={(event) => setManualLabel(event.target.value)} className="simple-input h-11 px-3 text-sm" placeholder="optional label" />
            <button type="button" onClick={connectManualAccount} disabled={busy || !manualUsername.trim()} className="mesh-action mesh-action-primary mesh-pressable px-4 text-sm">Connect</button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--text-muted)]">
            {OAUTH_PLATFORMS.map((platform) => (
              <Link key={platform} href={`/api/auth/${platform}`} prefetch={false} className="rounded-full border border-[var(--border-primary)] px-3 py-1.5 capitalize hover:text-[var(--text-primary)]">
                {platform}
              </Link>
            ))}
          </div>
          <AccountManager accounts={summary.accounts} busy={busy} onSync={syncAccount} onDisconnect={disconnectAccount} />
        </div>
      )}

      {showDataControls && loadState !== "auth" && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={exportData} disabled={busy} className="mesh-action mesh-action-secondary mesh-pressable px-4 text-sm">
            <Download size={15} aria-hidden="true" />
            Export data
          </button>
          <button type="button" onClick={deleteSyncedData} disabled={busy} className="mesh-action mesh-pressable border-red-400/25 bg-red-500/10 px-4 text-sm text-red-200">
            <Trash2 size={15} aria-hidden="true" />
            Delete synced data
          </button>
        </div>
      )}

      {section === "notifications" && loadState !== "auth" && (
        <button type="button" onClick={markRead} disabled={busy} className="mesh-action mesh-action-secondary mesh-pressable w-fit px-4 text-sm">
          Mark all read
        </button>
      )}

      {section === "search" && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
            <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="simple-input h-12 w-full pl-10 pr-3 text-sm" placeholder="Search posts, people, communities..." />
          </div>
          <button type="button" onClick={runSearch} disabled={busy} className="mesh-action mesh-action-primary mesh-pressable px-5 text-sm">Search</button>
        </div>
      )}

      {(section === "communities" || section === "create") && loadState !== "auth" && (
        <div className="grid gap-2 rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)]/64 p-4 md:grid-cols-[1fr_1.4fr_auto]">
          <input value={communityName} onChange={(event) => setCommunityName(event.target.value)} className="simple-input h-11 px-3 text-sm" placeholder="Community name" />
          <input value={communityDescription} onChange={(event) => setCommunityDescription(event.target.value)} className="simple-input h-11 px-3 text-sm" placeholder="What is it for?" />
          <button type="button" onClick={submitCommunity} disabled={busy || !communityName.trim()} className="mesh-action mesh-action-primary mesh-pressable px-4 text-sm">Create</button>
        </div>
      )}

      {section === "mechat" && loadState !== "auth" && (
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="grid gap-3 rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)]/64 p-4">
            <div>
              <p className="text-sm font-bold text-[var(--text-primary)]">Start a direct MeChat</p>
              <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">Find an account, open a secure thread, and send the first message.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={mechatRecipientQuery}
                onChange={(event) => setMechatRecipientQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    searchMeChatRecipients();
                  }
                }}
                className="simple-input h-11 flex-1 px-3 text-sm"
                placeholder="Search people"
              />
              <button type="button" onClick={searchMeChatRecipients} disabled={busy} className="mesh-action mesh-action-secondary mesh-pressable px-4 text-sm">
                <Search size={15} aria-hidden="true" />
                Find
              </button>
            </div>
            {mechatRecipients.length > 0 && (
              <div className="grid gap-2">
                {mechatRecipients.map((recipient) => (
                  <Link
                    key={recipient.id}
                    href={`/messages/${recipient.id}?new=true`}
                    className="mesh-pressable flex items-center justify-between gap-3 rounded-md border border-[var(--border-primary)] bg-[var(--bg-secondary)]/50 px-3 py-2 text-sm"
                  >
                    <span>
                      <span className="block font-bold text-[var(--text-primary)]">{recipient.displayName}</span>
                      <span className="text-xs text-[var(--text-muted)]">@{recipient.username}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-[var(--accent)]">
                      Open
                      <ArrowRight size={14} aria-hidden="true" />
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-3 rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)]/64 p-4">
            <div>
              <p className="text-sm font-bold text-[var(--text-primary)]">Create a shared scrolling room</p>
              <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">Start a group browsing session with a title and an optional source link.</p>
            </div>
            <input value={mechatTitle} onChange={(event) => setMechatTitle(event.target.value)} className="simple-input h-11 px-3 text-sm" placeholder="Session title" />
            <input value={mechatUrl} onChange={(event) => setMechatUrl(event.target.value)} className="simple-input h-11 px-3 text-sm" placeholder="Optional shared URL" />
            <button type="button" onClick={createMeChatSession} disabled={busy || !mechatTitle.trim()} className="mesh-action mesh-action-primary mesh-pressable px-4 text-sm">Create room</button>
          </div>
        </div>
      )}

      {section === "feedback" && loadState !== "auth" && (
        <div className="grid gap-2 rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)]/64 p-4">
          <select value={feedbackType} onChange={(event) => setFeedbackType(event.target.value)} className="simple-input h-11 px-3 text-sm">
            <option value="general">General</option>
            <option value="bug">Bug</option>
            <option value="request">Feature request</option>
            <option value="trust">Privacy or security</option>
          </select>
          <textarea value={feedbackMessage} onChange={(event) => setFeedbackMessage(event.target.value)} rows={3} className="simple-input resize-none px-3 py-3 text-sm" placeholder="Tell the team what needs to improve..." />
          <button type="button" onClick={submitFeedback} disabled={busy || !feedbackMessage.trim()} className="mesh-action mesh-action-primary mesh-pressable w-fit px-4 text-sm">Send feedback</button>
        </div>
      )}

      {section === "pro" && loadState !== "auth" && (
        <div className="grid gap-3 rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)]/64 p-4">
          <div>
            <p className="text-sm font-bold text-[var(--text-primary)]">
              {summary.isMeshPro ? "Mesh Pro is active" : "Start Mesh Pro"}
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
              {summary.isMeshPro
                ? "Manage payment methods, invoices, and subscription changes through Stripe."
                : "Checkout opens on Stripe so Mesh.me never handles card details."}
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {summary.isMeshPro ? (
              <>
                <button type="button" onClick={openBillingPortal} disabled={busy} className="mesh-action mesh-action-primary mesh-pressable justify-center px-4 text-sm">Manage billing</button>
                <Link href="/settings" className="mesh-action mesh-action-secondary mesh-pressable justify-center px-4 text-sm">Pro settings</Link>
              </>
            ) : (
              <>
                <button type="button" onClick={() => startCheckout("monthly")} disabled={busy} className="mesh-action mesh-action-primary mesh-pressable justify-center px-4 text-sm">Monthly - $4.99</button>
                <button type="button" onClick={() => startCheckout("yearly")} disabled={busy} className="mesh-action mesh-action-secondary mesh-pressable justify-center px-4 text-sm">Yearly - $44.99</button>
              </>
            )}
          </div>
        </div>
      )}

      {loadState === "loading" ? (
        <div className="grid gap-2">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-14 animate-pulse rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)]/50" />
          ))}
        </div>
      ) : (
        <RowList rows={summary.rows} emptyTitle={summary.emptyTitle} emptyBody={summary.emptyBody} />
      )}
    </div>
  );
}
