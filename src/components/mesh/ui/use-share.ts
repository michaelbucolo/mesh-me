// useShare — THE one share flow for every share affordance on the mesh
// (rail, person card, content lens). Wraps the native/clipboard shareContent
// helper and owns the transient "Copied" tick, deleting the four duplicated
// copied-state plumbings the old scene carried.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { shareContent } from "@/lib/native/share";

interface SharePayload {
  title: string;
  text: string;
  url: string;
  dialogTitle: string;
}

export interface UseShare {
  /** True for ~1.6s after a share fell back to copying the link. */
  copied: boolean;
  share: (payload: SharePayload) => void;
}

export function useShare(): UseShare {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const share = useCallback((payload: SharePayload) => {
    void shareContent(payload).then((result) => {
      if (result === "copied") {
        setCopied(true);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setCopied(false), 1600);
      }
    });
  }, []);

  return { copied, share };
}
