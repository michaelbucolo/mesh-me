"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import Link from "next/link";
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
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 hover:border-zinc-700 transition-all duration-200">
      <div className="flex items-start gap-3">
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
          {community.iconUrl ? (
            <img src={community.iconUrl} alt={community.name} className="h-12 w-12 rounded-xl object-cover" />
          ) : (
            <Users className="h-5 w-5 text-indigo-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <Link href={`/communities/${community.slug}`} className="font-semibold text-zinc-100 hover:underline">
            {community.name}
          </Link>
          {community.category && (
            <Badge variant="secondary" className="ml-2 text-[10px]">{community.category}</Badge>
          )}
          {community.description && (
            <p className="text-sm text-zinc-400 mt-1 line-clamp-2">{community.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
            <span><strong className="text-zinc-300">{community._count.members}</strong> members</span>
            <span><strong className="text-zinc-300">{community._count.posts}</strong> posts</span>
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
