// Compose: post straight onto your constellation. Extracted verbatim from
// the old mesh-scene.tsx — a thin frame around the shared PostComposer.

"use client";

import { PostComposer } from "@/components/feed/post-composer";
import { Modal } from "@/components/ui/modal";

export function MeshComposeModal({
  closing = false,
  meshUser,
  onClose,
  onPostCreated,
}: {
  meshUser: { id: string; displayName: string; avatarUrl: string | null };
  onClose: () => void;
  /** Chrome is playing the 170ms graceful exit — render leaving, swallow input. */
  closing?: boolean;
  onPostCreated: () => void;
}) {
  return (
    <Modal
      open={!closing}
      onClose={onClose}
      title="Create on your mesh"
      description="Share a thought, a photo, or something worth finding."
      className="presence-world-compose max-w-xl"
    >
      <PostComposer key={meshUser.id} user={meshUser} startExpanded onPostCreated={onPostCreated} />
    </Modal>
  );
}
