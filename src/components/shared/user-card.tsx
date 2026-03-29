"use client";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { toggleFollow } from "@/lib/actions";
import { useTransition } from "react";

interface UserCardProps {
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string | null;
    bio?: string | null;
    isVerified?: boolean;
    interests?: { tag: string }[];
    _count?: { followers: number; posts: number };
  };
  currentUserId?: string;
  isFollowing?: boolean;
  showBio?: boolean;
  compact?: boolean;
}

export function UserCard({ user, currentUserId, isFollowing: initialFollowing = false, showBio = true, compact = false }: UserCardProps) {
  const [isPending, startTransition] = useTransition();

  const handleFollow = () => {
    if (!currentUserId) return;
    startTransition(async () => {
      await toggleFollow(user.id);
    });
  };

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--bg-tertiary)] transition-colors">
        <Link href={`/profile/${user.username}`}>
          <Avatar src={user.avatarUrl} alt={user.displayName} size="sm" />
        </Link>
        <div className="flex-1 min-w-0">
          <Link href={`/profile/${user.username}`} className="font-medium text-sm text-[var(--text-primary)] hover:underline truncate block">
            {user.displayName}
          </Link>
          <p className="text-xs text-[var(--text-muted)] truncate">@{user.username}</p>
        </div>
        {currentUserId && currentUserId !== user.id && (
          <Button size="sm" variant={initialFollowing ? "secondary" : "default"} onClick={handleFollow} disabled={isPending}>
            {initialFollowing ? "Following" : "Follow"}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-5 hover:border-[var(--border-primary)] transition-all duration-200">
      <div className="flex items-start gap-3">
        <Link href={`/profile/${user.username}`}>
          <Avatar src={user.avatarUrl} alt={user.displayName} size="lg" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <Link href={`/profile/${user.username}`} className="font-semibold text-[var(--text-primary)] hover:underline">
              {user.displayName}
            </Link>
            {user.isVerified && (
              <svg className="h-4 w-4 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>
          <p className="text-sm text-[var(--text-muted)]">@{user.username}</p>
          {showBio && user.bio && (
            <p className="text-sm text-[var(--text-tertiary)] mt-2 line-clamp-2">{user.bio}</p>
          )}
          {user.interests && user.interests.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {user.interests.slice(0, 4).map((interest) => (
                <Badge key={interest.tag} variant="secondary" className="text-[10px]">
                  {interest.tag}
                </Badge>
              ))}
            </div>
          )}
          {user._count && (
            <div className="flex gap-3 mt-2 text-xs text-[var(--text-muted)]">
              <span><strong className="text-[var(--text-secondary)]">{user._count.followers}</strong> followers</span>
              <span><strong className="text-[var(--text-secondary)]">{user._count.posts}</strong> posts</span>
            </div>
          )}
        </div>
        {currentUserId && currentUserId !== user.id && (
          <Button size="sm" variant={initialFollowing ? "secondary" : "default"} onClick={handleFollow} disabled={isPending}>
            {initialFollowing ? "Following" : "Follow"}
          </Button>
        )}
      </div>
    </div>
  );
}
