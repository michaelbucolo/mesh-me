import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Crown, EyeOff, Grid3X3, Hash, Link as LinkIcon, MapPin, MessageCircle, PlugZap, Settings, ShieldCheck, Sparkles } from "lucide-react";
import {
  MeshiMascot,
  type MeshiAccessory,
  type MeshiBadge,
  type MeshiColor,
  type MeshiEyeStyle,
  type MeshiHair,
  type MeshiHat,
  type MeshiMood,
  type MeshiOutfit,
} from "@/components/meshi/meshi-mascot";
import { Avatar } from "@/components/ui/avatar";
import { getCurrentUser } from "@/lib/auth";
import { getUserPosts, getUserProfile } from "@/lib/queries";
import { formatCount } from "@/lib/utils";
import { FollowButton } from "./[username]/follow-button";

const DEFAULT_MESHI = {
  colorTheme: "blue",
  hatStyle: "none",
  faceStyle: "happy",
  hairStyle: "none",
  accessoryStyle: "none",
  eyeStyle: "regular",
  badgeStyle: "none",
  outfitStyle: "none",
};

export async function InstagramProfileView({ username }: { username: string }) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");

  const [profile, posts] = await Promise.all([
    getUserProfile(username),
    getUserPosts(username, 1, 24),
  ]);

  if (!profile) notFound();

  const isOwnProfile = profile.isOwnProfile;
  const canViewProfile = profile.sectionVisibility.profile;
  const website = profile.website?.replace(/^https?:\/\//, "");
  const meshi = profile.meshiPreference ?? DEFAULT_MESHI;
  const connectedAccounts = profile.connectedAccounts ?? [];
  const interests = profile.interests ?? [];
  const accent = profile.accentColor || "var(--accent)";

  return (
    <main className="insta-profile-shell">
      <section className="insta-profile-header">
        <div className="insta-profile-banner" style={{ backgroundColor: accent }}>
          {profile.bannerUrl && (
            <Image src={profile.bannerUrl} alt="" fill sizes="(max-width: 768px) 100vw, 900px" className="object-cover" />
          )}
        </div>

        <div className="insta-profile-main">
          <div className="insta-profile-avatar-stack">
            <span className="insta-story-ring p-[3px]" style={{ background: `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 18%, var(--bg-secondary)))` }}>
              <Avatar src={profile.avatarUrl} alt={profile.displayName} size="xl" className="h-24 w-24 ring-4 ring-[var(--bg-primary)] sm:h-32 sm:w-32" />
            </span>
            <div className="insta-profile-meshi" aria-label={`${profile.displayName}'s Meshi`}>
              <MeshiMascot
                size={54}
                color={meshi.colorTheme as MeshiColor}
                hat={meshi.hatStyle as MeshiHat}
                mood={meshi.faceStyle as MeshiMood}
                hair={meshi.hairStyle as MeshiHair}
                accessory={meshi.accessoryStyle as MeshiAccessory}
                eyeStyle={meshi.eyeStyle as MeshiEyeStyle}
                badge={meshi.badgeStyle as MeshiBadge}
                outfit={meshi.outfitStyle as MeshiOutfit}
                animate
                interactive={isOwnProfile}
                showGlow={false}
                prop={isOwnProfile ? "paintbrush" : "none"}
              />
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="truncate text-xl font-black text-[var(--text-primary)] sm:text-2xl">@{profile.username}</h1>
              {profile.isVerified && <ShieldCheck className="h-5 w-5 shrink-0 text-[var(--accent)]" aria-label="Verified" />}
              {profile.isMeshPro && (
                <span className="insta-profile-privacy-pill inline-flex items-center gap-1">
                  <Crown size={13} aria-hidden="true" />
                  Mesh Pro
                </span>
              )}
              <span className="insta-profile-privacy-pill capitalize">
                {profile.privacyLevel === "friends" ? "friends only" : profile.privacyLevel}
              </span>
              <div className="flex flex-wrap gap-2">
                {isOwnProfile ? (
                  <>
                    <Link href="/settings" className="insta-profile-action">
                      <Settings size={15} aria-hidden="true" />
                      Edit profile
                    </Link>
                    <Link href="/mesh" className="insta-profile-action">View Mesh</Link>
                  </>
                ) : (
                  <>
                    <FollowButton userId={profile.id} isFollowing={profile.isFollowing} />
                    <Link href={`/messages/${profile.id}?new=true`} className="insta-profile-action">
                      <MessageCircle size={15} aria-hidden="true" />
                      Message
                    </Link>
                  </>
                )}
              </div>
            </div>

            {profile.sectionVisibility.stats && (
              <dl className="insta-profile-stats">
                <div>
                  <dt>{formatCount(profile._count.posts)}</dt>
                  <dd>posts</dd>
                </div>
                <div>
                  <dt>{formatCount(profile._count.followers)}</dt>
                  <dd>followers</dd>
                </div>
                <div>
                  <dt>{formatCount(profile._count.following)}</dt>
                  <dd>following</dd>
                </div>
              </dl>
            )}

            <div className="mt-4 grid gap-1 text-sm leading-6">
              <p className="font-black text-[var(--text-primary)]">{profile.displayName}</p>
              {!canViewProfile && (
                <p className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-3 py-1.5 text-xs font-bold text-[var(--text-secondary)]">
                  <EyeOff size={14} aria-hidden="true" />
                  This profile is private.
                </p>
              )}
              {profile.bio && <p className="whitespace-pre-wrap text-[var(--text-secondary)]">{profile.bio}</p>}
              {profile.location && (
                <p className="inline-flex items-center gap-1 text-xs font-bold text-[var(--text-muted)]">
                  <MapPin size={14} aria-hidden="true" />
                  {profile.location}
                </p>
              )}
              {website && (
                <a href={profile.website || "#"} target="_blank" rel="noopener noreferrer" className="inline-flex w-fit items-center gap-1 font-bold text-[var(--accent)]">
                  <LinkIcon size={14} aria-hidden="true" />
                  {website}
                </a>
              )}
              {interests.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {interests.slice(0, 8).map((interest) => (
                    <span key={interest.id} className="insta-profile-chip">
                      <Hash size={13} aria-hidden="true" />
                      {interest.tag}
                    </span>
                  ))}
                </div>
              )}
              {connectedAccounts.length > 0 && (
                <div className="mt-3 grid gap-2">
                  <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--text-muted)]">
                    <PlugZap size={14} aria-hidden="true" />
                    Connected platforms
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {connectedAccounts.map((account) => (
                      <span key={account.id} className="insta-profile-chip capitalize">
                        {account.platform}
                        {account.platformUsername ? ` @${account.platformUsername}` : ""}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {profile.mutualFollowers.length > 0 && (
                <p className="mt-2 inline-flex items-center gap-2 text-xs font-bold text-[var(--text-muted)]">
                  <Sparkles size={14} aria-hidden="true" />
                  Followed by {profile.mutualFollowers.slice(0, 3).map((follower) => follower.displayName).join(", ")}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {canViewProfile && (
        <nav className="insta-profile-tabs" aria-label="Profile views">
          <span className="insta-profile-tab-active">
            <Grid3X3 size={15} aria-hidden="true" />
            Posts
          </span>
        </nav>
      )}

      {!canViewProfile ? (
        <section className="insta-profile-empty">
          <EyeOff className="h-9 w-9 text-[var(--text-muted)]" aria-hidden="true" />
          <h2 className="text-lg font-black text-[var(--text-primary)]">Private profile</h2>
          <p className="text-sm text-[var(--text-secondary)]">Follow each other to unlock shared profile sections.</p>
        </section>
      ) : posts.length > 0 ? (
        <section className="insta-profile-grid" aria-label={`${profile.displayName}'s posts`}>
          {posts.map((post) => {
            const firstMedia = post.media[0];

            return (
              <Link key={post.id} href={`/feed/${post.id}`} className="insta-profile-grid-tile group">
                {firstMedia ? (
                  <Image src={firstMedia.url} alt="" fill sizes="(max-width: 768px) 33vw, 220px" className="object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                ) : (
                  <div className="flex h-full items-center justify-center p-3 text-center text-xs font-bold leading-5 text-[var(--text-secondary)]">
                    {post.content}
                  </div>
                )}
                <span className="insta-profile-grid-overlay">
                  {formatCount(post._count.reactions)} likes
                </span>
              </Link>
            );
          })}
        </section>
      ) : (
        <section className="insta-profile-empty">
          <Grid3X3 className="h-9 w-9 text-[var(--text-muted)]" aria-hidden="true" />
          <h2 className="text-lg font-black text-[var(--text-primary)]">No posts yet</h2>
          <p className="text-sm text-[var(--text-secondary)]">
            {isOwnProfile ? "Share your first post from Home." : `${profile.displayName} has not posted yet.`}
          </p>
          {isOwnProfile && (
            <Link href="/feed?compose=true" className="mesh-action mesh-action-primary mt-2 px-4 text-sm">
              Create post
            </Link>
          )}
        </section>
      )}
    </main>
  );
}
