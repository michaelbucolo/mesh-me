"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MeshBackground } from "@/components/mesh-background";
import { MeshiLogo } from "@/components/meshi/meshi-mascot";

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

  return (
    <div className="relative min-h-screen bg-[var(--bg-primary)] flex flex-col items-center justify-center px-6">
      <MeshBackground density={24} className="opacity-20" />
      <div className="relative z-10 text-center max-w-md">
        <div className="mb-4 inline-flex rounded-2xl border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-3">
          <MeshiLogo size={54} color="blue" mood="thinking" />
        </div>

        <h1 className="font-display text-3xl font-bold mb-3" style={{ color: "var(--text-primary)" }}>
          Something went wrong
        </h1>
        <p className="text-sm mb-8" style={{ color: "var(--text-tertiary)" }}>
          An unexpected error interrupted this route. Retry the action, or return to the main product surface.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={reset}
            className="brand-button text-white px-6 py-3 rounded-xl text-sm font-semibold shadow-lg"
          >
            Try again
          </button>
          <Link
            href="/"
            className="px-6 py-3 rounded-xl text-sm font-medium transition-all inline-flex items-center gap-2"
            style={{ border: "1px solid var(--border-primary)", color: "var(--text-secondary)" }}
          >
            Back home <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
