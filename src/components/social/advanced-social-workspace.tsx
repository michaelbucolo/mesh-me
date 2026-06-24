"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useMemo, useState, useTransition } from "react";
import {
  Archive,
  ArrowRight,
  Bookmark,
  Check,
  Eye,
  Globe2,
  Layers3,
  Link2,
  Loader2,
  LockKeyhole,
  MessageCircle,
  Mic,
  Play,
  Plus,
  Radio,
  Search,
  ShieldCheck,
  SkipForward,
  Trash2,
  Users,
  Video,
} from "lucide-react";
import { createCommunity } from "@/lib/actions";
import { MeshiMascot } from "@/components/meshi/meshi-mascot";
import { Avatar } from "@/components/ui/avatar";
import { formatRelativeTime } from "@/lib/utils";

type Person = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

type SpaceSummary = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  isPublic: boolean;
  role: string;
  joinedAt: string;
  memberCount: number;
  postCount: number;
};

type SessionParticipant = {
  id: string;
  userId: string;
  role: string;
  user: Person;
};

type SessionVote = {
  id: string;
  userId: string;
  vote: string;
};

type SessionItem = {
  id: string;
  sourcePlatform: string;
  sourceUrl: string | null;
  title: string | null;
  content: string | null;
  postId: string | null;
  platformPostId: string | null;
  status: string;
  votes: SessionVote[];
};

type SocialSession = {
  id: string;
  hostId: string;
  title: string;
  status: string;
  sessionType: string;
  callMode: string;
  callStatus: string;
  currentItemId: string | null;
  callStartedAt: string | null;
  callEndedAt: string | null;
  updatedAt: string;
  participants: SessionParticipant[];
  items: SessionItem[];
};

type NativePost = {
  id: string;
  content: string;
  createdAt: string;
  visibility: string;
  author: Person & { isVerified?: boolean };
  community: { id: string; name: string; slug: string } | null;
  media: Array<{ id: string; url: string; type: string }>;
  tags: Array<{ id: string; tag: string }>;
  counts: { comments: number; reactions: number; reposts: number };
  savedPostId?: string;
  savedAt?: string;
};

type PlatformPost = {
  id: string;
  platformPostId: string;
  title: string | null;
  content: string | null;
  url: string | null;
  postType: string;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  likeCount: number;
  commentCount: number;
  viewCount: number;
  connectedAccount: {
    id: string;
    platform: string;
    platformUsername: string | null;
  };
  media: Array<{ id: string; url: string | null; thumbnailUrl: string | null; mediaType: string }>;
};

type ConnectedAccount = {
  id: string;
  platform: string;
  platformUsername: string | null;
  syncStatus: string;
  lastSyncAt: string | null;
  counts: {
    posts: number;
    comments: number;
    followers: number;
  };
};

type CommunityThread = {
  id: string;
  title: string | null;
  memberCount: number;
  lastMessage: { content: string; createdAt: string } | null;
  updatedAt: string;
};

export type AdvancedSocialData = {
  currentUser: Person & { isMeshPro: boolean };
  spaces: SpaceSummary[];
  sessions: SocialSession[];
  savedPosts: NativePost[];
  recentPosts: NativePost[];
  platformPosts: PlatformPost[];
  connectedAccounts: ConnectedAccount[];
  friends: Person[];
  communityThreads: CommunityThread[];
};

type AdvancedSocialWorkspaceProps = {
  mode: "spaces" | "vault";
  data: AdvancedSocialData;
};

type ApiResult = Record<string, unknown>;

const SESSION_OPTIONS = [
  {
    type: "co_browse",
    label: "Shared scroll",
    body: "Everyone sees the same queue and reacts as themselves.",
    icon: Radio,
    callMode: "none",
  },
  {
    type: "watch",
    label: "Watch session",
    body: "Queue videos, links, and posts for a group watch flow.",
    icon: Play,
    callMode: "none",
  },
  {
    type: "voice_room",
    label: "Voice room",
    body: "Start the call layer for a MeChat room.",
    icon: Mic,
    callMode: "voice",
  },
  {
    type: "video_room",
    label: "Video room",
    body: "Start the video-call foundation for a group session.",
    icon: Video,
    callMode: "video",
  },
] as const;

function platformLabel(platform: string) {
  if (platform.toLowerCase() === "twitter") return "X";
  if (platform.toLowerCase() === "meshme") return "Mesh.me";
  return platform.charAt(0).toUpperCase() + platform.slice(1);
}

function sessionLabel(type: string) {
  if (type === "co_browse") return "Shared scroll";
  if (type === "watch") return "Watch";
  if (type === "voice_room") return "Voice";
  if (type === "video_room") return "Video";
  if (type === "collaborative_space") return "Space";
  return type.replace(/_/g, " ");
}

function trimContent(content: string, length = 132) {
  const clean = content.replace(/\s+/g, " ").trim();
  return clean.length > length ? `${clean.slice(0, length - 3)}...` : clean;
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
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data?.error === "string" ? data.error : "Request failed");
  }
  return data;
}

function postTitle(post: NativePost) {
  return trimContent(post.content.split("\n").find(Boolean) || "Mesh.me post", 76);
}

