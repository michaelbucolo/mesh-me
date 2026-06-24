import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Compass, Lock, MessageCircle, Plus, Search, ShieldCheck, Sparkles, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CommunityJoinButton } from "@/components/communities/community-join-button";
import type { getCommunitiesHubData } from "@/lib/community-hub";
import { formatCount, formatRelativeTime } from "@/lib/utils";

type CommunitiesHubData = NonNullable<Awaited<ReturnType<typeof getCommunitiesHubData>>>;

function CommunityAvatar({ name, iconUrl }: { name: string; iconUrl?: string | null }) {
  const initial = name.trim().charAt(0).toUpperCase() || "M";

  return (
    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-[var(--ds-border)] bg-[var(--accent-subtle)]">
      {iconUrl ? (
        <Image src={iconUrl} alt="" fill sizes="48px" className="object-cover" />
      ) : (
        <span className="grid h-full w-full place-items-center text-lg font-bold text-[var(--accent)]">{initial}</span>
      )}
    </div>
  );
}

function CommunityCard({
  community,
  compact = false,
}: {
  community: CommunitiesHubData["communities"][number];
  compact?: boolean;
}) {
  const membership = community.members[0];

  return (
    <article className="mesh-surface rounded-[24px] border border-[var(--ds-border)] p-4 transition duration-200 hover:-translate-y-0.5 hover:border-[var(--accent-muted)] hover:shadow-[var(--shadow-soft)]">
      <div className="flex gap-3">
        <CommunityAvatar name={community.name} iconUrl={community.iconUrl} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/communities/${community.slug}`} className="truncate text-base font-bold text-[var(--text-primary)] hover:underline">
              {community.name}
            </Link>
            <Badge variant={community.isPublic ? "outline" : "warning"}>
              {community.isPublic ? "Public" : "Private"}
            </Badge>
            {membership ? <Badge variant="accent">{membership.role}</Badge> : null}
          </div>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-[var(--text-secondary)]">
            {community.description || "A Mesh.me community for posts, chat, members, and shared spaces."}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[var(--text-tertiary)]">
        <span className="inline-flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          {formatCount(community._count.members)} members
        </span>
        <span>{formatCount(community._count.posts)} posts</span>
        <span>Updated {formatRelativeTime(community.updatedAt)}</span>
        {community.category ? <span>#{community.category}</span> : null}
      </div>

      {!compact ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild size="sm" variant="secondary">
            <Link href={`/communities/${community.slug}`}>Open</Link>
          </Button>
          <CommunityJoinButton
            communityId={community.id}
            isMember={Boolean(membership)}
            isPrivate={!community.isPublic}
            role={membership?.role}
          />
        </div>
      ) : null}
    </article>
  );
}

export function CommunityHub({ data }: { data: CommunitiesHubData }) {
  const featured = data.publicCommunities.slice(0, 6);
  const mySpaces = data.myCommunities.slice(0, 6);

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-5 px-3 py-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="min-w-0 space-y-5">
        <div className="mesh-surface rounded-[28px] border border-[var(--ds-border)] p-4 shadow-[var(--shadow-soft)] sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <Badge variant="accent" className="mb-3">
                Communities
              </Badge>
              <h1 className="text-3xl font-bold tracking-[0] text-[var(--text-primary)]">Spaces for every part of your world.</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
                Create creator, friend, family, or project spaces with posts, member roles, rules, chat, and private controls.
              </p>
            </div>
            <Button asChild size="lg">
              <Link href="/communities/create">
                <Plus className="h-4 w-4" />
                Create
              </Link>
            </Button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-4">
              <p className="text-2xl font-bold text-[var(--text-primary)]">{formatCount(data.stats.spaces)}</p>
              <p className="text-xs text-[var(--text-tertiary)]">available spaces</p>
            </div>
            <div className="rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-4">
              <p className="text-2xl font-bold text-[var(--text-primary)]">{formatCount(data.stats.posts)}</p>
              <p className="text-xs text-[var(--text-tertiary)]">community posts</p>
            </div>
            <div className="rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-4">
              <p className="text-2xl font-bold text-[var(--text-primary)]">{formatCount(data.stats.members)}</p>
              <p className="text-xs text-[var(--text-tertiary)]">memberships</p>
            </div>
            <div className="rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-4">
              <p className="text-2xl font-bold text-[var(--text-primary)]">{formatCount(data.stats.privateSpaces)}</p>
              <p className="text-xs text-[var(--text-tertiary)]">private spaces</p>
            </div>
          </div>
        </div>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-[var(--text-primary)]">Your spaces</h2>
              <p className="text-sm text-[var(--text-secondary)]">The communities you can post and chat in.</p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/search?type=communities">
                Find more
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          {mySpaces.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {mySpaces.map((community) => (
                <CommunityCard key={community.id} community={community} />
              ))}
            </div>
          ) : (
            <div className="mesh-surface rounded-[24px] border border-dashed border-[var(--ds-border)] p-8 text-center">
              <Sparkles className="mx-auto h-8 w-8 text-[var(--accent)]" />
              <h3 className="mt-3 text-lg font-bold text-[var(--text-primary)]">Create your first space</h3>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">Start with a creator, friend, family, or project community.</p>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-xl font-bold text-[var(--text-primary)]">Discover</h2>
            <p className="text-sm text-[var(--text-secondary)]">Public communities you can join right away.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {featured.map((community) => (
              <CommunityCard key={community.id} community={community} />
            ))}
          </div>
        </section>
      </section>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <section className="mesh-surface rounded-[24px] border border-[var(--ds-border)] p-4">
          <h2 className="flex items-center gap-2 text-base font-bold text-[var(--text-primary)]">
            <ShieldCheck className="h-5 w-5 text-[var(--accent)]" />
            Community controls
          </h2>
          <div className="mt-4 grid gap-3 text-sm text-[var(--text-secondary)]">
            <div className="flex gap-3">
              <Lock className="mt-0.5 h-4 w-4 text-[var(--accent)]" />
              <p>Private spaces only appear to members.</p>
            </div>
            <div className="flex gap-3">
              <MessageCircle className="mt-0.5 h-4 w-4 text-[var(--accent)]" />
              <p>Every member space gets community chat.</p>
            </div>
            <div className="flex gap-3">
              <Compass className="mt-0.5 h-4 w-4 text-[var(--accent)]" />
              <p>Roles, rules, pinned posts, and moderation stay in the space.</p>
            </div>
          </div>
        </section>

        <section className="mesh-surface rounded-[24px] border border-[var(--ds-border)] p-4">
          <h2 className="flex items-center gap-2 text-base font-bold text-[var(--text-primary)]">
            <Search className="h-5 w-5 text-[var(--accent)]" />
            Categories
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {data.categories.length ? (
              data.categories.map((category) => (
                <Badge key={category.name} variant="secondary">
                  #{category.name} {category.count}
                </Badge>
              ))
            ) : (
              <p className="text-sm text-[var(--text-secondary)]">No categories yet.</p>
            )}
          </div>
        </section>

        <section className="mesh-surface rounded-[24px] border border-[var(--ds-border)] p-4">
          <h2 className="text-base font-bold text-[var(--text-primary)]">Best fit</h2>
          <div className="mt-3 grid gap-2">
            {data.templates.map((template) => (
              <div key={template.id} className="rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-3">
                <p className="text-sm font-bold text-[var(--text-primary)]">{template.label}</p>
                <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{template.description}</p>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </main>
  );
}
