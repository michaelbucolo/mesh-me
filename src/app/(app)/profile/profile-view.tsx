import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  Ban,
  BarChart3,
  Bookmark,
  ExternalLink,
  EyeOff,
  Globe,
  Heart,
  Link as LinkIcon,
  MessageCircle,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { linkDisplayHost } from "@/lib/profile-links";
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
import { PostCard } from "@/components/feed/post-card";
import { getCurrentUser } from "@/lib/auth";
import { isUserLiveNow } from "@/lib/mesh-presence-store";
import { getSavedFlowItems, getSavedPostCount, getSavedPosts, getUserCommunities, getUserPosts, getUserProfile } from "@/lib/queries";
import { formatCount, formatLastActive, formatRelativeTime, safeHref } from "@/lib/utils";
import { FollowButton } from "./[username]/follow-button";
import { BlockUserButton } from "@/components/privacy/block-controls";
import { ProfileAboutEditor } from "./[username]/profile-about-editor";
import { ProfileLinksEditor } from "./[username]/profile-links-editor";
import { Button } from "@/components/ui/button";
import { ABOUT_FIELDS, ABOUT_FIELD_META, ABOUT_GROUPS, type AboutField } from "@/lib/profile-info";
import { PlatformLogo } from "@/components/platform/platform-logo";
import { platformProfileUrl } from "@/lib/platform-links";
import { getDisplayNameForAnyPlatform } from "@/lib/platform-capabilities";

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

function PlatformIcon({ platform }: { platform: string }) {
  return <PlatformLogo platform={platform} size={36} className="rounded-full" />;
}