function platformPostTitle(post: PlatformPost) {
  return post.title || trimContent(post.content || post.url || "Source-linked post", 76);
}

function sessionStatusClass(status: string) {
  if (status === "live") return "border-emerald-300/30 bg-emerald-300/10 text-emerald-100";
  if (status === "ended") return "border-zinc-400/30 bg-zinc-400/10 text-zinc-200";
  return "border-sky-300/30 bg-sky-300/10 text-sky-100";
}

function vaultTag(post: NativePost) {
  return post.tags.some((tag) => tag.tag === "vault") ? "Private Vault memory" : "Saved Mesh.me post";
}

export function AdvancedSocialWorkspace({ mode, data }: AdvancedSocialWorkspaceProps) {
  const router = useRouter();
  const [sessions, setSessions] = useState(data.sessions);
  const [activeSessionId, setActiveSessionId] = useState(data.sessions[0]?.id ?? "");
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [spaceName, setSpaceName] = useState("");
  const [spaceDescription, setSpaceDescription] = useState("");
  const [spaceType, setSpaceType] = useState("friends");
  const [spacePublic, setSpacePublic] = useState(false);
  const [sessionTitle, setSessionTitle] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const [manualNote, setManualNote] = useState("");
  const [itemTitle, setItemTitle] = useState("");
  const [itemUrl, setItemUrl] = useState("");
  const [friendQuery, setFriendQuery] = useState("");
  const [status, setStatus] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? sessions[0] ?? null,
    [activeSessionId, sessions],
  );

  const liveSessions = sessions.filter((session) => session.status === "live");
  const watchSessions = sessions.filter((session) => session.sessionType === "watch");
  const filteredFriends = useMemo(() => {
    const query = friendQuery.trim().toLowerCase();
    if (!query) return data.friends;
    return data.friends.filter((friend) => (
      friend.displayName.toLowerCase().includes(query) ||
      friend.username.toLowerCase().includes(query)
    ));
  }, [data.friends, friendQuery]);

  function upsertSession(session: SocialSession) {
    setSessions((current) => {
      const exists = current.some((item) => item.id === session.id);
      return exists
        ? current.map((item) => (item.id === session.id ? session : item))
        : [session, ...current];
    });
    setActiveSessionId(session.id);
  }

  function refreshFromServer(message?: string) {
    if (message) setStatus({ type: "success", message });
    router.refresh();
  }

  function toggleFriend(friendId: string) {
    setSelectedFriendIds((current) => (
      current.includes(friendId)
        ? current.filter((id) => id !== friendId)
        : [...current, friendId].slice(0, 24)
    ));
  }

  function run(action: () => Promise<void>) {
    startTransition(async () => {
      setStatus(null);
      try {
        await action();
      } catch (error) {
        setStatus({ type: "error", message: error instanceof Error ? error.message : "Something went wrong." });
      }
    });
  }

  function createSpace() {
    if (!spaceName.trim()) {
      setStatus({ type: "error", message: "Name the space first." });
      return;
    }

    run(async () => {
      const formData = new FormData();
      formData.set("name", spaceName.trim());
      formData.set("description", spaceDescription.trim());
      formData.set("spaceType", spaceType);
      formData.set("category", spaceType);
      formData.set("isPublic", spacePublic ? "true" : "false");
      formData.set("rules", "Respect people.\nCredit original creators.\nKeep private space content inside the space.");
      const result = await createCommunity(formData);
      if ("error" in result && result.error) throw new Error(String(result.error));
      setSpaceName("");
      setSpaceDescription("");
      setSpaceType("friends");
      setSpacePublic(false);
      refreshFromServer("Collaborative space created.");
    });
  }

  function createSession(type: string, callMode: string) {
    run(async () => {
      const option = SESSION_OPTIONS.find((item) => item.type === type);
      const dataResult = await requestJson("/api/mechat/sessions", {
        method: "POST",
        body: JSON.stringify({
          title: sessionTitle.trim() || option?.label || "Shared room",
          sessionType: type,
          callMode,
          participantIds: selectedFriendIds,
        }),
      });
      upsertSession(dataResult.session as SocialSession);
      setSessionTitle("");
      setSelectedFriendIds([]);
      setStatus({ type: "success", message: `${option?.label || "Room"} created.` });
    });
  }

  function patchSession(sessionId: string, body: Record<string, unknown>, successMessage?: string) {
    run(async () => {
      const result = await requestJson(`/api/mechat/sessions/${sessionId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      if (result.session) upsertSession(result.session as SocialSession);
      if (successMessage) setStatus({ type: "success", message: successMessage });
    });
  }

  function addManualItem(sessionId: string) {
    if (!itemTitle.trim() && !itemUrl.trim()) return;
    patchSession(sessionId, {
      action: "add-item",
      sourcePlatform: itemUrl.trim() ? "web" : "mesh",
      title: itemTitle.trim() || "Shared item",
      sourceUrl: itemUrl.trim() || undefined,
    }, "Item added to the shared queue.");
    setItemTitle("");
    setItemUrl("");
  }

  function addNativePostToSession(sessionId: string, post: NativePost) {
    patchSession(sessionId, {
      action: "add-item",
      sourcePlatform: "mesh",
      title: postTitle(post),
      content: trimContent(post.content, 500),
      postId: post.id,
    }, "Post added to the shared queue.");
  }

  function addPlatformPostToSession(sessionId: string, post: PlatformPost) {
    patchSession(sessionId, {
      action: "add-item",
      sourcePlatform: post.connectedAccount.platform,
      sourceUrl: post.url || undefined,
      title: platformPostTitle(post),
      content: trimContent(post.content || "", 500),
      platformPostId: post.id,
    }, "Source post added to the shared queue.");
  }

  function saveNativePost(post: NativePost) {
    run(async () => {
      await requestJson("/api/vault", {
        method: "POST",
        body: JSON.stringify({ postId: post.id }),
      });
      refreshFromServer("Saved to Mesh Vault.");
    });
  }

  function savePlatformPost(post: PlatformPost) {
    run(async () => {
      await requestJson("/api/vault", {
        method: "POST",
        body: JSON.stringify({
          platformPostId: post.id,
          title: platformPostTitle(post),
          note: post.content || "",
          sourceUrl: post.url,
          sourcePlatform: post.connectedAccount.platform,
        }),
      });
      refreshFromServer("Source item saved to Mesh Vault.");
    });
  }

  function saveManualMemory() {
    if (!manualTitle.trim() && !manualUrl.trim() && !manualNote.trim()) {
      setStatus({ type: "error", message: "Add a title, link, or note before saving." });
      return;
    }

    run(async () => {
      await requestJson("/api/vault", {
        method: "POST",
        body: JSON.stringify({
          title: manualTitle,
          sourceUrl: manualUrl,
          note: manualNote,
          sourcePlatform: manualUrl ? "web" : "mesh",
        }),
      });
      setManualTitle("");
      setManualUrl("");
      setManualNote("");
      refreshFromServer("Private memory saved to the Vault.");
    });
  }

  function removeVaultItem(post: NativePost) {
    run(async () => {
      await requestJson("/api/vault", {
        method: "DELETE",
        body: JSON.stringify({
          postId: post.id,
          savedPostId: post.savedPostId,
        }),
      });
      refreshFromServer("Removed from Mesh Vault.");
    });
  }

  const headerCopy = mode === "spaces"
    ? {
        eyebrow: "Advanced social",
        title: "Spaces, shared scrolling, watch sessions, and calls.",
        body: "Create private group worlds, browse together, queue content, and keep every action tied to the real person and source account.",
        icon: Users,
      }
    : {
        eyebrow: "Mesh Vault",
        title: "A private archive for posts, links, messages, and memories.",
        body: "Save native Mesh.me posts or source-linked references from connected platforms into one user-controlled archive.",
        icon: Archive,
      };
  const HeaderIcon = headerCopy.icon;

  return (
    <main className="simple-page grid gap-5">
      <header className="mesh-surface mesh-pop-in overflow-hidden rounded-lg p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="inline-flex items-center gap-3">
            <MeshiMascot size={46} color="blue" mood={mode === "vault" ? "love" : "happy"} prop={mode === "vault" ? "notebook" : "compass"} />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">{headerCopy.eyebrow}</p>
              <p className="text-sm font-bold text-[var(--text-secondary)]">Meshi represents {data.currentUser.displayName}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/spaces" className={`mesh-action px-3 text-sm ${mode === "spaces" ? "mesh-action-primary" : "mesh-action-secondary"}`}>
              <Users size={15} aria-hidden="true" />
              Spaces
            </Link>
            <Link href="/vault" className={`mesh-action px-3 text-sm ${mode === "vault" ? "mesh-action-primary" : "mesh-action-secondary"}`}>
              <Archive size={15} aria-hidden="true" />
              Vault
            </Link>
            <Link href="/messages" className="mesh-action mesh-action-secondary px-3 text-sm">
              <MessageCircle size={15} aria-hidden="true" />
              MeChat
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-primary)] bg-[var(--bg-primary)]/65 px-3 py-1.5 text-xs font-bold text-[var(--text-secondary)]">
              <HeaderIcon size={14} aria-hidden="true" />
              Account-only social layer
            </div>
            <h1 className="mt-3 max-w-3xl text-3xl font-bold leading-tight md:text-5xl">{headerCopy.title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-secondary)] md:text-base">{headerCopy.body}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Spaces", value: data.spaces.length },
              { label: "Live", value: liveSessions.length },
              { label: "Vault", value: data.savedPosts.length },
              { label: "Sources", value: data.connectedAccounts.length },
            ].map((metric) => (
              <div key={metric.label} className="rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)]/64 p-3">
                <strong className="block text-2xl text-[var(--text-primary)]">{metric.value}</strong>
                <span className="text-xs font-semibold text-[var(--text-muted)]">{metric.label}</span>
              </div>
            ))}
          </div>
        </div>
      </header>

      {status && (
        <div className={`rounded-md border px-4 py-3 text-sm ${
          status.type === "error"
            ? "border-red-400/25 bg-red-500/10 text-red-100"
            : status.type === "success"
              ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100"
              : "border-[var(--border-primary)] bg-[var(--bg-primary)]/64 text-[var(--text-secondary)]"
        }`}>
          {status.message}
        </div>
      )}

      {mode === "spaces" ? (
        <section className="grid gap-5 xl:grid-cols-[minmax(20rem,0.75fr)_minmax(0,1.25fr)]">
          <aside className="grid h-fit gap-4">
            <Panel title="Create a collaborative space" icon={<Layers3 size={17} aria-hidden="true" />}>
              <div className="grid gap-2">
                <input value={spaceName} onChange={(event) => setSpaceName(event.target.value)} className="simple-input h-11 px-3 text-sm" placeholder="Space name" />
                <input value={spaceDescription} onChange={(event) => setSpaceDescription(event.target.value)} className="simple-input h-11 px-3 text-sm" placeholder="What is this space for?" />
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <select value={spaceType} onChange={(event) => setSpaceType(event.target.value)} className="simple-input h-11 px-3 text-sm">
                    <option value="friends">Friends</option>
                    <option value="family">Family</option>
                    <option value="creator">Creator</option>
                    <option value="project">Project</option>
                  </select>
                  <button type="button" onClick={() => setSpacePublic((current) => !current)} className={`mesh-action px-3 text-sm ${spacePublic ? "mesh-action-secondary" : "mesh-action-primary"}`}>
                    {spacePublic ? <Globe2 size={15} aria-hidden="true" /> : <LockKeyhole size={15} aria-hidden="true" />}
                    {spacePublic ? "Public" : "Private"}
                  </button>
                </div>
                <button type="button" onClick={createSpace} disabled={isPending || !spaceName.trim()} className="mesh-action mesh-action-primary px-4 text-sm">
                  {isPending ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Plus size={15} aria-hidden="true" />}
                  Create space
                </button>
              </div>
            </Panel>

            <Panel title="Invite friends" icon={<Users size={17} aria-hidden="true" />}>
              <label className="flex items-center gap-2 rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)]/60 px-3 py-2 text-sm">
                <Search size={14} aria-hidden="true" className="text-[var(--text-muted)]" />
                <input value={friendQuery} onChange={(event) => setFriendQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-[var(--text-muted)]" placeholder="Filter mutuals" />
              </label>
              <div className="mt-3 grid max-h-72 gap-2 overflow-y-auto pr-1">
                {filteredFriends.length > 0 ? filteredFriends.map((friend) => {
                  const selected = selectedFriendIds.includes(friend.id);
                  return (
                    <button key={friend.id} type="button" onClick={() => toggleFriend(friend.id)} className={`mesh-link-row flex items-center justify-between gap-3 rounded-md px-3 py-2 text-left ${selected ? "border-emerald-300/30 bg-emerald-300/10" : ""}`}>
                      <span className="flex min-w-0 items-center gap-2">
                        <Avatar src={friend.avatarUrl} alt={friend.displayName} size="sm" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold">{friend.displayName}</span>
                          <span className="block truncate text-xs text-[var(--text-muted)]">@{friend.username}</span>
                        </span>
                      </span>
                      {selected && <Check size={15} aria-hidden="true" className="text-emerald-200" />}
                    </button>
                  );
                }) : (
                  <p className="rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)]/60 p-3 text-sm text-[var(--text-secondary)]">
                    Mutual friends appear here once both people follow each other.
                  </p>
                )}
              </div>
            </Panel>

            <Panel title="Start a room" icon={<Radio size={17} aria-hidden="true" />}>
              <input value={sessionTitle} onChange={(event) => setSessionTitle(event.target.value)} className="simple-input mb-3 h-11 px-3 text-sm" placeholder="Room title" />
              <div className="grid gap-2">
                {SESSION_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button key={option.type} type="button" onClick={() => createSession(option.type, option.callMode)} disabled={isPending} className="mesh-link-row rounded-md px-3 py-3 text-left">
                      <span className="flex items-center gap-2 text-sm font-bold">
                        <Icon size={15} aria-hidden="true" />
                        {option.label}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">{option.body}</span>
                    </button>
                  );
                })}
              </div>
            </Panel>
          </aside>

          <div className="grid gap-5">
            <Panel title="Live rooms and watch sessions" icon={<Play size={18} aria-hidden="true" />}>
              {sessions.length > 0 ? (
                <div className="grid gap-3">
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {sessions.map((session) => (
                      <button key={session.id} type="button" onClick={() => setActiveSessionId(session.id)} className={`mesh-choice shrink-0 rounded-md px-3 py-2 text-left text-sm ${activeSession?.id === session.id ? "border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-primary)]" : "text-[var(--text-secondary)]"}`}>
                        <span className="block font-bold">{session.title}</span>
                        <span className="block text-xs opacity-80">{sessionLabel(session.sessionType)} - {session.status}</span>
                      </button>
                    ))}
                  </div>
                  {activeSession && (
                    <SessionCard
                      session={activeSession}
                      currentUserId={data.currentUser.id}
                      friends={data.friends}
                      selectedFriendIds={selectedFriendIds}
                      isPending={isPending}
                      itemTitle={itemTitle}
                      itemUrl={itemUrl}
                      onItemTitleChange={setItemTitle}
                      onItemUrlChange={setItemUrl}
                      onAddItem={() => addManualItem(activeSession.id)}
                      onPatch={(body, message) => patchSession(activeSession.id, body, message)}
                    />
                  )}
                </div>
              ) : (
                <EmptyState title="Create the first shared room" body="Start with a shared scroll, watch session, or call room. Invited friends will enter as themselves." />
              )}
            </Panel>

            <Panel title="Your collaborative spaces" icon={<Users size={18} aria-hidden="true" />}>
              {data.spaces.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {data.spaces.map((space) => (
                    <article key={space.id} className="rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)]/64 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">{space.category || "space"}</p>
                          <h3 className="mt-1 truncate text-lg font-bold">{space.name}</h3>
                          <p className="mt-1 line-clamp-2 text-sm text-[var(--text-secondary)]">{space.description || "Shared posts, group chat, and collaborative browsing."}</p>
                        </div>
                        <span className="rounded-full border border-[var(--border-primary)] px-2.5 py-1 text-[11px] font-bold text-[var(--text-secondary)]">{space.role}</span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--text-muted)]">
                        <span>{space.memberCount} members</span>
                        <span>{space.postCount} posts</span>
                        <span>{space.isPublic ? "Public" : "Private"}</span>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Link href={`/communities/${space.slug}`} className="mesh-action mesh-action-primary px-3 text-sm">
                          Open
                        </Link>
                        <Link href={`/messages?roomTitle=${encodeURIComponent(space.name)}&callMode=voice`} className="mesh-action mesh-action-secondary px-3 text-sm">
                          <Mic size={14} aria-hidden="true" />
                          Voice
                        </Link>
                        <Link href={`/messages?roomTitle=${encodeURIComponent(space.name)}&callMode=video`} className="mesh-action mesh-action-secondary px-3 text-sm">
                          <Video size={14} aria-hidden="true" />
                          Video
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState title="No spaces yet" body="Create a private friend, family, creator, or project space to combine posts, chat, and sessions." />
              )}
            </Panel>

            <ContentQueue
              activeSession={activeSession}
              recentPosts={data.recentPosts}
              platformPosts={data.platformPosts}
              onAddNativePost={addNativePostToSession}
              onAddPlatformPost={addPlatformPostToSession}
              onSaveNativePost={saveNativePost}
              onSavePlatformPost={savePlatformPost}
              isPending={isPending}
            />

            {data.communityThreads.length > 0 && (
              <Panel title="Community MeChat threads" icon={<MessageCircle size={18} aria-hidden="true" />}>
                <div className="grid gap-2">
                  {data.communityThreads.map((thread) => (
                    <Link key={thread.id} href={`/messages/${thread.id}`} className="mesh-link-row rounded-md px-3 py-3">
                      <span className="flex items-center justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold">{thread.title?.replace("community:", "Community ") || "Community chat"}</span>
                          <span className="block truncate text-xs text-[var(--text-muted)]">
                            {thread.lastMessage?.content || "No messages yet"} - {formatRelativeTime(thread.updatedAt)}
                          </span>
                        </span>
                        <ArrowRight size={15} aria-hidden="true" />
                      </span>
                    </Link>
                  ))}
                </div>
              </Panel>
            )}
          </div>
        </section>
      ) : (
        <section className="grid gap-5 xl:grid-cols-[minmax(20rem,0.75fr)_minmax(0,1.25fr)]">
          <aside className="grid h-fit gap-4">
            <Panel title="Save a private memory" icon={<Bookmark size={17} aria-hidden="true" />}>
              <div className="grid gap-2">
                <input value={manualTitle} onChange={(event) => setManualTitle(event.target.value)} className="simple-input h-11 px-3 text-sm" placeholder="Title" />
                <input value={manualUrl} onChange={(event) => setManualUrl(event.target.value)} className="simple-input h-11 px-3 text-sm" placeholder="Optional source link" />
                <textarea value={manualNote} onChange={(event) => setManualNote(event.target.value)} rows={4} className="simple-input resize-none px-3 py-3 text-sm" placeholder="Why does this matter?" />
                <button type="button" onClick={saveManualMemory} disabled={isPending || (!manualTitle.trim() && !manualUrl.trim() && !manualNote.trim())} className="mesh-action mesh-action-primary px-4 text-sm">
                  {isPending ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Archive size={15} aria-hidden="true" />}
                  Save to Vault
                </button>
              </div>
            </Panel>

            <Panel title="Vault rules" icon={<ShieldCheck size={17} aria-hidden="true" />}>
              <div className="grid gap-2 text-sm text-[var(--text-secondary)]">
                <p className="flex gap-2"><LockKeyhole size={15} className="mt-0.5 shrink-0 text-emerald-300" aria-hidden="true" /> Manual Vault entries are private Mesh.me posts saved only to your account.</p>
                <p className="flex gap-2"><Link2 size={15} className="mt-0.5 shrink-0 text-sky-300" aria-hidden="true" /> Source-linked saves keep the original URL and platform label.</p>
                <p className="flex gap-2"><Trash2 size={15} className="mt-0.5 shrink-0 text-rose-300" aria-hidden="true" /> Removing an owned private Vault memory deletes that private record.</p>
              </div>
            </Panel>

            <Panel title="Connected source candidates" icon={<Globe2 size={17} aria-hidden="true" />}>
              <div className="grid gap-2">
                {data.connectedAccounts.length > 0 ? data.connectedAccounts.map((account) => (
                  <Link key={account.id} href="/connected-accounts" className="mesh-link-row rounded-md px-3 py-3">
                    <span className="flex items-center justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold">{platformLabel(account.platform)}</span>
                        <span className="block truncate text-xs text-[var(--text-muted)]">
                          {account.platformUsername ? `@${account.platformUsername}` : "Connected"} - {account.counts.posts} posts
                        </span>
                      </span>
                      <ArrowRight size={15} aria-hidden="true" />
                    </span>
                  </Link>
                )) : (
                  <Link href="/connected-accounts" className="mesh-action mesh-action-primary justify-center px-4 text-sm">
                    Connect accounts
                  </Link>
                )}
              </div>
            </Panel>
          </aside>

          <div className="grid gap-5">
            <Panel title="Your Mesh Vault" icon={<Archive size={18} aria-hidden="true" />}>
              {data.savedPosts.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {data.savedPosts.map((post) => (
                    <article key={`${post.savedPostId || post.id}`} className="rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)]/64 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">{vaultTag(post)}</p>
                          <h3 className="mt-1 line-clamp-2 text-base font-bold">{postTitle(post)}</h3>
                          <p className="mt-2 line-clamp-4 text-sm leading-6 text-[var(--text-secondary)]">{post.content}</p>
                        </div>
                        {post.media[0] && (
                          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md border border-[var(--border-primary)] bg-[var(--bg-secondary)]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={post.media[0].url} alt="" className="h-full w-full object-cover" />
                          </div>
                        )}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--text-muted)]">
                        <span>{formatRelativeTime(post.savedAt || post.createdAt)}</span>
                        <span>by {post.author.displayName}</span>
                        {post.community && <span>{post.community.name}</span>}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Link href={`/feed/${post.id}`} className="mesh-action mesh-action-secondary px-3 text-sm">
                          <Eye size={14} aria-hidden="true" />
                          Open
                        </Link>
                        <button type="button" onClick={() => activeSession && addNativePostToSession(activeSession.id, post)} disabled={isPending || !activeSession} className="mesh-action mesh-action-secondary px-3 text-sm">
                          <Radio size={14} aria-hidden="true" />
                          Queue
                        </button>
                        <button type="button" onClick={() => removeVaultItem(post)} disabled={isPending} className="mesh-action border-red-400/25 bg-red-500/10 px-3 text-sm text-red-100">
                          <Trash2 size={14} aria-hidden="true" />
                          Remove
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState title="Your Vault is empty" body="Save a post, source link, message, or private note. Mesh Vault starts private by default." />
              )}
            </Panel>

            <ContentQueue
              activeSession={activeSession}
              recentPosts={data.recentPosts}
              platformPosts={data.platformPosts}
              onAddNativePost={addNativePostToSession}
              onAddPlatformPost={addPlatformPostToSession}
              onSaveNativePost={saveNativePost}
              onSavePlatformPost={savePlatformPost}
              isPending={isPending}
            />

            {watchSessions.length > 0 && (
              <Panel title="Watch sessions from your saved world" icon={<Video size={18} aria-hidden="true" />}>
                <div className="grid gap-2">
                  {watchSessions.slice(0, 6).map((session) => (
                    <button key={session.id} type="button" onClick={() => setActiveSessionId(session.id)} className="mesh-link-row rounded-md px-3 py-3 text-left">
                      <span className="block text-sm font-bold">{session.title}</span>
                      <span className="mt-1 block text-xs text-[var(--text-muted)]">
                        {session.items.length} queued item{session.items.length === 1 ? "" : "s"} - {session.status}
                      </span>
                    </button>
                  ))}
                </div>
              </Panel>
            )}
          </div>
        </section>
      )}
    </main>
  );
}

function Panel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="mesh-surface rounded-lg p-4 md:p-5">
      <h2 className="flex items-center gap-2 text-base font-bold md:text-lg">
        {icon}
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)]/60 p-6 text-center">
      <MeshiMascot size={42} color="blue" mood="thinking" prop="notebook" />
      <h3 className="mt-3 text-lg font-bold">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--text-secondary)]">{body}</p>
    </div>
  );
}

function SessionCard({
  session,
  currentUserId,
  friends,
  selectedFriendIds,
  isPending,
  itemTitle,
  itemUrl,
  onItemTitleChange,
  onItemUrlChange,
  onAddItem,
  onPatch,
}: {
  session: SocialSession;
  currentUserId: string;
  friends: Person[];
  selectedFriendIds: string[];
  isPending: boolean;
  itemTitle: string;
  itemUrl: string;
  onItemTitleChange: (value: string) => void;
  onItemUrlChange: (value: string) => void;
  onAddItem: () => void;
  onPatch: (body: Record<string, unknown>, message?: string) => void;
}) {
  const currentItem = session.items.find((item) => item.id === session.currentItemId) ?? session.items[0] ?? null;
  const isHost = session.hostId === currentUserId;
  const invitedIds = new Set(session.participants.map((participant) => participant.userId));
  const inviteOptions = friends.filter((friend) => !invitedIds.has(friend.id) && (selectedFriendIds.length === 0 || selectedFriendIds.includes(friend.id)));

  return (
    <article className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)]/64 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-bold ${sessionStatusClass(session.status)}`}>
            {session.status}
          </span>
          <h3 className="mt-3 text-2xl font-bold">{session.title}</h3>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {sessionLabel(session.sessionType)} - {session.participants.length} participant{session.participants.length === 1 ? "" : "s"}
          </p>
          {session.callStatus === "live" && (
            <p className="mt-2 inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1.5 text-xs font-bold text-emerald-100">
              {session.callMode === "video" ? <Video size={13} aria-hidden="true" /> : <Mic size={13} aria-hidden="true" />}
              {session.callMode} call live
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {session.callStatus !== "live" ? (
            <>
              <button type="button" onClick={() => onPatch({ action: "start-call", callMode: "voice" }, "Voice call started.")} disabled={isPending || session.status === "ended"} className="mesh-action mesh-action-secondary px-3 text-sm">
                <Mic size={15} aria-hidden="true" />
                Voice
              </button>
              <button type="button" onClick={() => onPatch({ action: "start-call", callMode: "video" }, "Video call started.")} disabled={isPending || session.status === "ended"} className="mesh-action mesh-action-secondary px-3 text-sm">
                <Video size={15} aria-hidden="true" />
                Video
              </button>
            </>
          ) : (
            isHost && (
              <button type="button" onClick={() => onPatch({ action: "end-call" }, "Call ended.")} disabled={isPending} className="mesh-action mesh-action-secondary px-3 text-sm">
                End call
              </button>
            )
          )}
          {isHost && session.status !== "live" && (
            <button type="button" onClick={() => onPatch({ action: "start" }, "Room is live.")} disabled={isPending || session.status === "ended"} className="mesh-action mesh-action-primary px-4 text-sm">
              Start
            </button>
          )}
          {isHost && session.status !== "ended" && (
            <button type="button" onClick={() => onPatch({ action: "end" }, "Room ended.")} disabled={isPending} className="mesh-action mesh-action-secondary px-4 text-sm">
              End
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {session.participants.map((participant) => (
          <span key={participant.id} className="inline-flex items-center gap-2 rounded-full border border-[var(--border-primary)] bg-[var(--bg-secondary)]/50 px-2.5 py-1.5 text-xs font-bold text-[var(--text-secondary)]">
            <Avatar src={participant.user.avatarUrl} alt={participant.user.displayName} size="xs" />
            {participant.user.displayName}
          </span>
        ))}
      </div>

      {isHost && inviteOptions.length > 0 && (
        <div className="mt-4 rounded-md border border-[var(--border-primary)] bg-[var(--bg-secondary)]/40 p-3">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Invite selected friends</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {inviteOptions.slice(0, 8).map((friend) => (
              <button key={friend.id} type="button" onClick={() => onPatch({ action: "invite", userId: friend.id }, `${friend.displayName} invited.`)} disabled={isPending} className="mesh-action mesh-action-secondary px-3 text-xs">
                <Plus size={13} aria-hidden="true" />
                {friend.displayName}
              </button>
            ))}
          </div>
        </div>
      )}

      {currentItem && (
        <div className="mt-4 rounded-md border border-[var(--border-primary)] bg-[var(--bg-secondary)]/45 p-3">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Now focused</p>
          <h4 className="mt-1 text-base font-bold">{currentItem.title || "Shared item"}</h4>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{platformLabel(currentItem.sourcePlatform)}</p>
          {currentItem.sourceUrl && (
            <a href={currentItem.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[var(--accent)]">
              <Link2 size={13} aria-hidden="true" />
              Open source
            </a>
          )}
        </div>
      )}

      <div className="mt-4 grid gap-2 rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)]/60 p-3 md:grid-cols-[1fr_1fr_auto]">
        <input value={itemTitle} onChange={(event) => onItemTitleChange(event.target.value)} className="simple-input h-11 px-3 text-sm" placeholder="Queue item title" />
        <input value={itemUrl} onChange={(event) => onItemUrlChange(event.target.value)} className="simple-input h-11 px-3 text-sm" placeholder="Optional URL" />
        <button type="button" onClick={onAddItem} disabled={isPending || (!itemTitle.trim() && !itemUrl.trim())} className="mesh-action mesh-action-secondary px-4 text-sm">
          <Plus size={15} aria-hidden="true" />
          Add
        </button>
      </div>

      <div className="mt-4 grid gap-2">
        {session.items.length > 0 ? session.items.map((item) => {
          const keeps = item.votes.filter((vote) => vote.vote === "keep").length;
          const skips = item.votes.filter((vote) => vote.vote === "skip").length;
          const myVote = item.votes.find((vote) => vote.userId === currentUserId)?.vote;
          return (
            <div key={item.id} className={`rounded-md border p-3 ${session.currentItemId === item.id ? "border-emerald-300/35 bg-emerald-300/10" : "border-[var(--border-primary)] bg-[var(--bg-primary)]/60"}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">{platformLabel(item.sourcePlatform)}</p>
                  <h4 className="mt-1 truncate text-sm font-bold">{item.title || "Shared item"}</h4>
                  {item.content && <p className="mt-1 line-clamp-2 text-xs text-[var(--text-secondary)]">{item.content}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {isHost && (
                    <button type="button" onClick={() => onPatch({ action: "set-current-item", itemId: item.id }, "Focused item updated.")} disabled={isPending} className="mesh-action mesh-action-secondary px-3 text-xs">
                      Focus
                    </button>
                  )}
                  <button type="button" onClick={() => onPatch({ action: "vote", itemId: item.id, vote: "keep" })} disabled={isPending} className={`mesh-action px-3 text-xs ${myVote === "keep" ? "mesh-action-primary" : "mesh-action-secondary"}`}>
                    <Check size={13} aria-hidden="true" />
                    {keeps}
                  </button>
                  <button type="button" onClick={() => onPatch({ action: "vote", itemId: item.id, vote: "skip" })} disabled={isPending} className={`mesh-action px-3 text-xs ${myVote === "skip" ? "border-red-300/30 bg-red-500/10 text-red-100" : "mesh-action-secondary"}`}>
                    <SkipForward size={13} aria-hidden="true" />
                    {skips}
                  </button>
                </div>
              </div>
            </div>
          );
        }) : (
          <p className="rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)]/60 p-3 text-sm text-[var(--text-secondary)]">
            Add posts, videos, or links to build the shared queue.
          </p>
        )}
      </div>
    </article>
  );
}

function ContentQueue({
  activeSession,
  recentPosts,
  platformPosts,
  onAddNativePost,
  onAddPlatformPost,
  onSaveNativePost,
  onSavePlatformPost,
  isPending,
}: {
  activeSession: SocialSession | null;
  recentPosts: NativePost[];
  platformPosts: PlatformPost[];
  onAddNativePost: (sessionId: string, post: NativePost) => void;
  onAddPlatformPost: (sessionId: string, post: PlatformPost) => void;
  onSaveNativePost: (post: NativePost) => void;
  onSavePlatformPost: (post: PlatformPost) => void;
  isPending: boolean;
}) {
  return (
    <Panel title="Content queue" icon={<Bookmark size={18} aria-hidden="true" />}>
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-bold">Mesh.me posts</h3>
          <div className="mt-3 grid gap-2">
            {recentPosts.slice(0, 6).map((post) => (
              <article key={post.id} className="rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)]/60 p-3">
                <p className="line-clamp-2 text-sm font-bold">{postTitle(post)}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {post.author.displayName} - {post.counts.reactions} likes - {formatRelativeTime(post.createdAt)}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => activeSession && onAddNativePost(activeSession.id, post)} disabled={isPending || !activeSession} className="mesh-action mesh-action-secondary px-3 text-xs">
                    <Radio size={13} aria-hidden="true" />
                    Queue
                  </button>
                  <button type="button" onClick={() => onSaveNativePost(post)} disabled={isPending} className="mesh-action mesh-action-secondary px-3 text-xs">
                    <Archive size={13} aria-hidden="true" />
                    Vault
                  </button>
                  <Link href={`/feed/${post.id}`} className="mesh-action mesh-action-secondary px-3 text-xs">
                    Open
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-bold">Connected platform posts</h3>
          <div className="mt-3 grid gap-2">
            {platformPosts.slice(0, 6).map((post) => (
              <article key={post.id} className="rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)]/60 p-3">
                <div className="flex gap-3">
                  {(post.thumbnailUrl || post.media[0]?.thumbnailUrl || post.media[0]?.url) && (
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md border border-[var(--border-primary)] bg-[var(--bg-secondary)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={post.thumbnailUrl || post.media[0]?.thumbnailUrl || post.media[0]?.url || ""} alt="" className="h-full w-full object-cover" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-bold">{platformPostTitle(post)}</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {platformLabel(post.connectedAccount.platform)} - {post.likeCount} likes - {post.viewCount} views
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => activeSession && onAddPlatformPost(activeSession.id, post)} disabled={isPending || !activeSession} className="mesh-action mesh-action-secondary px-3 text-xs">
                    <Radio size={13} aria-hidden="true" />
                    Queue
                  </button>
                  <button type="button" onClick={() => onSavePlatformPost(post)} disabled={isPending} className="mesh-action mesh-action-secondary px-3 text-xs">
                    <Archive size={13} aria-hidden="true" />
                    Vault
                  </button>
                  {post.url && (
                    <a href={post.url} target="_blank" rel="noreferrer" className="mesh-action mesh-action-secondary px-3 text-xs">
                      Source
                    </a>
                  )}
                </div>
              </article>
            ))}
            {platformPosts.length === 0 && (
              <Link href="/connected-accounts" className="mesh-link-row rounded-md px-3 py-3 text-sm">
                Connect accounts to queue and save source-linked content.
              </Link>
            )}
          </div>
        </div>
      </div>
    </Panel>
  );
}
