"use client";

import dynamic from "next/dynamic";
import { getLoadingPersonality, type LoadingPersonalityKey } from "@/lib/loading-personality";
import { cn } from "@/lib/utils";

interface RouteLoadingPersonalityProps {
  personality?: LoadingPersonalityKey;
  surface?: "public" | "app";
  className?: string;
}

// Instant CSS-only fallback that matches MeshiLoader's layout, so the swap to
// the full loader (if the wait lasts long enough to see it) doesn't shift.
function LoaderShell({
  title,
  subtitle,
  fullHeight,
}: {
  title: string;
  subtitle?: string;
  fullHeight: boolean;
}) {
  return (
    <div
      className={cn(
        "relative flex min-h-full min-w-0 flex-1 flex-col items-center justify-center overflow-hidden bg-[var(--bg-primary)] px-6",
        fullHeight && "h-dvh",
      )}
    >
      <div className="relative flex h-[280px] w-[280px] max-w-full items-center justify-center">
        <div className="h-24 w-24 animate-pulse rounded-full bg-[var(--accent)]/15" />
      </div>
      <h2 className="mt-2 text-center text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
      {subtitle && (
        <p className="mt-1 max-w-sm animate-pulse text-center text-sm text-[var(--text-muted)]">{subtitle}</p>
      )}
    </div>
  );
}

// MeshiLoader pulls in the full mascot + framer-motion. Loading it lazily
// keeps that weight out of every route's loading boundary (and therefore out
// of every page's initial JS) — the CSS shell above paints immediately and
// the woven-constellation loader takes over only on waits long enough to see.
const MeshiLoader = dynamic(
  () => import("@/components/meshi/meshi-loader").then((mod) => mod.MeshiLoader),
  { ssr: false, loading: () => null },
);

export function RouteLoadingPersonality({
  personality = "app",
  surface = "app",
  className,
}: RouteLoadingPersonalityProps) {
  const loading = getLoadingPersonality(personality);
  const fullHeight = surface === "public";

  return (
    <section
      className={cn(
        "loading-personality-shell relative flex min-h-full min-w-0 flex-1",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-loading-personality={personality}
    >
      <p className="sr-only">{loading.ariaLabel ?? `Loading ${loading.title}`}</p>
      <LoaderShell title={loading.title} subtitle={loading.subtitle} fullHeight={fullHeight} />
      <div className="absolute inset-0">
        <MeshiLoader
          title={loading.title}
          subtitle={loading.subtitle}
          mode={loading.mode}
          fullHeight={fullHeight}
        />
      </div>
    </section>
  );
}