export async function InstagramProfileView({ username, tab }: { username: string; tab?: string }) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");

  // One parallel batch instead of two dependent rounds — saved posts only
  // apply to your own profile (knowable from the session), and community
  // memberships are fetched alongside but rendered only when the profile's
  // visibility settings allow it.
  const isSelf = currentUser.username.toLowerCase() === username.toLowerCase();
  // Real presence — the same live signal that animates Meshi on the mesh and
  // "Active now" in MeChat, not a decorative badge. It needs the profile's id,
  // so it chains off the profile promise but overlaps with the other queries.
  const profilePromise = getUserProfile(username);
  const [profile, posts, allMemberships, [savedPosts, savedPostCount], savedFlowItems, isLiveNow] = await Promise.all([
    profilePromise,
    getUserPosts(username, 1, 24),
    getUserCommunities(username),
    isSelf
      ? Promise.all([getSavedPosts(1, 24), getSavedPostCount()])
      : Promise.resolve<[Awaited<ReturnType<typeof getSavedPosts>>, number]>([[], 0]),
    isSelf ? getSavedFlowItems(48) : Promise.resolve<Awaited<ReturnType<typeof getSavedFlowItems>>>([]),
    profilePromise.then((p) => (p ? isUserLiveNow(p.id) : false)),
  ]);

  if (!profile) notFound();

  const isOwnProfile = profile.isOwnProfile;
  const canViewProfile = profile.sectionVisibility.profile;
  const memberships = profile.sectionVisibility.communities ? allMemberships : [];
  const meshi = profile.meshiPreference ?? DEFAULT_MESHI;
  const connectedAccounts = profile.connectedAccounts ?? [];
  const links = profile.links ?? [];
  const postCount = profile._count.posts;
  const communityCount = memberships.length;
  const collectionCount = savedPostCount + savedFlowItems.length;

  // Live-now is presence data, so it obeys the same gate as the last-online
  // timestamp: a profile the viewer can't open — private, or either side of a
  // block — must not pulse "Active now" at them. profile.lastSeenAt is already
  // nulled server-side under the same conditions, so the label self-hides.
  const showLive = isLiveNow && canViewProfile;
  const presenceLabel = showLive
    ? "Active now"
    : profile.lastSeenAt
      ? formatLastActive(profile.lastSeenAt)
      : null;
  const basePath = isOwnProfile ? "/profile" : `/profile/${username}`;
  // Analytics is a primary tab at /analytics now, not a profile tab — the
  // header's Analytics button below links there.
  const tabs = ["posts", "about", "communities", ...(isOwnProfile ? ["collections"] : []), "links"];
  const activeTab = tabs.includes(tab ?? "") ? (tab as string) : "posts";

  return (
    <div className="profile-layout mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_340px] animate-page-enter">
      {/* Main column */}
      <div className="min-w-0 space-y-6">
        {/* Profile header */}
        <section className="profile-header-card rounded-2xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] overflow-hidden">
          {/* Banner */}
          <div className="profile-banner relative h-36 sm:h-44 bg-gradient-to-br from-[var(--mesh-bg-deep)] via-[var(--mesh-bg-elevated)] to-[var(--mesh-bg)]">
            {profile.bannerUrl ? (
              <Image src={profile.bannerUrl} alt={profile.bio?.trim() || `${profile.displayName}'s profile banner`} fill sizes="(max-width: 768px) 100vw, 900px" className="object-cover opacity-80" />
            ) : (
              <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
                {/* A quiet slice of their mesh: woven strands + constellation nodes */}
                <div className="absolute -top-8 -right-8 h-40 w-40 rounded-full bg-[var(--accent)] opacity-[0.07] blur-2xl" />
                <div className="absolute -bottom-12 -left-12 h-56 w-56 rounded-full bg-[var(--mesh-cyan)] opacity-[0.05] blur-3xl" />
                <svg className="absolute inset-0 h-full w-full opacity-[0.35]" preserveAspectRatio="none" viewBox="0 0 100 40">
                  <path d="M8 30 Q 30 12 52 22 T 96 14" fill="none" stroke="var(--accent)" strokeWidth="0.18" opacity="0.6" />
                  <path d="M2 12 Q 26 26 54 12 T 98 26" fill="none" stroke="var(--mesh-cyan)" strokeWidth="0.14" opacity="0.5" />
                  <path d="M12 36 Q 40 30 62 33 T 94 30" fill="none" stroke="var(--accent)" strokeWidth="0.12" opacity="0.4" />
                  <circle cx="30" cy="17" r="0.7" fill="var(--accent)" opacity="0.9" />
                  <circle cx="52" cy="22" r="0.9" fill="var(--mesh-cyan)" opacity="0.8" />
                  <circle cx="78" cy="17" r="0.6" fill="var(--accent)" opacity="0.7" />
                  <circle cx="16" cy="28" r="0.5" fill="var(--mesh-cyan)" opacity="0.6" />
                  <circle cx="88" cy="28" r="0.75" fill="var(--accent)" opacity="0.8" />
                </svg>
              </div>
            )}
            {/* View Public Mesh button */}
            <div className="absolute top-4 right-4">
              <Link
                href={`/mesh?user=${username}`}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--mesh-border)] bg-[var(--mesh-bg)]/80 px-4 text-sm font-medium text-[var(--mesh-text)] backdrop-blur-sm transition-colors hover:bg-[var(--mesh-panel-hover)]"
              >
                View Public Mesh
              </Link>
            </div>
          </div>

          {/* Profile info */}
          <div className="profile-info relative px-6 pb-6">
            {/* Avatar — ringed like a node on the mesh */}
            <div className="-mt-16 mb-4 flex items-end gap-6">
              <div className="shrink-0 rounded-full bg-gradient-to-tr from-[var(--accent)] via-[color-mix(in_srgb,var(--accent)_50%,#ffffff)] to-[var(--mesh-cyan)] p-[3px] shadow-[0_0_40px_color-mix(in_srgb,var(--accent)_25%,transparent)]">
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
                  <h1 className="profile-name text-2xl font-semibold text-[var(--mesh-text)]">{profile.displayName}</h1>
                  {profile.isVerified && (
                    <ShieldCheck className="h-5 w-5 shrink-0 text-[var(--accent-text)]" aria-label="Verified" />
                  )}
                  {!isOwnProfile && !profile.isPublic && (
                    <span className="inline-flex items-center rounded-lg bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-[var(--warning)]">
                      Private by default
                    </span>
                  )}
                </div>

                {/* Username */}
                <p className="mt-1 text-sm text-[var(--mesh-text-muted)]">@{profile.username}</p>

                {/* Presence — privacy-gated last-online / live status. Self-hides
                    for hidden-activity or non-visible profiles (presenceLabel null). */}
                {!isOwnProfile && presenceLabel && (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${showLive ? "bg-[var(--mesh-green)] motion-safe:animate-pulse" : "bg-[var(--mesh-text-muted)]/50"}`} />
                    <span className={`text-xs ${showLive ? "text-[var(--mesh-green)]" : "text-[var(--mesh-text-muted)]"}`}>
                      {presenceLabel}
                    </span>
                  </div>
                )}

                {/* Stats — the numbers people actually look for, front and center.
                    Followers/Following open the connections list when the viewer
                    is allowed to see who this person connects with. */}
                {profile.sectionVisibility.stats && (
                  <div className="mt-3 flex items-center gap-6">
                    <span className="text-sm text-[var(--mesh-text-secondary)]">
                      <span className="font-semibold text-[var(--mesh-text)]">{profile._count.posts}</span> posts
                    </span>
                    {profile.sectionVisibility.people ? (
                      <>
                        {/* min-h-11 with -my-3: a 44px touch target without
                            adding a pixel to the row's visual height. */}
                        <Link href={`/profile/${profile.username}/connections?tab=followers`} className="-my-3 inline-flex min-h-11 items-center text-sm text-[var(--mesh-text-secondary)] transition-colors hover:text-[var(--mesh-text)]">
                          <span className="font-semibold text-[var(--mesh-text)]">{profile._count.followers}</span>&nbsp;followers
                        </Link>
                        <Link href={`/profile/${profile.username}/connections?tab=following`} className="-my-3 inline-flex min-h-11 items-center text-sm text-[var(--mesh-text-secondary)] transition-colors hover:text-[var(--mesh-text)]">
                          <span className="font-semibold text-[var(--mesh-text)]">{profile._count.following}</span>&nbsp;following
                        </Link>
                      </>
                    ) : (
                      <>
                        <span className="text-sm text-[var(--mesh-text-secondary)]">
                          <span className="font-semibold text-[var(--mesh-text)]">{profile._count.followers}</span> followers
                        </span>
                        <span className="text-sm text-[var(--mesh-text-secondary)]">
                          <span className="font-semibold text-[var(--mesh-text)]">{profile._count.following}</span> following
                        </span>
                      </>
                    )}
                  </div>
                )}

                {/* Bio */}
                {profile.bio && (
                  <p className="mt-3 max-w-lg text-sm leading-relaxed text-[var(--mesh-text-secondary)]">{profile.bio}</p>
                )}

                {/* Links in bio. `UserLink` has been in the schema since the
                    beginning with nothing reading or writing it; this is the
                    first surface to render it. The href has been through
                    safeLinkHref on the way out of the query, and the host is
                    shown next to the label so a viewer can see where a link
                    actually goes before pressing it — a label is chosen by the
                    profile owner and can say anything. `nofollow` because these
                    are user-submitted, `noopener noreferrer` because they open
                    in a new tab. */}
                {profile.links.length > 0 && (
                  <ul className="mt-3 flex max-w-lg flex-wrap gap-2">
                    {profile.links.map((link) => (
                      <li key={link.id}>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="ds-focus-ring group inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-md border border-[var(--rule)] bg-[var(--paper-1)] px-2.5 text-sm text-[var(--text-primary)] transition-colors hover:border-[var(--rule-strong)] hover:bg-[var(--paper-hover)]"
                        >
                          <LinkIcon size={13} aria-hidden="true" className="shrink-0 text-[var(--text-tertiary)]" />
                          <span className="truncate font-medium">{link.label}</span>
                          <span className="truncate text-micro text-[var(--text-tertiary)]">
                            {linkDisplayHost(link.url)}
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
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
                    {connectedAccounts.slice(0, 4).map((account) => {
                      // Deep-link the badge out to their real profile on that
                      // platform, turning the row into a true link-in-bio hub.
                      const url = platformProfileUrl(account.platform, account.platformUsername);
                      return url ? (
                        <a
                          key={account.id}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          title={`${account.platform}${account.platformUsername ? ` @${account.platformUsername}` : ""}`}
                          className="ds-focus-ring rounded-full transition-transform hover:scale-110"
                        >
                          <PlatformIcon platform={account.platform} />
                        </a>
                      ) : (
                        <PlatformIcon key={account.id} platform={account.platform} />
                      );
                    })}
                    {connectedAccounts.length > 4 && (
                      <Link
                        href="/connected-accounts"
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--mesh-border)] bg-[var(--mesh-panel)] text-xs font-semibold text-[var(--mesh-text-muted)]"
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
                  <p className="text-sm font-semibold text-[var(--mesh-text)]">
                    {isOwnProfile ? "Your Meshi" : `${profile.displayName.split(" ")[0]}'s Meshi`}
                  </p>
                  <p className="text-xs text-[var(--mesh-text-muted)]">
                    {isOwnProfile ? "How the mesh sees you" : "How they roam the mesh"}
                  </p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${showLive ? "bg-[var(--mesh-green)] motion-safe:animate-pulse" : "bg-[var(--mesh-text-muted)]/50"}`} />
                    <span className={`text-micro ${showLive ? "text-[var(--mesh-green)]" : "text-[var(--mesh-text-muted)]"}`}>
                      {presenceLabel ?? "Away"}
                    </span>
                  </div>
                </div>
              </div>

              {isOwnProfile ? (
                <>
                  <Button asChild>
                    <Link href="/analytics">
                      <BarChart3 size={16} aria-hidden="true" />
                      Analytics
                    </Link>
                  </Button>
                  <Button asChild variant="secondary">
                    <Link href="/settings">
                      <Settings size={16} aria-hidden="true" />
                      Settings
                    </Link>
                  </Button>
                </>
              ) : profile.viewerHasBlocked ? (
                // Blocking severs follow and messaging entirely, so those
                // actions would only be rejected by the server — Unblock is the
                // one thing left to offer.
                <BlockUserButton userId={profile.id} username={profile.username} isBlocked />
              ) : (
                <>
                  <FollowButton userId={profile.id} isFollowing={profile.isFollowing} />
                  <Button asChild variant="secondary">
                    <Link href={`/messages/${profile.id}?new=true`}>
                      <MessageCircle size={16} aria-hidden="true" />
                      Message
                    </Link>
                  </Button>
                  <BlockUserButton userId={profile.id} username={profile.username} isBlocked={false} />
                </>
              )}

            </div>
          </div>
        </section>

        {/* Tabs */}
        {canViewProfile && (
          <nav className="profile-tabs-nav flex items-center gap-1 overflow-x-auto border-b border-[var(--mesh-border)] px-1" aria-label="Profile sections">
            <ProfileTab label="Posts" count={postCount} href={basePath} active={activeTab === "posts"} />
            <ProfileTab label="About" href={`${basePath}?tab=about`} active={activeTab === "about"} />
            <ProfileTab label="Communities" count={communityCount} href={`${basePath}?tab=communities`} active={activeTab === "communities"} />
            {isOwnProfile && (
              <ProfileTab label="Collections" count={collectionCount} href={`${basePath}?tab=collections`} active={activeTab === "collections"} />
            )}
            <ProfileTab label="Creator Links" count={links.length} href={`${basePath}?tab=links`} active={activeTab === "links"} />
          </nav>
        )}

        {/* Active section */}
        {canViewProfile && activeTab === "about" && (
          isOwnProfile && profile.aboutEditable ? (
            <ProfileAboutEditor initial={profile.aboutEditable} />
          ) : profile.about ? (
            <AboutReadOnly about={profile.about} />
          ) : (
            <section className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] px-6 py-12 text-center">
              <h2 className="text-lg font-semibold text-[var(--mesh-text)]">No details yet</h2>
              <p className="text-sm text-[var(--mesh-text-secondary)]">{profile.displayName} hasn&apos;t shared any About details.</p>
            </section>
          )
        )}

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
                    <p className="text-sm font-semibold text-[var(--mesh-text)]">{m.community.name}</p>
                    <p className="mt-0.5 text-xs text-[var(--mesh-text-muted)]">
                      {formatCount(m.community._count.members)} members · {formatCount(m.community._count.posts)} posts
                    </p>
                  </div>
                  <span className="shrink-0 rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-[var(--success)]">
                    {m.role === "admin" ? "Admin" : m.role === "moderator" ? "Moderator" : "Joined"}
                  </span>
                </Link>
              ))
            ) : (
              <section className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] px-6 py-12 text-center">
                <h2 className="text-lg font-semibold text-[var(--mesh-text)]">No communities yet</h2>
                <p className="text-sm text-[var(--mesh-text-secondary)]">
                  {isOwnProfile ? "Join communities to see them here." : `${profile.displayName} hasn't joined any communities.`}
                </p>
                {isOwnProfile && (
                  <Button asChild className="mt-2">
                    <Link href="/communities">Browse communities</Link>
                  </Button>
                )}
              </section>
            )}
          </div>
        )}

        {canViewProfile && activeTab === "collections" && isOwnProfile && (
          <div className="space-y-4">
            {/* Saved FLOW content first — YouTube videos, tweets, clips —
                rendered from their snapshots, since the supply rows behind
                them are pruned on retention schedules. One saved list,
                whatever platform things came from. */}
            {savedFlowItems.map((item) => {
              const open = item.url ? safeHref(item.url) : undefined;
              const card = (
                <div className="flex items-start gap-3">
                  {item.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- snapshot thumbnails are remote platform URLs; next/image adds a loader round-trip for a 64px preview.
                    <img src={item.thumbnailUrl} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-[var(--mesh-bg)]">
                      <PlatformLogo platform={item.platform || "meshme"} size={28} className="rounded-full" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <PlatformLogo platform={item.platform || "meshme"} size={16} className="shrink-0 rounded-full" />
                      {item.authorName && (
                        <span className="truncate text-sm font-semibold text-[var(--mesh-text)]">{item.authorName}</span>
                      )}
                      <span className="text-xs text-[var(--mesh-text-muted)]">·</span>
                      <span className="text-xs text-[var(--mesh-text-muted)]">{formatRelativeTime(item.createdAt)}</span>
                    </div>
                    {item.title && <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-[var(--mesh-text)]">{item.title}</p>}
                    <div className="mt-2 flex items-center gap-2 text-xs text-[var(--mesh-text-muted)]">
                      {open && (
                        <span className="flex items-center gap-1 text-[var(--accent-text)]">
                          <ExternalLink size={12} /> Open source
                        </span>
                      )}
                      <span className="ml-auto flex items-center gap-1.5 text-[var(--accent-text)]"><Bookmark size={14} /> Saved</span>
                    </div>
                  </div>
                </div>
              );
              const cardClass = "block rounded-2xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] p-5 transition-colors hover:border-[var(--mesh-border-active)]";
              return open ? (
                <a key={item.id} href={open} target="_blank" rel="noreferrer" className={cardClass}>
                  {card}
                </a>
              ) : (
                <div key={item.id} className={cardClass}>
                  {card}
                </div>
              );
            })}
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
                        <span className="text-sm font-semibold text-[var(--mesh-text)]">{post.author.displayName}</span>
                        <span className="text-xs text-[var(--mesh-text-muted)]">@{post.author.username}</span>
                        <span className="text-xs text-[var(--mesh-text-muted)]">·</span>
                        <span className="text-xs text-[var(--mesh-text-muted)]">{formatRelativeTime(post.createdAt)}</span>
                      </div>
                      {post.content && <p className="mt-2 text-sm leading-relaxed text-[var(--mesh-text)]">{post.content}</p>}
                      <div className="mt-3 flex items-center gap-5 text-xs text-[var(--mesh-text-muted)]">
                        <span className="flex items-center gap-1.5"><Heart size={14} /> {formatCount(post._count.reactions)}</span>
                        <span className="flex items-center gap-1.5"><MessageCircle size={14} /> {formatCount(post._count.comments)}</span>
                        <span className="ml-auto flex items-center gap-1.5 text-[var(--accent-text)]"><Bookmark size={14} /> Saved</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            ) : savedFlowItems.length === 0 ? (
              <section className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] px-6 py-12 text-center">
                <h2 className="text-lg font-semibold text-[var(--mesh-text)]">Nothing saved yet</h2>
                <p className="text-sm text-[var(--mesh-text-secondary)]">
                  Tap the bookmark on anything in the Flow — mesh posts, YouTube videos, clips — and it collects here.
                </p>
              </section>
            ) : null}
          </div>
        )}

        {canViewProfile && activeTab === "links" && (
          <div className="space-y-3">
            {/* The owner's editor. Until this existed there was no write path to
                UserLink anywhere in the codebase, so the list below could only
                ever render its empty state — and that empty state told people to
                "add links from Settings", where no such control has ever been. */}
            {isOwnProfile && profile.linksEditable && (
              <ProfileLinksEditor initial={profile.linksEditable} />
            )}
            {links.length > 0 ? (
              links.map((link) => (
                <a
                  key={link.id}
                  href={safeHref(link.url)}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
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
                <h2 className="text-lg font-semibold text-[var(--mesh-text)]">No creator links yet</h2>
                <p className="text-sm text-[var(--mesh-text-secondary)]">
                  {isOwnProfile ? "Add your first link above." : `${profile.displayName} hasn't added any links.`}
                </p>
              </section>
            )}
          </div>
        )}

        {/* Posts list */}
        {activeTab !== "posts" && canViewProfile ? null : !canViewProfile ? (
          // Two ways to land here. If the viewer is the blocker, say so plainly
          // — the Unblock button above is the way out. Otherwise this is the
          // ordinary private-profile wall, which is also what the *other* side
          // of a block sees: blocking is never announced to the blocked party.
          <section className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] px-6 py-12 text-center">
            {profile.viewerHasBlocked ? (
              <>
                <Ban className="h-10 w-10 text-[var(--mesh-text-muted)]" aria-hidden="true" />
                <h2 className="text-lg font-semibold text-[var(--mesh-text)]">You blocked @{profile.username}</h2>
                <p className="text-sm text-[var(--mesh-text-secondary)]">
                  Their posts, profile, and Meshi stay hidden from you, and yours from them. Unblock to undo this — following each other does not come back.
                </p>
              </>
            ) : (
              <>
                <EyeOff className="h-10 w-10 text-[var(--mesh-text-muted)]" aria-hidden="true" />
                <h2 className="text-lg font-semibold text-[var(--mesh-text)]">Private profile</h2>
                <p className="text-sm text-[var(--mesh-text-secondary)]">Follow each other to unlock shared profile sections.</p>
              </>
            )}
          </section>
        ) : posts.length > 0 ? (
          <div className="space-y-4">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} currentUserId={currentUser.id} />
            ))}
          </div>
        ) : (
          <section className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] px-6 py-12 text-center">
            <h2 className="text-lg font-semibold text-[var(--mesh-text)]">No posts yet</h2>
            <p className="text-sm text-[var(--mesh-text-secondary)]">
              {isOwnProfile ? "Share your first post from Home." : `${profile.displayName} has not posted yet.`}
            </p>
            {isOwnProfile && (
              <Button asChild className="mt-2">
                <Link href="/feed?compose=true">Create post</Link>
              </Button>
            )}
          </section>
        )}
      </div>

      {/* Right sidebar */}
      <aside className="hidden space-y-5 lg:block">
        {/* Communities */}
        <section className="rounded-2xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[var(--mesh-text)]">Communities</h3>
            <Link href="/communities" className="text-xs font-medium text-[var(--accent-text)] hover:underline">View all</Link>
          </div>
          <div className="space-y-3">
            {communityCount > 0 ? (
              memberships.slice(0, 3).map((m) => (
                <Link key={m.community.id} href={`/communities/${m.community.slug}`} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[var(--mesh-text)]">{m.community.name}</p>
                    <p className="text-xs text-[var(--mesh-text-muted)]">{formatCount(m.community._count.members)} members</p>
                  </div>
                  <span className="shrink-0 rounded-md bg-emerald-500/10 px-2 py-0.5 text-micro font-semibold text-[var(--success)]">Joined</span>
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
            <h3 className="text-sm font-semibold text-[var(--mesh-text)]">Collections</h3>
            <Link href="?tab=collections" className="text-xs font-medium text-[var(--accent-text)] hover:underline">View all</Link>
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
              <h3 className="text-sm font-semibold text-[var(--mesh-text)]">Creator Links</h3>
              <Link href="?tab=links" className="text-xs text-[var(--accent-text)] hover:underline">View all</Link>
            </div>
            <div className="space-y-2.5">
              {links.map((link) => (
                <a
                  key={link.id}
                  href={safeHref(link.url)}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
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
            <h3 className="mb-4 text-sm font-semibold text-[var(--mesh-text)]">Platform Links</h3>
            <div className="space-y-2.5">
              {connectedAccounts.map((account) => (
                <div key={account.id} className="flex items-center gap-3 text-sm">
                  <PlatformIcon platform={account.platform} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-[var(--mesh-text)]">{getDisplayNameForAnyPlatform(account.platform)}</p>
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

function ProfileTab({ label, count, href, active = false }: { label: string; count?: number; href: string; active?: boolean }) {
  return (
    <Link
      href={href}
      className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
        active
          ? "border-[var(--accent)] text-[var(--mesh-text)]"
          : "border-transparent text-[var(--mesh-text-muted)] hover:text-[var(--mesh-text-secondary)]"
      }`}
    >
      {label}
      {count !== undefined && (
        <span className={`rounded-md px-1.5 py-0.5 text-xs ${active ? "bg-[var(--accent)]/10 text-[var(--accent-text)]" : "bg-[var(--mesh-panel)] text-[var(--mesh-text-muted)]"}`}>
          {count}
        </span>
      )}
    </Link>
  );
}

// Read-only "About" for viewers who aren't the owner. The fields are already
// gated to what this viewer may see (per-field privacy applied server-side in
// getUserProfile), so this just groups and renders whatever arrived.
function AboutReadOnly({ about }: { about: Partial<Record<AboutField, string>> }) {
  return (
    <section className="rounded-2xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] p-5">
      <h2 className="text-lg font-semibold text-[var(--mesh-text)]">About</h2>
      <div className="mt-4 grid gap-5">
        {ABOUT_GROUPS.map((group) => {
          const groupFields = ABOUT_FIELDS.filter((f) => ABOUT_FIELD_META[f].group === group.key && about[f]);
          if (!groupFields.length) return null;
          return (
            <div key={group.key}>
              <h3 className="text-xs font-semibold mesh-eyebrow text-[var(--mesh-text-muted)]">{group.label}</h3>
              <dl className="mt-2 grid gap-2">
                {groupFields.map((f) => (
                  <div key={f}>
                    <dt className="text-xs font-semibold text-[var(--mesh-text-muted)]">{ABOUT_FIELD_META[f].label}</dt>
                    <dd className="whitespace-pre-wrap break-words text-sm text-[var(--mesh-text)]">{about[f]}</dd>
                  </div>
                ))}
              </dl>
            </div>
          );
        })}
      </div>
    </section>
  );
}
