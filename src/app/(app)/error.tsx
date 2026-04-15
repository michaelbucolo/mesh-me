"use client";

import { useEffect } from "react";
import Link from "next/link";

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
        <div className="text-4xl mb-4">⚡</div>

        <h2 className="font-display text-2xl font-bold mb-3" style={{ color: "var(--text-primary)" }}>
          Something went wrong
        </h2>
        <p className="text-sm mb-6" style={{ color: "var(--text-tertiary)" }}>
          This page ran into an issue. Try refreshing or head back to the mesh.
        </p>

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="brand-button text-white px-5 py-2.5 rounded-xl text-sm font-semibold"
          >
            Try again
          </button>
          <Link
            href="/mesh"
            className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{ border: "1px solid var(--border-primary)", color: "var(--text-secondary)" }}
          >
            Back to Mesh
          </Link>
        </div>
      </div>
    </div>
  );
}
