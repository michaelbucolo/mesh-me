import { getCurrentUser } from "@/lib/auth";
import { getCommunityBySlug, getCommunityPosts } from "@/lib/queries";
import { PostCard } from "@/components/feed/post-card";
import { PostComposer } from "@/components/feed/post-composer";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { notFound } from "next/navigation";
import { ArrowLeft, Users, FileText, Shield } from "lucide-react";
import Link from "next/link";
import { JoinButton } from "./join-button";

export default async function CommunityDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  const community = await getCommunityBySlug(slug);

  if (!community) notFound();

  const posts = await getCommunityPosts(community.id);

  return (
    <div className="max-w-2xl mx-auto">
      {/* Banner */}
      <div className="h-40 bg-gradient-to-br from-indigo-600/20 to-purple-600/20 relative">
        {community.bannerUrl && (
          <img src={community.bannerUrl} alt="" className="w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 to-transparent" />
        <Link href="/communities" className="absolute top-4 left-4 inline-flex items-center gap-2 text-sm text-zinc-300 hover:text-white bg-zinc-950/50 rounded-lg px-3 py-1.5 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>

      {/* Community header */}
      <div className="px-6 -mt-8 relative">
        <div className="flex items-end justify-between mb-4">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center ring-4 ring-zinc-950 text-white font-bold text-xl">
            {community.iconUrl ? (
              <img src={community.iconUrl} alt={community.name} className="w-full h-full rounded-2xl object-cover" />
            ) : (
              community.name[0]
            )}
          </div>
          {user && <JoinButton communityId={community.id} isMember={community.isMember} />}
        </div>

        <h1 className="text-xl font-bold text-zinc-100 mb-1">{community.name}</h1>
        {community.category && <Badge variant="secondary" className="mb-2">{community.category}</Badge>}
        {community.description && (
          <p className="text-sm text-zinc-400 leading-relaxed mb-3">{community.description}</p>
        )}

        <div className="flex items-center gap-4 text-sm text-zinc-500 mb-4">
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {community._count.members} members
          </span>
          <span className="flex items-center gap-1">
            <FileText className="h-3.5 w-3.5" />
            {community._count.posts} posts
          </span>
        </div>

        {/* Members preview */}
        {community.members.length > 0 && (
          <div className="flex items-center gap-2 mb-4">
            <div className="flex -space-x-2">
              {community.members.slice(0, 5).map((member) => (
                <Avatar key={member.user.id} src={member.user.avatarUrl} alt={member.user.displayName} size="xs" />
              ))}
            </div>
            {community._count.members > 5 && (
              <span className="text-xs text-zinc-500">+{community._count.members - 5} more</span>
            )}
          </div>
        )}

        {/* Rules */}
        {community.rules && (
          <details className="mb-4">
            <summary className="text-sm font-medium text-zinc-400 cursor-pointer flex items-center gap-1.5 hover:text-zinc-300">
              <Shield className="h-3.5 w-3.5" />
              Community rules
            </summary>
            <p className="text-sm text-zinc-500 mt-2 pl-5 whitespace-pre-wrap">{community.rules}</p>
          </details>
        )}
      </div>

      {/* Posts */}
      <div className="px-4 py-6 border-t border-zinc-800">
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
