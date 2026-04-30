"use client";

import { useEffect } from "react";
import { ConnectionSnappedError } from "@/components/errors/connection-snapped-error";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error:", error);
  }, [error]);

  return <ConnectionSnappedError reset={reset} homeHref="/mesh" fullScreen />;
}
