"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState, type CSSProperties } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, ChevronDown, Lock, ShieldCheck } from "lucide-react";
import type { getCommunitiesHubData } from "@/lib/community-hub";
import { Button } from "@/components/ui/button";
import { formatCount, formatRelativeTime } from "@/lib/utils";

const HUB_SPRING = { type: "spring" as const, stiffness: 380, damping: 32 };

type CommunitiesHubData = NonNullable<Awaited<ReturnType<typeof getCommunitiesHubData>>>;
type Community = CommunitiesHubData["communities"][number];

const CATEGORY_TABS = ["All", "Technology", "Design", "Entrepreneurship", "Lifestyle", "Science", "Travel", "Gaming"];

function CommunityAvatar({ name, iconUrl, size = "md" }: { name: string; iconUrl?: string | null; size?: "sm" | "md" | "lg" }) {
  const initial = name.trim().charAt(0).toUpperCase() || "M";
  const sizeClass = size === "lg" ? "h-16 w-16" : size === "sm" ? "h-10 w-10" : "h-12 w-12";
  const textSize = size === "lg" ? "text-2xl" : size === "sm" ? "text-base" : "text-lg";

  return (
    <div className={`relative ${sizeClass} shrink-0 overflow-hidden rounded-2xl border border-[var(--mesh-border)] bg-[var(--accent)]/10`}>
      {iconUrl ? (
        <Image src={iconUrl} alt="" fill sizes="64px" className="object-cover" />
      ) : (
        <span className={`grid h-full w-full place-items-center ${textSize} font-semibold text-[var(--accent-text)]`}>{initial}</span>
      )}
    </div>
  );
}

function FeaturedCard({ community }: { community: Community }) {
  return (
    <Link
      href={`/communities/${community.slug}`}
      className="group relative flex min-w-[min(260px,80vw)] max-w-[300px] shrink-0 flex-col overflow-hidden rounded-2xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] transition-all duration-200 hover:border-[var(--mesh-border-active)] hover:-translate-y-0.5"
    >
      <div className="relative h-36 bg-gradient-to-br from-[var(--mesh-bg)] to-[var(--mesh-bg-elevated)]">
        {community.iconUrl ? (
          <Image src={community.iconUrl} alt="" fill sizes="300px" className="object-cover opacity-60" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <CommunityAvatar name={community.name} iconUrl={community.iconUrl} size="lg" />
          </div>
        )}
        <span className={`absolute top-3 left-3 rounded-md px-2 py-0.5 text-micro font-semibold ${community.isPublic ? "bg-[var(--media-chip)] text-[var(--media-ink)]" : "bg-[var(--media-chip)] text-[var(--media-ink-2)]"}`}>
          {community.isPublic ? "Public" : "Private"}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-semibold text-[var(--mesh-text)]">{community.name}</h3>
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[var(--accent-text)]" />
        </div>
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--mesh-text-muted)]">
          {community.description || "A community on Mesh.me"}
        </p>
        <p className="mt-auto pt-3 text-micro text-[var(--mesh-text-muted)]">
          {formatCount(community._count.members)} members
        </p>
      </div>
    </Link>
  );
}

function CommunityRow({ community, selected, onSelect, index }: { community: Community; selected: boolean; onSelect: () => void; index: number }) {
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      whileTap={{ scale: 0.99 }}
      style={{ "--i": index } as CSSProperties}
      className={`relative block w-full rounded-xl px-4 py-3 text-left transition-colors ${
        selected ? "border border-[var(--mesh-border-active)]" : "border border-transparent hover:bg-[var(--mesh-panel)]"
      }`}
    >
      {selected && (
        <motion.span
          layoutId="community-row-highlight"
          transition={HUB_SPRING}
          className="pointer-events-none absolute inset-0 rounded-xl bg-[var(--mesh-panel-hover)]"
          aria-hidden="true"
        />
      )}
      <span className="relative z-[1] flex items-center gap-4">
        <CommunityAvatar name={community.name} iconUrl={community.iconUrl} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-[var(--mesh-text)]">{community.name}</span>
            <ShieldCheck className="h-3 w-3 shrink-0 text-[var(--accent-text)]" />
          </span>
          <span className="block text-xs text-[var(--mesh-text-muted)]">
            {community.isPublic ? "Public" : "Private"} · {community.category || "General"}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-sm font-semibold text-[var(--mesh-text)]">{formatCount(community._count.members)}</span>
          <span className="block text-micro text-[var(--mesh-text-muted)]">members</span>
        </span>
        <span className="hidden shrink-0 text-right sm:block">
          <span className="block text-xs text-[var(--mesh-text-secondary)]">Updated {formatRelativeTime(community.updatedAt)}</span>
        </span>
        <span className="shrink-0">
          {!community.isPublic ? (
            <Lock className="h-4 w-4 text-[var(--mesh-text-muted)]" />
          ) : (
            <span className="h-2 w-2 rounded-full bg-[var(--accent)] inline-block" />
          )}
        </span>
      </span>
    </motion.button>
  );
}

