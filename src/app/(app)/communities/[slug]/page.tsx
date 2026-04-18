import { getCurrentUser } from "@/lib/auth";
import { getCommunityBySlug, getCommunityPosts, getCommunityMembers } from "@/lib/queries";
import { PostCard } from "@/components/feed/post-card";
import { PostComposer } from "@/components/feed/post-composer";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { notFound } from "next/navigation";
import { ArrowLeft, Users, FileText, Shield, Crown, Settings } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { JoinButton } from "./join-button";

export default async function CommunityDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  const community = await getCommunityBySlug(slug);

  if (!community) notFound();

  const [posts, members] = await Promise.all([
    getCommunityPosts(community.id),
    getCommunityMembers(community.id),
  ]);

  const admins = members.filter((m: { role: string; user: { id: string; username: string; displayName: string; avatarUrl: string | null } }) => m.role === "admin" || m.role === "moderator");
  const isAdmin = community.userRole === "admin";
  const isMod = community.userRole === "moderator" || isAdmin;

  return (
    <div data-meshi-zone="community-detail" className="max-w-3xl mx-auto animate-page-enter">
      {/* Banner */}
      <div className="h-48 relative rounded-b-2xl overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(45,127,249,0.3), rgba(0,198,251,0.3))" }}>
        {community.bannerUrl && (
          <Image src={community.bannerUrl} alt="" fill sizes="(max-width: 768px) 100vw, 768px" className="object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-primary)]/90 via-[var(--bg-primary)]/30 to-transparent" />
        <Link href="/communities" className="absolute top-4 left-4 inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-white bg-[var(--bg-primary)]/50 backdrop-blur-sm rounded-lg px-3 py-1.5 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>

      {/* Community header */}
      <div className="px-6 -mt-10 relative">
        <div className="flex items-end justify-between mb-4">
          <div className="h-20 w-20 rounded-2xl relative flex items-center justify-center ring-4 ring-[var(--bg-primary)] text-white font-bold text-2xl shadow-xl" style={{ background: "var(--brand-gradient)" }}>
            {community.iconUrl ? (
              <Image src={community.iconUrl} alt={community.name} fill sizes="80px" className="rounded-2xl object-cover" />
            ) : (
              community.name[0]
            )}
          </div>
          <div className="flex items-center gap-2">
            {isMod && (
              <Link href={`/communities/${slug}`} className="p-2 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors">
                <Settings className="h-5 w-5" />
              </Link>
            )}
            {user && <JoinButton communityId={community.id} isMember={community.isMember} />}
          </div>
        </div>

        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">{community.name}</h1>
        <div className="flex items-center gap-3 mb-3">
          {community.category && <Badge variant="secondary">{community.category}</Badge>}
          {isAdmin && <Badge variant="default">Admin</Badge>}
        </div>
        {community.description && (
          <p className="text-sm text-[var(--text-tertiary)] leading-relaxed mb-4">{community.description}</p>
        )}

        <div className="flex items-center gap-6 text-sm text-[var(--text-muted)] mb-4">
          <span className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            <strong className="text-[var(--text-secondary)]">{community._count.members}</strong> members
          </span>
          <span className="flex items-center gap-1.5">
            <FileText className="h-4 w-4" />
            <strong className="text-[var(--text-secondary)]">{community._count.posts}</strong> posts
          </span>
        </div>

        {/* Moderators */}
        {admins.length > 0 && (
          <div className="flex items-center gap-3 mb-4 py-3 border-t border-[var(--border-primary)]">
            <span className="text-xs text-[var(--text-muted)] flex items-center gap-1"><Crown className="h-3 w-3" /> Moderators:</span>
            <div className="flex items-center gap-2">
              {admins.slice(0, 5).map((m: { role: string; user: { id: string; username: string; displayName: string; avatarUrl: string | null } }) => (
                <Link key={m.user.id} href={`/profile/${m.user.username}`} className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
                  <Avatar src={m.user.avatarUrl} alt={m.user.displayName} size="xs" />
                  <span>{m.user.displayName}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Members preview */}
        {community.members.length > 0 && (
          <div className="flex items-center gap-3 mb-4">
            <div className="flex -space-x-2">
              {community.members.slice(0, 8).map((member: { user: { id: string; username: string; displayName: string; avatarUrl: string | null } }) => (
                <Avatar key={member.user.id} src={member.user.avatarUrl} alt={member.user.displayName} size="xs" />
              ))}
            </div>
            {community._count.members > 8 && (
              <span className="text-xs text-[var(--text-muted)]">+{community._count.members - 8} more</span>
            )}
          </div>
        )}

        {/* Rules */}
        {community.rules && (
          <details className="mb-4 rounded-xl glass-card/50 overflow-hidden">
            <summary className="text-sm font-medium text-[var(--text-tertiary)] cursor-pointer flex items-center gap-2 p-3 hover:bg-[var(--bg-tertiary)] transition-colors">
              <Shield className="h-4 w-4" style={{ color: "var(--accent)" }} />
              Community rules
            </summary>
            <div className="px-3 pb-3 text-sm text-[var(--text-muted)] whitespace-pre-wrap border-t border-[var(--border-primary)] pt-3">{community.rules}</div>
          </details>
        )}
      </div>

      {/* Posts */}
      <div className="px-4 py-6 border-t border-[var(--border-primary)]">
        {community.isMember && user && (
          <div className="mb-6">
            <PostComposer
              user={{ displayName: user.displayName, avatarUrl: user.avatarUrl }}
              communityId={community.id}
            />
          </div>
        )}

        <div className="space-y-4">
          {posts.length > 0 ? (
            posts.map((post) => (
              <PostCard key={post.id} post={post} currentUserId={user?.id} />
            ))
          ) : (
            <EmptyState
              icon={FileText}
              title="No posts yet"
              description={community.isMember ? "Be the first to post in this community!" : "Join this community to start posting."}
            />
          )}
        </div>
      </div>
    </div>
  );
}
