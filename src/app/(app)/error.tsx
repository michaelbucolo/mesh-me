"use client";

import { useEffect } from "react";
import { ConnectionSnappedError } from "@/components/errors/connection-snapped-error";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  return <ConnectionSnappedError reset={reset} homeHref="/mesh" compact />;
}
