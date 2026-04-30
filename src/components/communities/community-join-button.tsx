"use client";

import { useState, useTransition } from "react";
import { Lock, UserMinus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toggleCommunityMembership } from "@/lib/actions";

type CommunityJoinButtonProps = {
  communityId: string;
  isMember: boolean;
  isPrivate?: boolean;
  role?: string | null;
  className?: string;
};

export function CommunityJoinButton({
  communityId,
  isMember,
  isPrivate = false,
  role,
  className,
}: CommunityJoinButtonProps) {
  const [joined, setJoined] = useState(isMember);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isAdmin = role === "admin";
  const disabled = isPending || isAdmin || (!joined && isPrivate);

  return (
    <div className={className}>
      <Button
        type="button"
        variant={joined ? "secondary" : "default"}
        size="sm"
        loading={isPending}
        disabled={disabled}
        leftIcon={joined ? <UserMinus className="h-4 w-4" /> : isPrivate ? <Lock className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await toggleCommunityMembership(communityId);
            if ("error" in result && result.error) {
              setError(result.error);
              return;
            }
            if ("joined" in result) setJoined(Boolean(result.joined));
          });
        }}
      >
        {isAdmin ? "Admin" : joined ? "Joined" : isPrivate ? "Private" : "Join"}
      </Button>
      {error ? <p className="mt-2 text-xs text-[var(--ds-danger)]">{error}</p> : null}
    </div>
  );
}
