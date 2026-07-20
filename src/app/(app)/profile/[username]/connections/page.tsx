import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, EyeOff, ShieldCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getProfileConnections, getUserProfile } from "@/lib/queries";
import { Avatar } from "@/components/ui/avatar";
import { FollowButton } from "../follow-button";

export const metadata: Metadata = {
  title: "Connections",
  description: "The people in this Mesh — followers and following.",
};

type Params = { username: string };
type Search = { tab?: string };

export default async function ConnectionsPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { username } = await params;
  const { tab } = await searchParams;
  const activeTab: "followers" | "following" = tab === "following" ? "following" : "followers";

  const viewer = await getCurrentUser();
  if (!viewer) redirect(`/login?next=/profile/${username}/connections`);

  const profile = await getUserProfile(username);
  if (!profile) notFound();

  const basePath = `/profile/${profile.username}/connections`;
  // Connections are the profile's "people" branch — only fetch them when the
  // viewer is allowed to see who this person connects with.
  const canSee = profile.sectionVisibility.people;
  // getProfileConnections re-authorizes internally (it's a Server Action); the
  // page gate here is just for choosing the "private list" vs list UI.
  const people = canSee ? await getProfileConnections(profile.id, activeTab) : [];

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 animate-page-enter">
      <div className="mb-4 flex items-center gap-3">
        <Link
          href={`/profile/${profile.username}`}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] text-[var(--mesh-text-secondary)] transition-colors hover:bg-[var(--mesh-panel-hover)]"
          aria-label="Back to profile"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="min-w-0">
          <h1 className="flex items-center gap-1.5 truncate text-lg font-bold text-[var(--mesh-text)]">
            {profile.displayName}
            {profile.isVerified && <ShieldCheck size={16} className="shrink-0 text-[var(--accent)]" aria-label="Verified" />}
          </h1>
          <p className="truncate text-xs text-[var(--mesh-text-muted)]">@{profile.username}</p>
        </div>
      </div>

      {/* Followers / Following tabs */}
      <nav className="flex items-center gap-1 border-b border-[var(--mesh-border)]" aria-label="Connections">
        <ConnectionTab label="Followers" count={profile._count.followers} href={`${basePath}?tab=followers`} active={activeTab === "followers"} />
        <ConnectionTab label="Following" count={profile._count.following} href={`${basePath}?tab=following`} active={activeTab === "following"} />
      </nav>

      {!canSee ? (
        <section className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] px-6 py-12 text-center">
          <EyeOff className="h-9 w-9 text-[var(--mesh-text-muted)]" aria-hidden="true" />
          <h2 className="text-base font-bold text-[var(--mesh-text)]">This list is private</h2>
          <p className="max-w-sm text-sm text-[var(--mesh-text-secondary)]">
            {profile.displayName} keeps who they connect with private.
          </p>
        </section>
      ) : people.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {people.map((person) => (
            <li key={person.id}>
              <div className="flex items-center gap-3 rounded-2xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] px-4 py-3 transition-colors hover:border-[var(--mesh-border-active)]">
                <Link href={`/profile/${person.username}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar src={person.avatarUrl} alt={person.displayName} size="md" className="h-11 w-11 shrink-0" />
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate text-sm font-bold text-[var(--mesh-text)]">
                      {person.displayName}
                      {person.isVerified && <ShieldCheck size={14} className="shrink-0 text-[var(--accent)]" aria-label="Verified" />}
                    </p>
                    <p className="truncate text-xs text-[var(--mesh-text-muted)]">@{person.username}</p>
                    {person.bio && <p className="mt-0.5 truncate text-xs text-[var(--mesh-text-secondary)]">{person.bio}</p>}
                  </div>
                </Link>
                {!person.isViewer && (
                  <div className="shrink-0">
                    <FollowButton userId={person.id} isFollowing={person.isFollowingByViewer} />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <section className="mt-6 flex flex-col items-center gap-2 rounded-2xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] px-6 py-12 text-center">
          <h2 className="text-base font-bold text-[var(--mesh-text)]">
            {activeTab === "followers" ? "No followers yet" : "Not following anyone yet"}
          </h2>
          <p className="text-sm text-[var(--mesh-text-secondary)]">
            {activeTab === "followers"
              ? `${profile.isOwnProfile ? "You don't" : `${profile.displayName} doesn't`} have followers yet.`
              : `${profile.isOwnProfile ? "You aren't" : `${profile.displayName} isn't`} following anyone yet.`}
          </p>
        </section>
      )}
    </div>
  );
}

function ConnectionTab({ label, count, href, active }: { label: string; count: number; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
        active
          ? "border-[var(--accent)] text-[var(--mesh-text)]"
          : "border-transparent text-[var(--mesh-text-muted)] hover:text-[var(--mesh-text-secondary)]"
      }`}
    >
      {label}
      <span className={`rounded-md px-1.5 py-0.5 text-xs ${active ? "bg-[var(--accent)]/10 text-[var(--accent)]" : "bg-[var(--mesh-panel)] text-[var(--mesh-text-muted)]"}`}>
        {count}
      </span>
    </Link>
  );
}
