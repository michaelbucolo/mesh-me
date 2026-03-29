import { getCurrentUser } from "@/lib/auth";
import { getUserProfile, getUserPosts } from "@/lib/queries";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { notFound } from "next/navigation";
import { MapPin, Link as LinkIcon, Calendar, MessageCircle, MoreHorizontal, Link2 } from "lucide-react";
import Link from "next/link";
import { FollowButton } from "./follow-button";
import { formatCount } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { ProfileTabs } from "./profile-tabs";

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const currentUser = await getCurrentUser();
  const profile = await getUserProfile(username);

  if (!profile) notFound();

  const posts = await getUserPosts(username);

  // Get connected accounts for profile display
  const connectedAccounts = await prisma.connectedAccount.findMany({
    where: { userId: profile.id, isActive: true },
    select: { platform: true, platformUsername: true },
  });

  // Get user communities
  const communities = await prisma.communityMember.findMany({
    where: { userId: profile.id },
    include: {
      community: { select: { id: true, name: true, slug: true, _count: { select: { members: true } } } },
    },
    take: 10,
  });

  return (
    <div className="max-w-2xl mx-auto animate-page-enter">
      {/* Banner */}
      <div className="h-48 relative" style={{ background: "linear-gradient(135deg, rgba(45,127,249,0.3) 0%, rgba(0,198,251,0.3) 100%)" }}>
        {profile.bannerUrl && (
          <img src={profile.bannerUrl} alt="" className="w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 to-transparent" />
      </div>

      {/* Profile header */}
      <div className="px-6 -mt-16 relative">
        <div className="flex items-end justify-between mb-4">
          <Avatar
            src={profile.avatarUrl}
            alt={profile.displayName}
            size="xl"
            className="ring-4 ring-zinc-950"
          />
          <div className="flex items-center gap-2 mb-2">
            {profile.isOwnProfile ? (
              <Link href="/settings">
                <Button variant="secondary" size="sm">Edit profile</Button>
              </Link>
            ) : (
              <>
                <Link href={`/messages?user=${profile.username}`}>
                  <Button variant="secondary" size="icon-sm">
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                </Link>
                <FollowButton userId={profile.id} isFollowing={profile.isFollowing} />
                <Button variant="ghost" size="icon-sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="mb-4">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-[var(--text-primary)]">{profile.displayName}</h1>
            {profile.isVerified && (
              <svg className="h-5 w-5" style={{ color: "var(--accent)" }} viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>
          <p className="text-sm text-[var(--text-muted)]">@{profile.username}</p>
        </div>

        {profile.bio && (
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-3">{profile.bio}</p>
        )}

        <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--text-muted)] mb-3">
          {profile.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {profile.location}
            </span>
          )}
          {profile.website && (
            <a href={profile.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 transition-colors" style={{ color: "var(--accent)" }}>
              <LinkIcon className="h-3.5 w-3.5" />
              {profile.website.replace(/^https?:\/\//, "")}
            </a>
          )}
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            Joined {new Date(profile.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </span>
        </div>

        <div className="flex items-center gap-4 text-sm mb-4">
          <span className="text-[var(--text-tertiary)]">
            <strong className="text-[var(--text-primary)]">{formatCount(profile._count.following)}</strong> following
          </span>
          <span className="text-[var(--text-tertiary)]">
            <strong className="text-[var(--text-primary)]">{formatCount(profile._count.followers)}</strong> followers
          </span>
        </div>

        {/* Interests */}
        {profile.interests.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {profile.interests.map((interest) => (
              <Badge key={interest.id} variant="secondary">{interest.tag}</Badge>
            ))}
          </div>
        )}

        {/* Connected Accounts on Profile */}
        {connectedAccounts.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {connectedAccounts.map((account) => (
              <span
                key={account.platform}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg glass-surface/50 text-xs text-[var(--text-secondary)]"
              >
                <Link2 className="h-3 w-3" style={{ color: "var(--accent)" }} />
                {account.platform}
                {account.platformUsername && <span className="text-[var(--text-muted)]">@{account.platformUsername}</span>}
              </span>
            ))}
          </div>
        )}

        {/* Mutual followers */}
        {!profile.isOwnProfile && profile.mutualFollowers.length > 0 && (
          <div className="flex items-center gap-2 mb-4 text-xs text-[var(--text-muted)]">
            <div className="flex -space-x-2">
              {profile.mutualFollowers.slice(0, 3).map((mutual) => (
                <Avatar key={mutual.id} src={mutual.avatarUrl} alt={mutual.displayName} size="xs" />
              ))}
            </div>
            <span>
              Followed by {profile.mutualFollowers.map((m) => m.displayName).join(", ")}
              {profile.mutualFollowers.length > 3 && ` and ${profile.mutualFollowers.length - 3} others`}
            </span>
          </div>
        )}

        {/* Links */}
        {profile.links.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {profile.links.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-surface text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
              >
                <LinkIcon className="h-3 w-3" />
                {link.label}
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Profile Tabs */}
      <ProfileTabs
        posts={posts.map((p) => ({ ...p, createdAt: String(p.createdAt) }))}
        communities={communities.map((cm) => ({
          id: cm.community.id,
          name: cm.community.name,
          slug: cm.community.slug,
          memberCount: cm.community._count.members,
          role: cm.role,
        }))}
        connectedAccounts={connectedAccounts}
        profile={{
          bio: profile.bio,
          location: profile.location,
          website: profile.website,
          createdAt: String(profile.createdAt),
          interests: profile.interests.map((i) => i.tag),
        }}
        currentUserId={currentUser?.id}
        isOwnProfile={profile.isOwnProfile}
        displayName={profile.displayName}
      />
    </div>
  );
}
