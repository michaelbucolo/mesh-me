import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  BarChart3,
  Bookmark,
  ExternalLink,
  EyeOff,
  Globe,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Repeat2,
  Settings,
  ShieldCheck,
} from "lucide-react";
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
import { getSavedPostCount, getSavedPosts, getUserCommunities, getUserPosts, getUserProfile } from "@/lib/queries";
import { formatCount, formatRelativeTime } from "@/lib/utils";
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

const PLATFORM_ICONS: Record<string, { icon: string; bg: string }> = {
  github: { icon: "GH", bg: "#24292e" },
  linkedin: { icon: "in", bg: "#0077b5" },
  medium: { icon: "M", bg: "#292929" },
  spotify: { icon: "♫", bg: "#1db954" },
  twitter: { icon: "𝕏", bg: "#1d9bf0" },
  youtube: { icon: "▶", bg: "#ff0000" },
  tiktok: { icon: "♪", bg: "#010101" },
  instagram: { icon: "IG", bg: "#e4405f" },
  discord: { icon: "DC", bg: "#5865f2" },
  twitch: { icon: "Tw", bg: "#9146ff" },
  facebook: { icon: "fb", bg: "#1877f2" },
  snapchat: { icon: "👻", bg: "#fffc00" },
};

function PlatformIcon({ platform }: { platform: string }) {
  const info = PLATFORM_ICONS[platform.toLowerCase()] ?? { icon: platform.charAt(0).toUpperCase(), bg: "var(--mesh-panel-solid)" };
  return (
    <div
      className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white"
      style={{ backgroundColor: info.bg }}
      title={platform}
    >
      {info.icon}
    </div>
  );
}

