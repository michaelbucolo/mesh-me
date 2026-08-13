import "server-only";

// THE ONE PLACE STORED STATE BECOMES DELIVERERS.
//
// Live publishing and the scheduler both call this, so "what counts as
// connected" can never mean two different things depending on whether the
// post goes now or later. A platform this function returns no deliverer for
// ends `skipped` with publish.ts's honest reason — the exact behavior
// publish-fanout-check has always pinned.
//
// Credentials are resolved AT CALL TIME from ConnectedAccount, never from a
// snapshot on the scheduled row: a disconnect between scheduling and firing
// degrades to a skipped leg instead of posting with a credential the owner
// already revoked.
//
// This module never touches caps or entitlements — depth is adjudicated where
// a schedule is CREATED. By the time anything reaches a deliverer, it fires
// the same for everyone (schedule-fire-check pins that import surface).

import { prisma } from "@/lib/prisma";
import { buildPost, deliverPost, isSafeService } from "./atproto";
import { createPostAsUser, type PostAuthor } from "@/lib/post-core";
import type { Deliverer } from "./publish";

/**
 * The native deliverer plus whichever external platforms this owner has a
 * usable credential for, right now.
 *
 * mesh: rides createPostAsUser — the extracted core of createPost, so a
 * scheduled post obeys every law a live post obeys (validation, sanitizing,
 * safety classification, the `post:` rate limit). Visibility is forced public
 * by the caller (cross-post law).
 *
 * bluesky: assembled only when an active row carries the full session shape —
 * did (platformId), accessJwt (accessToken), and its own PDS (serviceUrl)
 * accepted by isSafeService. AT Protocol is federated; the host is never
 * assumed. Until the connect flow stores those, this returns no bluesky
 * deliverer and the leg skips honestly — identical on live and scheduled
 * paths, and both light up together the moment the credential store lands.
 *
 * `now` is injected so delivered timestamps are the moment of the SEND —
 * never backdated to a scheduled time that has since passed.
 */
export async function resolveDeliverers(user: PostAuthor, now: () => Date = () => new Date()): Promise<Record<string, Deliverer>> {
  const mesh: Deliverer = async (draft) => {
    const form = new FormData();
    form.set("content", draft.text);
    form.set("visibility", "public");
    const res = await createPostAsUser(user, form);
    if (res && typeof res === "object" && "error" in res && res.error) {
      // A rate limit is worth retrying; a validation refusal is not. The core
      // does not distinguish, so this reads the one case we can be sure about.
      const message = String(res.error);
      return { ok: false, retryable: /too fast|slow down/i.test(message), message };
    }
    const postId = res && typeof res === "object" && "postId" in res ? String(res.postId) : null;
    return { ok: true, url: postId ? `/feed/${postId}` : "/profile" };
  };

  const deliverers: Record<string, Deliverer> = { mesh };

  const bluesky = await prisma.connectedAccount.findFirst({
    where: { userId: user.id, platform: "bluesky", isActive: true },
    select: { accessToken: true, platformId: true, serviceUrl: true },
  });
  if (bluesky?.accessToken && bluesky.platformId && bluesky.serviceUrl && isSafeService(bluesky.serviceUrl)) {
    const session = { service: bluesky.serviceUrl, accessJwt: bluesky.accessToken, did: bluesky.platformId };
    deliverers.bluesky = async (draft) => {
      const result = await deliverPost(session, buildPost(draft.text, now().toISOString()));
      if (!result.ok) return result;
      // at:// URIs are not clickable; the public web view is the receipt.
      const rkey = result.uri.split("/").pop() ?? "";
      return { ok: true, url: `https://bsky.app/profile/${session.did}/post/${rkey}` };
    };
  }

  return deliverers;
}
