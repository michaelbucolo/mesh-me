"use client";

import { useState, useTransition } from "react";
import { Ban, ShieldOff } from "lucide-react";
import { blockUser, unblockUser } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";

// One honest description of what pressing Block actually does, shared by every
// surface that offers it. It cascades follows in both directions, so the copy
// says so instead of letting people discover it afterwards.
function blockConfirmDescription(username: string) {
  return `@${username} won't be able to see your posts, profile, or Mesh, message you, or find you in search — and you won't see theirs. If either of you follows the other, that connection is removed now and is not restored when you unblock. They are not told you blocked them.`;
}

/** The Block/Unblock control for a profile's action row, alongside Follow and
 * Message. Optimistic like FollowButton, and rolls back on a server refusal. */
export function BlockUserButton({
  userId,
  username,
  isBlocked: initialBlocked,
}: {
  userId: string;
  username: string;
  isBlocked: boolean;
}) {
  const [isBlocked, setIsBlocked] = useState(initialBlocked);
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { addToast } = useToast();

  const run = (blocking: boolean) => {
    const previous = isBlocked;
    setIsBlocked(blocking);
    startTransition(async () => {
      try {
        const result = blocking ? await blockUser(userId) : await unblockUser(userId);
        if (result && "error" in result) {
          setIsBlocked(previous);
          addToast(String(result.error), "error");
          return;
        }
        addToast(blocking ? `Blocked @${username}` : `Unblocked @${username}`, "success");
      } catch {
        setIsBlocked(previous);
        addToast("Couldn't update this block. Please try again.", "error");
      }
    });
  };

  return (
    <>
      <Button
        onClick={() => (isBlocked ? run(false) : setConfirming(true))}
        disabled={isPending}
        variant="secondary"
        size="sm"
      >
        {isBlocked ? (
          <>
            <ShieldOff size={16} aria-hidden="true" />
            Unblock
          </>
        ) : (
          <>
            <Ban size={16} aria-hidden="true" />
            Block
          </>
        )}
      </Button>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => run(true)}
        title={`Block @${username}?`}
        description={blockConfirmDescription(username)}
        confirmLabel="Block"
        destructive
      />
    </>
  );
}

/**
 * The confirmation half of "Block @author" in a post's "…" overflow menu. It
 * lives OUTSIDE the menu on purpose: opening it closes the menu, and a dialog
 * mounted inside that menu would be unmounted by its own trigger. `onBlocked`
 * lets the card remove itself the moment the block lands, so the post the
 * viewer just acted on doesn't linger until the next revalidation.
 */
export function BlockAuthorConfirmDialog({
  open,
  onClose,
  userId,
  username,
  onBlocked,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  username: string;
  onBlocked: () => void;
}) {
  const [, startTransition] = useTransition();
  const { addToast } = useToast();

  const confirm = () => {
    startTransition(async () => {
      try {
        const result = await blockUser(userId);
        if (result && "error" in result) {
          addToast(String(result.error), "error");
          return;
        }
        addToast(`Blocked @${username}`, "success");
        onBlocked();
      } catch {
        addToast("Couldn't block this account. Please try again.", "error");
      }
    });
  };

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={confirm}
      title={`Block @${username}?`}
      description={blockConfirmDescription(username)}
      confirmLabel="Block"
      destructive
    />
  );
}