export async function InstagramProfileView({ username, tab }: { username: string; tab?: string }) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");

  // One parallel batch instead of two dependent rounds — saved posts only
  // apply to your own profile (knowable from the session), and community
  // memberships are fetched alongside but rendered only when the profile's
  // visibility settings allow it.
  const isSelf = currentUser.username.toLowerCase() === username.toLowerCase();
  const [profile, posts, allMemberships, [savedPosts, savedPostCount]] = await Promise.all([
    getUserProfile(username),
    getUserPosts(username, 1, 24),
    getUserCommunities(username),
    isSelf
      ? Promise.all([getSavedPosts(1, 24), getSavedPostCount()])
      : Promise.resolve<[Awaited<ReturnType<typeof getSavedPosts>>, number]>([[], 0]),
  ]);

  if (!profile) notFound();

  const isOwnProfile = profile.isOwnProfile;
  const canViewProfile = profile.sectionVisibility.profile;
  const memberships = canViewProfile ? allMemberships : [];
  const meshi = profile.meshiPreference ?? DEFAULT_MESHI;
  const connectedAccounts = profile.connectedAccounts ?? [];
  const links = profile.links ?? [];
  const postCount = profile._count.posts;
  const communityCount = memberships.length;
  const collectionCount = savedPostCount;
  const basePath = isOwnProfile ? "/profile" : `/profile/${username}`;
  const tabs = ["posts", "communities", ...(isOwnProfile ? ["collections"] : []), "links"];
  const activeTab = tabs.includes(tab ?? "") ? (tab as string) : "posts";

  return (
    <div className="profile-layout mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_340px] animate-page-enter">
      {/* Main column */}
      <div className="min-w-0 space-y-6">
        {/* Profile header */}
        <section className="profile-header-card rounded-2xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] overflow-hidden">
          {/* Banner */}
          <div className="profile-banner relative h-36 sm:h-44 bg-gradient-to-br from-[var(--mesh-bg-deep)] via-[#0a1628] to-[var(--mesh-bg)]">
            {profile.bannerUrl ? (
              <Image src={profile.bannerUrl} alt="" fill sizes="(max-width: 768px) 100vw, 900px" className="object-cover opacity-80" />
            ) : (
              <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
                {/* A quiet slice of their mesh: woven strands + constellation nodes */}
                <div className="absolute -top-8 -right-8 h-40 w-40 rounded-full bg-[var(--mesh-blue)] opacity-[0.07] blur-2xl" />
                <div className="absolute -bottom-12 -left-12 h-56 w-56 rounded-full bg-[var(--mesh-cyan)] opacity-[0.05] blur-3xl" />
                <svg className="absolute inset-0 h-full w-full opacity-[0.35]" preserveAspectRatio="none" viewBox="0 0 100 40">
                  <path d="M8 30 Q 30 12 52 22 T 96 14" fill="none" stroke="var(--mesh-blue)" strokeWidth="0.18" opacity="0.6" />
                  <path d="M2 12 Q 26 26 54 12 T 98 26" fill="none" stroke="var(--mesh-cyan)" strokeWidth="0.14" opacity="0.5" />
                  <path d="M12 36 Q 40 30 62 33 T 94 30" fill="none" stroke="var(--mesh-blue)" strokeWidth="0.12" opacity="0.4" />
                  <circle cx="30" cy="17" r="0.7" fill="var(--mesh-blue)" opacity="0.9" />
                  <circle cx="52" cy="22" r="0.9" fill="var(--mesh-cyan)" opacity="0.8" />
                  <circle cx="78" cy="17" r="0.6" fill="var(--mesh-blue)" opacity="0.7" />
                  <circle cx="16" cy="28" r="0.5" fill="var(--mesh-cyan)" opacity="0.6" />
                  <circle cx="88" cy="28" r="0.75" fill="var(--mesh-blue)" opacity="0.8" />
                </svg>
              </div>
            )}
            {/* View Public Mesh button */}
            <div className="absolute top-4 right-4">
              <Link
                href={`/mesh?user=${username}`}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--mesh-border)] bg-[var(--mesh-bg)]/80 px-4 py-2 text-sm font-medium text-[var(--mesh-text)] backdrop-blur-sm transition-colors hover:bg-[var(--mesh-panel-hover)]"
              >
                View Public Mesh
              </Link>
            </div>
          </div>

          {/* Profile info */}
          <div className="profile-info relative px-6 pb-6">
            {/* Avatar — ringed like a node on the mesh */}
            <div className="-mt-16 mb-4 flex items-end gap-6">
              <div className="shrink-0 rounded-full bg-gradient-to-tr from-[var(--mesh-blue)] via-[#58bfff] to-[var(--mesh-cyan)] p-[3px] shadow-[0_0_40px_rgba(47,124,255,0.25)]">
                <Avatar
                  src={profile.avatarUrl}
                  alt={profile.displayName}
                  size="xl"
                  className="profile-avatar h-28 w-28 rounded-full border-4 border-[var(--mesh-bg-elevated)] sm:h-32 sm:w-32"
                />
              </div>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                {/* Name row */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="profile-name text-2xl font-bold text-[var(--mesh-text)]">{profile.displayName}</h1>
                  {profile.isVerified && (
                    <ShieldCheck className="h-5 w-5 shrink-0 text-[var(--mesh-blue)]" aria-label="Verified" />
                  )}
                  {!isOwnProfile && !profile.isPublic && (
                    <span className="inline-flex items-center rounded-lg bg-amber-500/10 px-2.5 py-0.5 text-xs font-bold text-amber-400">
                      Private by default
                    </span>
                  )}
                </div>

                {/* Username */}
                <p className="mt-1 text-sm text-[var(--mesh-text-muted)]">@{profile.username}</p>

                {/* Stats — the numbers people actually look for, front and center */}
                {profile.sectionVisibility.stats && (
                  <div className="mt-3 flex items-center gap-6">
                    <span className="text-sm text-[var(--mesh-text-secondary)]">
                      <span className="font-bold text-[var(--mesh-text)]">{profile._count.posts}</span> posts
                    </span>
                    <span className="text-sm text-[var(--mesh-text-secondary)]">
                      <span className="font-bold text-[var(--mesh-text)]">{profile._count.followers}</span> followers
                    </span>
                    <span className="text-sm text-[var(--mesh-text-secondary)]">
                      <span className="font-bold text-[var(--mesh-text)]">{profile._count.following}</span> following
                    </span>
                  </div>
                )}

                {/* Bio */}
                {profile.bio && (
                  <p className="mt-3 max-w-lg text-sm leading-relaxed text-[var(--mesh-text-secondary)]">{profile.bio}</p>
                )}

                {!canViewProfile && (
                  <p className="mt-3 inline-flex items-center gap-2 rounded-xl border border-[var(--mesh-border)] bg-[var(--mesh-panel)] px-3 py-2 text-xs font-medium text-[var(--mesh-text-muted)]">
                    <EyeOff size={14} aria-hidden="true" />
                    This profile is private.
                  </p>
                )}
              </div>

              {/* Connected Platforms */}
              {connectedAccounts.length > 0 && (
                <div className="shrink-0">
                  <p className="mb-2 text-xs font-medium text-[var(--mesh-text-muted)]">Connected Platforms</p>
                  <div className="flex items-center gap-2">
                    {connectedAccounts.slice(0, 4).map((account) => (
                      <PlatformIcon key={account.id} platform={account.platform} />
                    ))}
                    {connectedAccounts.length > 4 && (
                      <Link
                        href="/connected-accounts"
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--mesh-border)] bg-[var(--mesh-panel)] text-xs font-bold text-[var(--mesh-text-muted)]"
                      >
                        +{connectedAccounts.length - 4}
                      </Link>
                    )}
                    <Link href="/connected-accounts" className="text-xs text-[var(--mesh-text-muted)] hover:text-[var(--mesh-text-secondary)] transition-colors ml-1">
                      View all
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Meshi card + Actions */}
            <div className="profile-actions mt-5 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-3 rounded-xl border border-[var(--mesh-border)] bg-[var(--mesh-panel)] px-4 py-2.5">
                <MeshiMascot
                  size={40}
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
                />
                <div>
                  <p className="text-sm font-bold text-[var(--mesh-text)]">
                    {isOwnProfile ? "Your Meshi" : `${profile.displayName.split(" ")[0]}'s Meshi`}
                  </p>
                  <p className="text-xs text-[var(--mesh-text-muted)]">
                    {isOwnProfile ? "How the mesh sees you" : "How they roam the mesh"}
                  </p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--mesh-green)]" />
                    <span className="text-[10px] text-[var(--mesh-green)]">Online</span>
                  </div>
                </div>
              </div>

              {isOwnProfile ? (
                <>
                  <Link
                    href="/analytics"
                    className="inline-flex items-center gap-2 rounded-xl bg-[var(--mesh-blue)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_4px_18px_rgba(47,124,255,0.3)] transition hover:brightness-110"
                  >
                    <BarChart3 size={16} aria-hidden="true" />
                    Analytics
                  </Link>
                  <Link
                    href="/settings"
                    className="inline-flex items-center gap-2 rounded-xl border border-[var(--mesh-border)] bg-[var(--mesh-panel)] px-4 py-2.5 text-sm font-medium text-[var(--mesh-text)] transition-colors hover:bg-[var(--mesh-panel-hover)]"
                  >
                    <Settings size={16} aria-hidden="true" />
                    Settings
                  </Link>
                </>
              ) : (
                <>
                  <FollowButton userId={profile.id} isFollowing={profile.isFollowing} />
                  <Link
                    href={`/messages/${profile.id}?new=true`}
                    className="inline-flex items-center gap-2 rounded-xl border border-[var(--mesh-border)] bg-[var(--mesh-panel)] px-4 py-2.5 text-sm font-medium text-[var(--mesh-text)] transition-colors hover:bg-[var(--mesh-panel-hover)]"
                  >
                    <MessageCircle size={16} aria-hidden="true" />
                    Message
                  </Link>
                </>
              )}

              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--mesh-border)] bg-[var(--mesh-panel)] text-[var(--mesh-text-muted)] transition-colors hover:bg-[var(--mesh-panel-hover)]"
                aria-label="More options"
              >
                <MoreHorizontal size={16} />
              </button>
            </div>
          </div>
        </section>

        {/* Tabs */}
        {canViewProfile && (
          <nav className="profile-tabs-nav flex items-center gap-1 overflow-x-auto border-b border-[var(--mesh-border)] px-1" aria-label="Profile sections">
            <ProfileTab label="Posts" count={postCount} href={basePath} active={activeTab === "posts"} />
            <ProfileTab label="Communities" count={communityCount} href={`${basePath}?tab=communities`} active={activeTab === "communities"} />
            {isOwnProfile && (
              <ProfileTab label="Collections" count={collectionCount} href={`${basePath}?tab=collections`} active={activeTab === "collections"} />
            )}
            <ProfileTab label="Creator Links" count={links.length} href={`${basePath}?tab=links`} active={activeTab === "links"} />
          </nav>
        )}

        {/* Active section */}
        {canViewProfile && activeTab === "communities" && (
          <div className="space-y-3">
            {memberships.length > 0 ? (
              memberships.map((m) => (
                <Link
                  key={m.community.id}
                  href={`/communities/${m.community.slug}`}
                  className="flex items-center justify-between rounded-2xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] px-5 py-4 transition-colors hover:border-[var(--mesh-border-active)]"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[var(--mesh-text)]">{m.community.name}</p>
                    <p className="mt-0.5 text-xs text-[var(--mesh-text-muted)]">
                      {formatCount(m.community._count.members)} members · {formatCount(m.community._count.posts)} posts
                    </p>
                  </div>
                  <span className="shrink-0 rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-400">
                    {m.role === "admin" ? "Admin" : m.role === "moderator" ? "Moderator" : "Joined"}
                  </span>
                </Link>
              ))
            ) : (
              <section className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] px-6 py-12 text-center">
                <h2 className="text-lg font-bold text-[var(--mesh-text)]">No communities yet</h2>
                <p className="text-sm text-[var(--mesh-text-secondary)]">
                  {isOwnProfile ? "Join communities to see them here." : `${profile.displayName} hasn't joined any communities.`}
                </p>
                {isOwnProfile && (
                  <Link href="/communities" className="mt-2 rounded-xl bg-[var(--mesh-blue)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--mesh-blue)]/90">
                    Browse communities
                  </Link>
                )}
              </section>
            )}
          </div>
        )}

        {canViewProfile && activeTab === "collections" && isOwnProfile && (
          <div className="space-y-4">
            {savedPosts.length > 0 ? (
              savedPosts.map((post) => (
                <Link
                  key={post.id}
                  href={`/feed/${post.id}`}
                  className="block rounded-2xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] p-5 transition-colors hover:border-[var(--mesh-border-active)]"
                >
                  <div className="flex items-start gap-3">
                    <Avatar src={post.author.avatarUrl} alt={post.author.displayName} size="md" className="h-10 w-10 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-[var(--mesh-text)]">{post.author.displayName}</span>
                        <span className="text-xs text-[var(--mesh-text-muted)]">@{post.author.username}</span>
                        <span className="text-xs text-[var(--mesh-text-muted)]">·</span>
                        <span className="text-xs text-[var(--mesh-text-muted)]">{formatRelativeTime(post.createdAt)}</span>
                      </div>
                      {post.content && <p className="mt-2 text-sm leading-relaxed text-[var(--mesh-text)]">{post.content}</p>}
                      <div className="mt-3 flex items-center gap-5 text-xs text-[var(--mesh-text-muted)]">
                        <span className="flex items-center gap-1.5"><Heart size={14} /> {formatCount(post._count.reactions)}</span>
                        <span className="flex items-center gap-1.5"><MessageCircle size={14} /> {formatCount(post._count.comments)}</span>
                        <span className="ml-auto flex items-center gap-1.5 text-[var(--mesh-blue)]"><Bookmark size={14} /> Saved</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <section className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] px-6 py-12 text-center">
                <h2 className="text-lg font-bold text-[var(--mesh-text)]">No saved posts yet</h2>
                <p className="text-sm text-[var(--mesh-text-secondary)]">Bookmark posts in the Flow to collect them here.</p>
              </section>
            )}
          </div>
        )}

        {canViewProfile && activeTab === "links" && (
          <div className="space-y-3">
            {links.length > 0 ? (
              links.map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-2xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] px-5 py-4 transition-colors hover:border-[var(--mesh-border-active)]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Globe size={16} className="shrink-0 text-[var(--mesh-text-muted)]" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--mesh-text)]">{link.label || link.url.replace(/^https?:\/\//, "")}</p>
                      <p className="truncate text-xs text-[var(--mesh-text-muted)]">{link.url}</p>
                    </div>
                  </div>
                  <ExternalLink size={14} className="shrink-0 text-[var(--mesh-text-muted)]" />
                </a>
              ))
            ) : (
              <section className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] px-6 py-12 text-center">
                <h2 className="text-lg font-bold text-[var(--mesh-text)]">No creator links yet</h2>
                <p className="text-sm text-[var(--mesh-text-secondary)]">
                  {isOwnProfile ? "Add links to your channels from Settings." : `${profile.displayName} hasn't added any links.`}
                </p>
              </section>
            )}
          </div>
        )}

        {/* Posts list */}
        {activeTab !== "posts" && canViewProfile ? null : !canViewProfile ? (
          <section className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] px-6 py-12 text-center">
            <EyeOff className="h-10 w-10 text-[var(--mesh-text-muted)]" aria-hidden="true" />
            <h2 className="text-lg font-bold text-[var(--mesh-text)]">Private profile</h2>
            <p className="text-sm text-[var(--mesh-text-secondary)]">Follow each other to unlock shared profile sections.</p>
          </section>
        ) : posts.length > 0 ? (
          <div className="space-y-4">
            {posts.map((post) => (
              <article key={post.id} className="rounded-2xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] p-5 transition-colors hover:border-[var(--mesh-border-active)]">
                <div className="flex items-start gap-3">
                  <Avatar src={profile.avatarUrl} alt={profile.displayName} size="md" className="h-10 w-10 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[var(--mesh-text)]">{profile.displayName}</span>
                      {profile.isVerified && <ShieldCheck className="h-3.5 w-3.5 text-[var(--mesh-blue)]" />}
                      <span className="text-xs text-[var(--mesh-text-muted)]">@{profile.username}</span>
                      <span className="text-xs text-[var(--mesh-text-muted)]">·</span>
                      <span className="text-xs text-[var(--mesh-text-muted)]">{formatRelativeTime(post.createdAt)}</span>
                      <button type="button" className="ml-auto text-[var(--mesh-text-muted)] hover:text-[var(--mesh-text-secondary)]" aria-label="More">
                        <MoreHorizontal size={16} />
                      </button>
                    </div>

                    {post.content && (
                      <p className="mt-2 text-sm leading-relaxed text-[var(--mesh-text)]">{post.content}</p>
                    )}

                    {post.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {post.tags.map((tag) => (
                          <span key={tag.id} className="rounded-md bg-[var(--mesh-blue)]/10 px-2 py-0.5 text-xs font-medium text-[var(--mesh-blue)]">
                            #{tag.tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {post.media.length > 0 && post.media[0] && (
                      <div className="mt-3 overflow-hidden rounded-xl">
                        <Image
                          src={post.media[0].url}
                          alt=""
                          width={600}
                          height={400}
                          className="w-full object-cover"
                        />
                      </div>
                    )}

                    <div className="mt-3 flex items-center gap-5">
                      <button type="button" className="flex items-center gap-1.5 text-xs text-[var(--mesh-text-muted)] hover:text-[var(--mesh-danger)] transition-colors">
                        <Heart size={15} />
                        <span>{formatCount(post._count.reactions)}</span>
                      </button>
                      <Link href={`/feed/${post.id}`} className="flex items-center gap-1.5 text-xs text-[var(--mesh-text-muted)] hover:text-[var(--mesh-blue)] transition-colors">
                        <MessageCircle size={15} />
                        <span>{formatCount(post._count.comments)}</span>
                      </Link>
                      <button type="button" className="flex items-center gap-1.5 text-xs text-[var(--mesh-text-muted)] hover:text-[var(--mesh-green)] transition-colors">
                        <Repeat2 size={15} />
                        <span>{formatCount(post._count.reposts)}</span>
                      </button>
                      <button type="button" className="ml-auto text-[var(--mesh-text-muted)] hover:text-[var(--mesh-blue)] transition-colors">
                        <Bookmark size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <section className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] px-6 py-12 text-center">
            <h2 className="text-lg font-bold text-[var(--mesh-text)]">No posts yet</h2>
            <p className="text-sm text-[var(--mesh-text-secondary)]">
              {isOwnProfile ? "Share your first post from Home." : `${profile.displayName} has not posted yet.`}
            </p>
            {isOwnProfile && (
              <Link href="/feed?compose=true" className="mt-2 rounded-xl bg-[var(--mesh-blue)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--mesh-blue)]/90">
                Create post
              </Link>
            )}
          </section>
        )}
      </div>

      {/* Right sidebar */}
      <aside className="hidden space-y-5 lg:block">
        {/* Communities */}
        <section className="rounded-2xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-[var(--mesh-text)]">Communities</h3>
            <Link href="/communities" className="text-xs font-medium text-[var(--mesh-blue)] hover:underline">View all</Link>
          </div>
          <div className="space-y-3">
            {communityCount > 0 ? (
              memberships.slice(0, 3).map((m) => (
                <Link key={m.community.id} href={`/communities/${m.community.slug}`} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[var(--mesh-text)]">{m.community.name}</p>
                    <p className="text-xs text-[var(--mesh-text-muted)]">{formatCount(m.community._count.members)} members</p>
                  </div>
                  <span className="shrink-0 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">Joined</span>
                </Link>
              ))
            ) : (
              <p className="text-xs text-[var(--mesh-text-muted)]">
                {isOwnProfile ? "Join communities to see them here." : "No communities yet."}
              </p>
            )}
          </div>
        </section>

        {/* Collections */}
        {isOwnProfile && (
        <section className="rounded-2xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-[var(--mesh-text)]">Collections</h3>
            <Link href="/vault" className="text-xs font-medium text-[var(--mesh-blue)] hover:underline">View all</Link>
          </div>
          <div className="space-y-3">
            {collectionCount > 0 ? (
              savedPosts.slice(0, 3).map((post) => (
                <Link key={post.id} href={`/feed/${post.id}`} className="block text-sm">
                  <p className="truncate font-medium text-[var(--mesh-text)]">{post.content || "Saved post"}</p>
                  <p className="text-xs text-[var(--mesh-text-muted)]">by @{post.author.username}</p>
                </Link>
              ))
            ) : (
              <p className="text-xs text-[var(--mesh-text-muted)]">
                {isOwnProfile ? "Save posts to collections to see them here." : "No collections yet."}
              </p>
            )}
          </div>
        </section>
        )}

        {/* Creator Links */}
        {links.length > 0 && (
          <section className="rounded-2xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[var(--mesh-text)]">Creator Links</h3>
              <span className="text-xs text-[var(--mesh-text-muted)]">View all</span>
            </div>
            <div className="space-y-2.5">
              {links.map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm text-[var(--mesh-text-secondary)] transition-colors hover:bg-[var(--mesh-panel)]"
                >
                  <div className="flex items-center gap-2.5">
                    <Globe size={14} className="text-[var(--mesh-text-muted)]" />
                    <span>{link.label || link.url.replace(/^https?:\/\//, "")}</span>
                  </div>
                  <ExternalLink size={12} className="text-[var(--mesh-text-muted)]" />
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Connected platform links for sidebar */}
        {connectedAccounts.length > 0 && (
          <section className="rounded-2xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] p-5">
            <h3 className="mb-4 text-sm font-bold text-[var(--mesh-text)]">Platform Links</h3>
            <div className="space-y-2.5">
              {connectedAccounts.map((account) => (
                <div key={account.id} className="flex items-center gap-3 text-sm">
                  <PlatformIcon platform={account.platform} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-[var(--mesh-text)] capitalize">{account.platform}</p>
                    {account.platformUsername && (
                      <p className="truncate text-xs text-[var(--mesh-text-muted)]">@{account.platformUsername}</p>
                    )}
                  </div>
                  <span className="text-xs text-[var(--mesh-green)]">Connected</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </aside>
    </div>
  );
}

function ProfileTab({ label, count, href, active = false }: { label: string; count: number; href: string; active?: boolean }) {
  return (
    <Link
      href={href}
      className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
        active
          ? "border-[var(--mesh-blue)] text-[var(--mesh-text)]"
          : "border-transparent text-[var(--mesh-text-muted)] hover:text-[var(--mesh-text-secondary)]"
      }`}
    >
      {label}
      <span className={`rounded-md px-1.5 py-0.5 text-xs ${active ? "bg-[var(--mesh-blue)]/10 text-[var(--mesh-blue)]" : "bg-[var(--mesh-panel)] text-[var(--mesh-text-muted)]"}`}>
        {count}
      </span>
    </Link>
  );
}

