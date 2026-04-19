"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

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

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 animate-page-enter" data-meshi-zone="error">
      <div className="text-center max-w-md">
        <div className="rounded-2xl bg-red-500/10 p-4 mb-5 mx-auto w-fit">
          <AlertTriangle className="h-8 w-8 text-red-400" />
        </div>

        <h2 className="font-display text-2xl font-bold mb-2 text-[var(--text-primary)]">
          Something went wrong
        </h2>
        <p className="text-sm text-[var(--text-tertiary)] mb-6">
          This page ran into an issue. Try refreshing or head back to the mesh.
        </p>

        <div className="flex items-center justify-center gap-3">
          <Button onClick={reset} variant="default">
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Try again
          </Button>
          <Button variant="secondary" asChild>
            <Link href="/mesh">
              <Home className="h-4 w-4 mr-1.5" />
              Back to Mesh
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
