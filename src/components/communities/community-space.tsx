import Image from "next/image";
import Link from "next/link";
import { Flag, MessageCircle, Pin, Send, Shield, Trash2, UserMinus, UserPlus, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PostCard } from "@/components/feed/post-card";
import { CommunityJoinButton } from "@/components/communities/community-join-button";
import type { getCommunitySpaceData } from "@/lib/community-hub";
import {
  createCommunityPostFromForm,
  moderateCommunityPostFromForm,
  removeCommunityMemberFromForm,
  sendCommunityMessageFromForm,
  updateCommunityFromForm,
  updateCommunityMemberRoleFromForm,
} from "@/lib/actions";
import { formatCount, formatRelativeTime } from "@/lib/utils";

type CommunityReadyData = Extract<NonNullable<Awaited<ReturnType<typeof getCommunitySpaceData>>>, { status: "ready" }>;

function rulesList(rules?: string | null) {
  const cleaned = (rules || "")
    .split(/\r?\n/)
    .map((rule) => rule.trim().replace(/^[-*]\s*/, ""))
    .filter(Boolean);

  if (cleaned.length) return cleaned;
  return ["Respect people.", "Credit original creators.", "Keep private community content inside the community."];
}

function CommunityHero({ data }: { data: CommunityReadyData }) {
  const { community, membership } = data;

  return (
    <section className="mesh-surface overflow-hidden rounded-[28px] border border-[var(--ds-border)] shadow-[var(--shadow-soft)]">
      <div className="relative h-36 bg-[linear-gradient(135deg,var(--accent-subtle),var(--ds-surface-muted))] sm:h-48">
        {community.bannerUrl ? (
          <Image src={community.bannerUrl} alt="" fill sizes="100vw" className="object-cover" priority />
        ) : (
          <div className="absolute inset-0 opacity-70">
            <div className="absolute left-8 top-8 h-24 w-24 rounded-full bg-[var(--accent-subtle)] blur-2xl" />
            <div className="absolute bottom-8 right-8 h-20 w-44 rounded-full bg-[var(--ds-surface-glass)] blur-xl" />
          </div>
        )}
      </div>
      <div className="px-4 pb-5 sm:px-6">
        <div className="-mt-8 flex flex-col gap-4 sm:-mt-10 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 items-end gap-3">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[24px] border-4 border-[var(--bg-primary)] bg-[var(--accent-subtle)] shadow-[var(--shadow-soft)]">
              {community.iconUrl ? (
                <Image src={community.iconUrl} alt="" fill sizes="80px" className="object-cover" />
              ) : (
                <span className="grid h-full w-full place-items-center text-3xl font-semibold text-[var(--accent-text)]">
                  {community.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-semibold tracking-[0] text-[var(--text-primary)] sm:text-3xl">{community.name}</h1>
                <Badge variant={community.isPublic ? "outline" : "warning"}>{community.isPublic ? "Public" : "Private"}</Badge>
                {membership ? <Badge variant="accent">{membership.role}</Badge> : null}
              </div>
              <p className="mt-1 line-clamp-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
                {community.description || "A shared space for posts, members, chat, and rules."}
              </p>
            </div>
          </div>
          <CommunityJoinButton
            communityId={community.id}
            isMember={Boolean(membership)}
            isPrivate={!community.isPublic}
            role={membership?.role}
          />
        </div>

        <div className="mt-5 flex flex-wrap gap-2 text-sm text-[var(--text-secondary)]">
          <Badge variant="secondary">{formatCount(community._count.members)} members</Badge>
          <Badge variant="secondary">{formatCount(community._count.posts)} posts</Badge>
          {community.category ? <Badge variant="secondary">#{community.category}</Badge> : null}
          <Badge variant="secondary">Created {formatRelativeTime(community.createdAt)}</Badge>
        </div>
      </div>
    </section>
  );
}

function CommunityComposer({ community, canPost }: { community: CommunityReadyData["community"]; canPost: boolean }) {
  if (!canPost) {
    return (
      <section className="mesh-surface rounded-[24px] border border-[var(--ds-border)] p-5 text-sm text-[var(--text-secondary)]">
        Join this community to post and join the chat.
      </section>
    );
  }

  return (
    <form action={createCommunityPostFromForm} className="mesh-surface rounded-[24px] border border-[var(--ds-border)] p-4">
      <input type="hidden" name="communityId" value={community.id} />
      <input type="hidden" name="visibility" value={community.isPublic ? "public" : "private"} />
      <textarea
        name="content"
        required
        maxLength={500}
        rows={3}
        placeholder={`Post to ${community.name}`}
        className="simple-input min-h-24 resize-y border-transparent bg-[var(--ds-surface)]"
      />
      <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <input name="mediaUrls" type="url" placeholder="Optional image, video, or link URL" className="simple-input" />
        <Button type="submit" leftIcon={<Send className="h-4 w-4" />}>
          Post
        </Button>
      </div>
    </form>
  );
}

function CommunityChat({ data }: { data: CommunityReadyData }) {
  return (
    <section className="mesh-surface rounded-[24px] border border-[var(--ds-border)] p-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--text-primary)]">
        <MessageCircle className="h-5 w-5 text-[var(--accent-text)]" />
        Community chat
      </h2>
      <div className="mt-4 max-h-[360px] space-y-3 overflow-y-auto pr-1">
        {data.chatMessages.length ? (
          data.chatMessages.map((message) => (
            <div key={message.id} className="flex gap-3">
              <Avatar
                src={message.sender.avatarUrl}
                alt={message.sender.displayName || message.sender.username}
                size="sm"
              />
              <div className="min-w-0 rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface)] px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-[var(--text-primary)]">
                    {message.sender.displayName || message.sender.username}
                  </span>
                  <span className="text-xs text-[var(--text-tertiary)]">{formatRelativeTime(message.createdAt)}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--text-secondary)]">{message.content}</p>
              </div>
            </div>
          ))
        ) : (
          <p className="rounded-2xl border border-dashed border-[var(--ds-border)] p-4 text-sm text-[var(--text-secondary)]">
            No messages yet. Start the space chat.
          </p>
        )}
      </div>

      {data.canPost ? (
        <form action={sendCommunityMessageFromForm} className="mt-4 flex gap-2">
          <input type="hidden" name="communityId" value={data.community.id} />
          <input name="content" required maxLength={1200} placeholder="Message the community" className="simple-input" />
          <Button type="submit" size="icon" aria-label="Send message">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      ) : null}
    </section>
  );
}

function MembersPanel({ data }: { data: CommunityReadyData }) {
  return (
    <section className="mesh-surface rounded-[24px] border border-[var(--ds-border)] p-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--text-primary)]">
        <Users className="h-5 w-5 text-[var(--accent-text)]" />
        Members
      </h2>
      <div className="mt-4 space-y-3">
        {data.members.map((member) => (
          <div key={member.id} className="rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-3">
            <div className="flex items-center gap-3">
              <Avatar
                src={member.user.avatarUrl}
                alt={member.user.displayName || member.user.username}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <Link href={`/profile/${member.user.username}`} className="truncate text-sm font-semibold text-[var(--text-primary)] hover:underline">
                  {member.user.displayName || member.user.username}
                </Link>
                <p className="truncate text-xs text-[var(--text-tertiary)]">@{member.user.username}</p>
              </div>
              <Badge variant={member.role === "admin" ? "accent" : member.role === "moderator" ? "success" : "secondary"}>
                {member.role}
              </Badge>
            </div>

            {data.canAdmin && member.role !== "admin" ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <form action={updateCommunityMemberRoleFromForm}>
                  <input type="hidden" name="communityId" value={data.community.id} />
                  <input type="hidden" name="targetUserId" value={member.userId} />
                  <input type="hidden" name="role" value={member.role === "moderator" ? "member" : "moderator"} />
                  <Button type="submit" size="sm" variant="secondary" leftIcon={<UserPlus className="h-3.5 w-3.5" />}>
                    {member.role === "moderator" ? "Make member" : "Make moderator"}
                  </Button>
                </form>
                <form action={removeCommunityMemberFromForm}>
                  <input type="hidden" name="communityId" value={data.community.id} />
                  <input type="hidden" name="targetUserId" value={member.userId} />
                  <Button type="submit" size="sm" variant="danger" leftIcon={<UserMinus className="h-3.5 w-3.5" />}>
                    Remove
                  </Button>
                </form>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function ModerationPanel({ data }: { data: CommunityReadyData }) {
  if (!data.canModerate) return null;

  return (
    <section className="mesh-surface rounded-[24px] border border-[var(--ds-border)] p-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--text-primary)]">
        <Shield className="h-5 w-5 text-[var(--accent-text)]" />
        Moderation
      </h2>
      <div className="mt-4 grid gap-3">
        <div className="rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-3">
          <p className="text-sm font-semibold text-[var(--text-primary)]">{data.reports.length} open reports</p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">Review reported posts, comments, and community issues.</p>
        </div>
        {data.reports.length ? (
          data.reports.map((report) => (
            <div key={report.id} className="rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                <Flag className="h-4 w-4 text-[var(--ds-danger)]" />
                {report.reason}
              </div>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                Reported by {report.reporter.displayName || report.reporter.username} {formatRelativeTime(report.createdAt)}
              </p>
              {report.reportedPost ? (
                <p className="mt-2 line-clamp-2 text-xs text-[var(--text-tertiary)]">{report.reportedPost.content}</p>
              ) : null}
            </div>
          ))
        ) : (
          <p className="text-sm text-[var(--text-secondary)]">No reports right now.</p>
        )}
      </div>
    </section>
  );
}

function SettingsPanel({ data }: { data: CommunityReadyData }) {
  if (!data.canAdmin) return null;

  return (
    <section className="mesh-surface rounded-[24px] border border-[var(--ds-border)] p-4">
      <h2 className="text-lg font-semibold text-[var(--text-primary)]">Settings</h2>
      <form action={updateCommunityFromForm} className="mt-4 grid gap-3">
        <input type="hidden" name="communityId" value={data.community.id} />
        <label className="grid gap-2">
          <span className="text-xs font-semibold text-[var(--text-secondary)]">Description</span>
          <textarea name="description" rows={3} maxLength={240} defaultValue={data.community.description || ""} className="simple-input resize-y" />
        </label>
        <label className="grid gap-2">
          <span className="text-xs font-semibold text-[var(--text-secondary)]">Category</span>
          <input name="category" maxLength={40} defaultValue={data.community.category || ""} className="simple-input" />
        </label>
        <label className="grid gap-2">
          <span className="text-xs font-semibold text-[var(--text-secondary)]">Icon URL</span>
          <input name="iconUrl" type="url" defaultValue={data.community.iconUrl || ""} className="simple-input" />
        </label>
        <label className="grid gap-2">
          <span className="text-xs font-semibold text-[var(--text-secondary)]">Banner URL</span>
          <input name="bannerUrl" type="url" defaultValue={data.community.bannerUrl || ""} className="simple-input" />
        </label>
        <label className="grid gap-2">
          <span className="text-xs font-semibold text-[var(--text-secondary)]">Rules</span>
          <textarea name="rules" rows={5} maxLength={800} defaultValue={data.community.rules || ""} className="simple-input resize-y" />
        </label>
        <label className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-3">
          <span>
            <span className="block text-sm font-semibold text-[var(--text-primary)]">Public discovery</span>
            <span className="text-xs text-[var(--text-secondary)]">Turn off for private member-only spaces.</span>
          </span>
          <input type="checkbox" name="isPublic" value="true" defaultChecked={data.community.isPublic} className="h-5 w-5 accent-[var(--accent)]" />
        </label>
        <Button type="submit">Save community</Button>
      </form>
    </section>
  );
}

export function CommunitySpace({ data }: { data: CommunityReadyData }) {
  return (
    <main className="mx-auto grid w-full max-w-6xl gap-5 px-3 py-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="min-w-0 space-y-4">
        <CommunityHero data={data} />
        <CommunityComposer community={data.community} canPost={data.canPost} />

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">Posts</h2>
          {data.posts.length ? (
            data.posts.map((post) => (
              <div key={post.id} className="space-y-2">
                {data.canModerate ? (
                  <div className="flex flex-wrap justify-end gap-2">
                    <form action={moderateCommunityPostFromForm}>
                      <input type="hidden" name="communityId" value={data.community.id} />
                      <input type="hidden" name="postId" value={post.id} />
                      <input type="hidden" name="moderationAction" value="toggle-pin" />
                      <Button type="submit" size="sm" variant="secondary" leftIcon={<Pin className="h-3.5 w-3.5" />}>
                        {post.isPinned ? "Unpin" : "Pin"}
                      </Button>
                    </form>
                    <form action={moderateCommunityPostFromForm}>
                      <input type="hidden" name="communityId" value={data.community.id} />
                      <input type="hidden" name="postId" value={post.id} />
                      <input type="hidden" name="moderationAction" value="delete" />
                      <Button type="submit" size="sm" variant="danger" leftIcon={<Trash2 className="h-3.5 w-3.5" />}>
                        Remove
                      </Button>
                    </form>
                  </div>
                ) : null}
                <PostCard
                  post={{
                    ...post,
                    community: {
                      id: data.community.id,
                      name: data.community.name,
                      slug: data.community.slug,
                    },
                    platform: "meshme",
                  }}
                  currentUserId={data.user.id}
                  connectedPlatforms={["meshme"]}
                />
              </div>
            ))
          ) : (
            <div className="mesh-surface rounded-[24px] border border-dashed border-[var(--ds-border)] p-8 text-center">
              <MessageCircle className="mx-auto h-8 w-8 text-[var(--accent-text)]" />
              <h3 className="mt-3 text-lg font-semibold text-[var(--text-primary)]">No posts yet</h3>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">Start the conversation with a post or link.</p>
            </div>
          )}
        </section>
      </section>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <section className="mesh-surface rounded-[24px] border border-[var(--ds-border)] p-4">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Rules</h2>
          <ol className="mt-4 space-y-3">
            {rulesList(data.community.rules).map((rule, index) => (
              <li key={`${rule}-${index}`} className="flex gap-3 text-sm text-[var(--text-secondary)]">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--accent-subtle)] text-xs font-semibold text-[var(--accent-text)]">
                  {index + 1}
                </span>
                <span>{rule}</span>
              </li>
            ))}
          </ol>
        </section>
        <CommunityChat data={data} />
        <MembersPanel data={data} />
        <ModerationPanel data={data} />
        <SettingsPanel data={data} />
      </aside>
    </main>
  );
}
