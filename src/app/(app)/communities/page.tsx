import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getCommunities } from "@/lib/queries";
import { CommunityCard } from "@/components/shared/community-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Users, Plus } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = { title: "Communities" };

export default async function CommunitiesPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const communities = await getCommunities();

  return (
    <div data-meshi-zone="communities" className="max-w-4xl mx-auto px-4 py-6 animate-page-enter">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Communities</h1>
          <p className="text-sm text-[var(--text-tertiary)] mt-1">Your corners of the internet, all in one place</p>
        </div>
        <Link
          href="/communities/create"
          className="brand-button inline-flex items-center gap-2 text-white px-4 sm:px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Create community</span>
          <span className="sm:hidden">Create</span>
        </Link>
      </div>

      {communities.length > 0 ? (
        <div className="grid md:grid-cols-2 gap-4">
          {communities.map((community) => (
            <CommunityCard key={community.id} community={community} currentUserId={user.id} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Users}
          title="No communities yet"
          description="Communities are spaces for people who share your interests. Create one to bring your people together, or explore to find existing ones."
        >
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <Link
              href="/communities/create"
              className="brand-button inline-flex items-center gap-2 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-all"
            >
              <Plus className="h-4 w-4" />
              Start a community
            </Link>
            <Link
              href="/explore"
              className="inline-flex items-center gap-2 glass-surface text-[var(--text-secondary)] px-6 py-2.5 rounded-xl text-sm font-medium transition-all hover:text-[var(--text-primary)]"
            >
              Explore the mesh
            </Link>
          </div>
        </EmptyState>
      )}
    </div>
  );
}
