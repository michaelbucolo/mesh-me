"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { toggleCommunityMembership } from "@/lib/actions";
import { useTransition } from "react";

interface CommunityCardProps {
  community: {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
    iconUrl?: string | null;
    category?: string | null;
    _count: { members: number; posts: number };
    members?: { id: string; role: string }[];
  };
  currentUserId?: string;
}

export function CommunityCard({ community, currentUserId }: CommunityCardProps) {
  const [isPending, startTransition] = useTransition();
  const isMember = community.members && community.members.length > 0;

  const handleToggle = () => {
    if (!currentUserId) return;
    startTransition(async () => {
      await toggleCommunityMembership(community.id);
    });
  };

  return (
    <div className="rounded-2xl glass-card p-5 hover:border-[var(--border-primary)] transition-all duration-200">
      <div className="flex items-start gap-3">
        <div className="h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "var(--accent-subtle)", border: "1px solid var(--accent-muted)" }}>
          {community.iconUrl ? (
            <Image src={community.iconUrl} alt={community.name} width={48} height={48} className="h-12 w-12 rounded-xl object-cover" />
          ) : (
            <Users className="h-5 w-5" style={{ color: "var(--accent)" }} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <Link href={`/communities/${community.slug}`} className="font-semibold text-[var(--text-primary)] hover:underline">
            {community.name}
          </Link>
          {community.category && (
            <Badge variant="secondary" className="ml-2 text-[10px]">{community.category}</Badge>
          )}
          {community.description && (
            <p className="text-sm text-[var(--text-tertiary)] mt-1 line-clamp-2">{community.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-[var(--text-muted)]">
            <span><strong className="text-[var(--text-secondary)]">{community._count.members}</strong> members</span>
            <span><strong className="text-[var(--text-secondary)]">{community._count.posts}</strong> posts</span>
          </div>
        </div>
        {currentUserId && (
          <Button
            size="sm"
            variant={isMember ? "secondary" : "default"}
            onClick={handleToggle}
            disabled={isPending}
          >
            {isMember ? "Joined" : "Join"}
          </Button>
        )}
      </div>
    </div>
  );
}
