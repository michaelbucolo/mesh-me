"use client";

import { Button } from "@/components/ui/button";
import { toggleCommunityMembership } from "@/lib/actions";
import { useState, useTransition } from "react";

interface JoinButtonProps {
  communityId: string;
  isMember: boolean;
}

export function JoinButton({ communityId, isMember: initialMember }: JoinButtonProps) {
  const [isMember, setIsMember] = useState(initialMember);
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    setIsMember(!isMember);
    startTransition(async () => {
      await toggleCommunityMembership(communityId);
    });
  };

  return (
    <Button
      onClick={handleClick}
      disabled={isPending}
      variant={isMember ? "secondary" : "default"}
      size="sm"
    >
      {isMember ? "Joined" : "Join"}
    </Button>
  );
}
