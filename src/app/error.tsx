"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to console in development
    console.error("Unhandled error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="text-5xl mb-4">⚡</div>

        <h1 className="font-display text-3xl font-bold mb-3" style={{ color: "var(--text-primary)" }}>
          Something went wrong
        </h1>
        <p className="text-sm mb-8" style={{ color: "var(--text-tertiary)" }}>
          An unexpected error occurred. This has been noted and we&apos;re looking into it.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={reset}
            className="brand-button text-white px-6 py-3 rounded-xl text-sm font-semibold shadow-lg"
          >
            Try again
          </button>
          <Link
            href="/mesh"
            className="px-6 py-3 rounded-xl text-sm font-medium transition-all inline-flex items-center"
            style={{ border: "1px solid var(--border-primary)", color: "var(--text-secondary)" }}
          >
            Back to the Mesh
          </Link>
        </div>
      </div>
    </div>
  );
}
