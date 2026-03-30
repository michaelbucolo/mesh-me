"use client";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toggleFollow } from "@/lib/actions";
import Link from "next/link";
import { useState, useTransition } from "react";
import { UserPlus, UserCheck } from "lucide-react";

interface SuggestedUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  interests: { id: string; tag: string }[];
  _count: { followers: number };
}

export function ExploreUserCard({
  user,
  currentUserId,
}: {
  user: SuggestedUser;
  currentUserId: string;
}) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleFollow = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const previous = isFollowing;
    setIsFollowing(!isFollowing);
    startTransition(async () => {
      try {
        const result = await toggleFollow(user.id);
        if (result && "error" in result) {
          setIsFollowing(previous);
        }
      } catch {
        setIsFollowing(previous);
      }
    });
  };

  return (
    <div className="rounded-2xl glass-card p-4 hover:border-[var(--border-primary)] transition-all text-center group relative">
      <Link href={`/profile/${user.username}`} className="block">
        <Avatar
          src={user.avatarUrl}
          alt={user.displayName}
          size="lg"
          className="mx-auto mb-3"
        />
        <h3 className="text-sm font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors truncate">
          {user.displayName}
        </h3>
        <p className="text-xs text-[var(--text-muted)] mb-2">
          @{user.username}
        </p>
        {user.interests && user.interests.length > 0 && (
          <div className="flex flex-wrap gap-1 justify-center">
            {user.interests.slice(0, 2).map((interest) => (
              <Badge
                key={interest.id}
                variant="secondary"
                className="text-[10px]"
              >
                {interest.tag}
              </Badge>
            ))}
          </div>
        )}
        <p className="text-xs text-[var(--text-muted)] mt-2">
          {user._count.followers} followers
        </p>
      </Link>
      {currentUserId !== user.id && (
        <Button
          size="sm"
          variant={isFollowing ? "secondary" : "default"}
          onClick={handleFollow}
          disabled={isPending}
          className="mt-3 w-full"
        >
          {isFollowing ? (
            <>
              <UserCheck className="h-3.5 w-3.5 mr-1" />
              Following
            </>
          ) : (
            <>
              <UserPlus className="h-3.5 w-3.5 mr-1" />
              Follow
            </>
          )}
        </Button>
      )}
    </div>
  );
}

export function ExploreUsersGrid({
  users,
  currentUserId,
}: {
  users: SuggestedUser[];
  currentUserId: string;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 stagger-children">
      {users.slice(0, 8).map((user) => (
        <ExploreUserCard
          key={user.id}
          user={user}
          currentUserId={currentUserId}
        />
      ))}
    </div>
  );
}
