"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PaperWait } from "@/components/loading/paper-wait";

export const SHARED_INTAKE_KEY = "mesh-shared-intake";

/**
 * The client half of the share_target receiver: stash what the other app
 * shared, then land on the feed where the composer picks it up (once) and
 * opens pre-filled. sessionStorage rather than a query param so the shared
 * text never sits in the URL bar, history, or server logs longer than the
 * one redirect it takes to arrive.
 */
export function ShareIntake({ body }: { body: string }) {
  const router = useRouter();

  useEffect(() => {
    try {
      if (body) sessionStorage.setItem(SHARED_INTAKE_KEY, body);
    } catch {
      // Storage unavailable — the composer just opens empty.
    }
    router.replace("/feed");
  }, [body, router]);

  return (
    <div className="flex min-h-64 items-center justify-center">
      <PaperWait size="md" />
    </div>
  );
}
