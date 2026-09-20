"use client";

import { useState, useTransition } from "react";
import { Lock, UserMinus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toggleCommunityMembership } from "@/lib/actions";
import { celebrate } from "@/lib/celebration";
import { feedback } from "@/lib/feedback";

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
        data-feedback="off"
        aria-pressed={joined}
        loading={isPending}
        disabled={disabled}
        leftIcon={joined ? <UserMinus className="h-4 w-4" /> : isPrivate ? <Lock className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
        onClick={(event) => {
          const anchor = event.currentTarget;
          setError(null);
          startTransition(async () => {
            try {
              const result = await toggleCommunityMembership(communityId);
              if ("error" in result && result.error) {
                setError(result.error);
                feedback("error");
                return;
              }
              if ("joined" in result) {
                setJoined(Boolean(result.joined));
                if (result.joined && !joined) {
                  feedback("success");
                  celebrate({ kind: "success", anchor });
                }
              }
            } catch {
              setError("Could not update your membership. Try again.");
              feedback("error");
            }
          });
        }}
      >
        {isAdmin ? "Admin" : joined ? "Joined" : isPrivate ? "Private" : "Join"}
      </Button>
      {error ? <p role="alert" className="mt-2 text-xs text-[var(--ds-danger)]">{error}</p> : null}
    </div>
  );
}