export function CommunityHub({ data }: { data: CommunitiesHubData }) {
  const allCommunities = [...data.myCommunities, ...data.publicCommunities];
  const uniqueMap = new Map<string, Community>();
  for (const c of allCommunities) uniqueMap.set(c.id, c);
  const dedupedCommunities = Array.from(uniqueMap.values());

  const featured = data.publicCommunities.slice(0, 6);
  const [activeCategory, setActiveCategory] = useState("All");
  const [selectedId, setSelectedId] = useState<string | null>(featured[0]?.id ?? null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const scrollCarousel = (dir: -1 | 1) => {
    const el = carouselRef.current;
    if (!el) return;
    const amount = Math.min(el.clientWidth * 0.85, 320);
    el.scrollBy({ left: dir * amount, behavior: prefersReducedMotion ? "auto" : "smooth" });
  };

  const filteredCommunities = activeCategory === "All"
    ? dedupedCommunities
    : dedupedCommunities.filter((c) => c.category?.toLowerCase() === activeCategory.toLowerCase());

  const selectedCommunity = dedupedCommunities.find((c) => c.id === selectedId) ?? featured[0] ?? null;

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-6 xl:grid-cols-[minmax(0,1fr)_380px] animate-page-enter">
      {/* Main column */}
      <div className="min-w-0 space-y-6">
        {/* Featured communities carousel */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--mesh-text)]">Featured communities</h2>
            <div className="flex items-center gap-2">
              <Link href="/communities?view=featured" className="inline-flex items-center gap-1 text-xs text-[var(--accent-text)] hover:underline">
                View all
                <ArrowRight size={12} />
              </Link>
              <motion.button
                type="button"
                onClick={() => scrollCarousel(-1)}
                whileTap={{ scale: 0.88 }}
                whileHover={{ x: -1 }}
                transition={HUB_SPRING}
                className="rounded-lg border border-[var(--mesh-border)] p-1.5 text-[var(--mesh-text-muted)] hover:bg-[var(--mesh-panel)] hover:text-[var(--mesh-text)] transition-colors"
                aria-label="Previous"
              >
                <ArrowLeft size={14} />
              </motion.button>
              <motion.button
                type="button"
                onClick={() => scrollCarousel(1)}
                whileTap={{ scale: 0.88 }}
                whileHover={{ x: 1 }}
                transition={HUB_SPRING}
                className="rounded-lg border border-[var(--mesh-border)] p-1.5 text-[var(--mesh-text-muted)] hover:bg-[var(--mesh-panel)] hover:text-[var(--mesh-text)] transition-colors"
                aria-label="Next"
              >
                <ArrowRight size={14} />
              </motion.button>
            </div>
          </div>
          <div ref={carouselRef} className="flex gap-4 overflow-x-auto scroll-smooth pb-2 scrollbar-hide">
            {featured.map((community) => (
              <FeaturedCard key={community.id} community={community} />
            ))}
          </div>
        </section>

        {/* Category tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {CATEGORY_TABS.map((cat) => {
            const active = activeCategory === cat;
            return (
              <motion.button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                whileTap={{ scale: 0.95 }}
                className={`relative rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "border border-transparent text-[var(--accent-ink)]"
                    : "border border-[var(--mesh-border)] text-[var(--mesh-text-secondary)] hover:bg-[var(--mesh-panel)]"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="community-category-pill"
                    transition={HUB_SPRING}
                    className="absolute inset-0 rounded-full bg-[var(--accent)]"
                    aria-hidden="true"
                  />
                )}
                <span className="relative z-[1]">{cat}</span>
              </motion.button>
            );
          })}
          <Button type="button" variant="outline" size="sm" rightIcon={<ChevronDown size={14} />}>
            More
          </Button>
        </div>

        {/* All communities directory */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--mesh-text)]">All communities</h2>
            <div className="flex items-center gap-4 text-xs text-[var(--mesh-text-muted)]">
              <span>Members</span>
              <span>Activity</span>
            </div>
          </div>
          <div className="mesh-cascade-soft space-y-1">
            {filteredCommunities.length > 0 ? (
              filteredCommunities.map((community, index) => (
                <CommunityRow
                  key={community.id}
                  community={community}
                  selected={selectedId === community.id}
                  onSelect={() => setSelectedId(community.id)}
                  index={index}
                />
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--mesh-border)] px-6 py-10 text-center">
                <p className="text-sm text-[var(--mesh-text-muted)]">No communities found in this category.</p>
              </div>
            )}
          </div>
          {filteredCommunities.length > 0 && (
            <p className="mt-4 text-center text-xs text-[var(--mesh-text-muted)]">
              Showing 1–{filteredCommunities.length} of {dedupedCommunities.length} communities
              <Button type="button" variant="outline" size="sm" className="ml-3">
                Load more
              </Button>
            </p>
          )}
        </section>
      </div>

      {/* Right detail panel */}
      {selectedCommunity && (
        <aside className="hidden xl:block">
          <div className="sticky top-24 space-y-5">
            <section className="overflow-hidden rounded-2xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)]">
              {/* Community hero */}
              <div className="relative h-32 bg-gradient-to-br from-[var(--mesh-bg)] to-[var(--mesh-bg-elevated)]">
                {selectedCommunity.iconUrl && (
                  <Image src={selectedCommunity.iconUrl} alt="" fill sizes="380px" className="object-cover opacity-50" />
                )}
                <span className={`absolute top-3 right-3 rounded-md px-2 py-0.5 text-micro font-semibold ${selectedCommunity.isPublic ? "bg-[var(--media-chip)] text-[var(--media-ink)]" : "bg-[var(--media-chip)] text-[var(--media-ink-2)]"}`}>
                  {selectedCommunity.isPublic ? "Public" : "Private"}
                </span>
                <div className="absolute -bottom-8 left-5">
                  <CommunityAvatar name={selectedCommunity.name} iconUrl={selectedCommunity.iconUrl} size="lg" />
                </div>
              </div>

              <div className="px-5 pt-12 pb-5">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-[var(--mesh-text)]">{selectedCommunity.name}</h2>
                  <ShieldCheck className="h-4 w-4 text-[var(--accent-text)]" />
                </div>
                <p className="mt-0.5 text-xs text-[var(--mesh-text-muted)]">
                  {selectedCommunity.isPublic ? "Public" : "Private"} Community · {formatCount(selectedCommunity._count.members)} members
                </p>
                <p className="mt-3 text-sm leading-relaxed text-[var(--mesh-text-secondary)]">
                  {selectedCommunity.description || "A community on Mesh.me for sharing ideas and building together."}
                </p>

                <div className="mt-4 flex gap-3">
                  <Link
                    href={`/communities/${selectedCommunity.slug}`}
                    className="flex-1 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-center text-sm font-medium text-[var(--accent-contrast)] transition-colors hover:bg-[var(--accent)]/90"
                  >
                    Enter Space
                  </Link>
                  <Link
                    href={`/mesh?community=${selectedCommunity.slug}`}
                    className="flex-1 rounded-xl border border-[var(--mesh-border)] px-4 py-2.5 text-center text-sm font-medium text-[var(--mesh-text)] transition-colors hover:bg-[var(--mesh-panel)]"
                  >
                    View Community Mesh
                  </Link>
                </div>
              </div>

              {/* Detail tabs */}
              <div className="flex border-t border-[var(--mesh-border)]">
                {["About", "Activity", "Members", "Spaces", "Settings"].map((tab, i) => (
                  <button
                    key={tab}
                    type="button"
                    className={`flex-1 py-2.5 text-center text-xs font-medium transition-colors ${
                      i === 0
                        ? "border-b-2 border-[var(--accent)] text-[var(--mesh-text)]"
                        : "text-[var(--mesh-text-muted)] hover:text-[var(--mesh-text-secondary)]"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </section>

            {/* About section */}
            <section className="rounded-2xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] p-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-xs font-semibold text-[var(--mesh-text-muted)] mb-2">About this community</h4>
                  <p className="text-xs leading-relaxed text-[var(--mesh-text-secondary)]">
                    {selectedCommunity.description || "A space for sharing ideas and building meaningful projects."}
                  </p>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-[var(--mesh-text-muted)] mb-2">Community rules</h4>
                  <ol className="space-y-1 text-xs text-[var(--mesh-text-secondary)]">
                    <li>1. Be respectful and kind.</li>
                    <li>2. Share openly, give credit.</li>
                    <li>3. No spam or self-promotion.</li>
                    <li>4. Protect privacy and data.</li>
                  </ol>
                  <Link href={`/communities/${selectedCommunity.slug}`} className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--accent-text)] hover:underline">
                    View all rules
                    <ArrowRight size={12} />
                  </Link>
                </div>
              </div>

              {/* Tags */}
              {selectedCommunity.category && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  <span className="rounded-md bg-[var(--mesh-panel)] px-2 py-0.5 text-micro font-medium text-[var(--mesh-text-muted)]">
                    {selectedCommunity.category}
                  </span>
                </div>
              )}
            </section>
          </div>
        </aside>
      )}
    </div>
  );
}
