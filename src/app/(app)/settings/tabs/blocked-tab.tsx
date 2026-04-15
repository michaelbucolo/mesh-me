"use client";

import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { toggleBlock } from "@/lib/actions";
import { useTransition } from "react";
import { motion } from "framer-motion";
import { UserX } from "lucide-react";
import type { BlockedUser } from "./types";

interface BlockedTabProps {
  blockedUsers: BlockedUser[];
  setBlockedUsers: React.Dispatch<React.SetStateAction<BlockedUser[]>>;
  showSuccess: (msg: string) => void;
}

export function BlockedTab({ blockedUsers, setBlockedUsers, showSuccess }: BlockedTabProps) {
  const [isPending, startTransition] = useTransition();

  const handleUnblock = (userId: string) => {
    startTransition(async () => {
      await toggleBlock(userId);
      setBlockedUsers((prev) => prev.filter((b) => b.blocked.id !== userId));
      showSuccess("User unblocked");
    });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Blocked users</h2>
      <p className="text-sm text-[var(--text-muted)] mb-6">Blocked users cannot see your profile, posts, or message you.</p>
      {blockedUsers.length > 0 ? (
        <div className="space-y-2">
          {blockedUsers.map((block) => (
            <div key={block.id} className="flex items-center justify-between p-3 rounded-xl glass-surface">
              <div className="flex items-center gap-3">
                <Avatar src={block.blocked.avatarUrl} alt={block.blocked.displayName} size="sm" />
                <div>
                  <span className="text-sm font-medium text-[var(--text-primary)]">{block.blocked.displayName}</span>
                  <span className="text-xs text-[var(--text-muted)] block">@{block.blocked.username}</span>
                </div>
              </div>
              <Button variant="secondary" size="sm" onClick={() => handleUnblock(block.blocked.id)} disabled={isPending}>
                Unblock
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <UserX className="h-10 w-10 text-[var(--text-muted)] mx-auto mb-3" />
          <p className="text-sm text-[var(--text-muted)]">No blocked users</p>
        </div>
      )}
    </motion.div>
  );
}
