"use client";

import { Button } from "@/components/ui/button";
import { toggleFollow } from "@/lib/actions";
import { publishMeshiCause } from "@/lib/meshi-bus";
import { useState, useTransition } from "react";
import { UserPlus, UserCheck } from "lucide-react";

interface FollowButtonProps {
  userId: string;
  isFollowing: boolean;
}

export function FollowButton({ userId, isFollowing: initialFollowing }: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initialFollowing);
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    const previous = isFollowing;
    setIsFollowing(!isFollowing);
    startTransition(async () => {
      try {
        const result = await toggleFollow(userId);
        if (result && 'error' in result) {
          setIsFollowing(previous);
          publishMeshiCause({ kind: "action:failed" });
        } else if (!previous) {
          // Only a NEW follow is worth a reaction. Unfollowing is not a
          // celebration, and this is a toggle.
          publishMeshiCause({ kind: "follow:added" });
        }
      } catch {
        setIsFollowing(previous);
        publishMeshiCause({ kind: "action:failed" });
      }
    });
  };

  return (
    <Button
      onClick={handleClick}
      disabled={isPending}
      variant={isFollowing ? "secondary" : "default"}
      size="sm"
    >
      {isFollowing ? (
        <>
          <UserCheck className="h-4 w-4" />
          Following
        </>
      ) : (
        <>
          <UserPlus className="h-4 w-4" />
          Follow
        </>
      )}
    </Button>
  );
}
