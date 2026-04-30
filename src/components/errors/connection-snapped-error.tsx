"use client";

import Link from "next/link";
import { Home, LifeBuoy, RefreshCw } from "lucide-react";
import { MeshBackground } from "@/components/mesh-background";
import { MeshiLogo } from "@/components/meshi/meshi-mascot";
import { cn } from "@/lib/utils";

type ConnectionSnappedErrorProps = {
  reset?: () => void;
  resetLabel?: string;
  homeHref?: string;
  supportHref?: string;
  fullScreen?: boolean;
  compact?: boolean;
};

const snappedNodes = [
  [16, 38],
  [86, 31],
  [146, 46],
  [270, 34],
  [364, 28],
  [38, 106],
  [98, 88],
  [158, 103],
  [216, 103],
  [286, 78],
  [342, 92],
  [18, 160],
  [92, 145],
  [162, 142],
  [282, 118],
  [362, 118],
] as const;

export function ConnectionSnappedError({
  reset,
  resetLabel = "Reconnect",
  homeHref = "/",
  supportHref = "/support",
  fullScreen,
  compact,
}: ConnectionSnappedErrorProps) {
  return (
    <section
      className={cn(
        "connection-snapped-page themed-error-screen relative isolate flex min-h-[70vh] items-center justify-center overflow-hidden px-4 py-6 text-center",
        fullScreen && "h-dvh min-h-0",
      )}
      data-meshi-zone="server-error"
    >
      <MeshBackground density={fullScreen ? 40 : 28} mouseInfluence={0.18} fixed={fullScreen} className="opacity-20" />

      <div
        className={cn(
          "connection-snapped-card relative z-10 mx-auto w-full rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)]/94 p-5 shadow-[var(--shadow-md)] backdrop-blur-xl sm:p-8",
          compact ? "max-w-2xl" : "max-w-3xl",
        )}
      >
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[var(--border-primary)] bg-[var(--bg-primary)] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
          <span className="connection-snapped-status-dot" aria-hidden="true" />
          500
        </div>

        <div className="connection-snapped-visual mx-auto mt-6" aria-hidden="true">
          <svg className="connection-snapped-strands" viewBox="0 0 380 210">
            <defs>
              <filter id="connection-snapped-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <linearGradient id="connection-snapped-strand" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.12" />
                <stop offset="45%" stopColor="var(--accent)" stopOpacity="0.78" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0.36" />
              </linearGradient>
            </defs>

            <path className="connection-snapped-line connection-snapped-line-soft" d="M 16 38 C 70 18 108 54 146 46 C 198 34 222 14 270 34 C 312 52 332 42 364 28" />
            <path className="connection-snapped-line connection-snapped-line-flicker" d="M 18 160 C 76 126 112 176 162 142 C 204 114 234 144 282 118 C 324 96 340 132 362 118" />
            <path className="connection-snapped-break-left" d="M 38 106 C 86 84 122 98 158 103" />
            <path className="connection-snapped-break-right" d="M 216 103 C 252 96 292 76 342 92" />
            <path className="connection-snapped-hanging" d="M 160 103 C 170 116 174 132 168 150" />
            <path className="connection-snapped-hanging connection-snapped-hanging-right" d="M 216 103 C 206 118 202 134 210 152" />

            {snappedNodes.map(([cx, cy]) => (
              <circle key={`${cx}-${cy}`} className="connection-snapped-node" cx={cx} cy={cy} r="2.8" />
            ))}

            <g className="connection-snapped-snap-mark">
              <line x1="183" y1="90" x2="198" y2="116" />
              <line x1="199" y1="90" x2="184" y2="116" />
            </g>
          </svg>

          <div className="connection-snapped-meshi" aria-hidden="true">
            <MeshiLogo size={compact ? 76 : 92} color="blue" mood="thinking" />
          </div>
        </div>

        <div className="connection-snapped-speech mx-auto mt-5" role="status">
          The connection broke. I kept your world safe.
        </div>

        <h1 className={cn("mx-auto mt-4 max-w-2xl font-display text-3xl font-black leading-tight text-[var(--text-primary)]", !compact && "sm:text-5xl")}>
          Connection Snapped
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[var(--text-secondary)] sm:text-base">
          Something on the server stopped responding. No private details are shown here, and you can try reconnecting now.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {reset ? (
            <button type="button" onClick={reset} className="connection-snapped-action connection-snapped-action-primary">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              {resetLabel}
            </button>
          ) : (
            <Link href={homeHref} className="connection-snapped-action connection-snapped-action-primary">
              <Home className="h-4 w-4" aria-hidden="true" />
              Home
            </Link>
          )}

          {reset && (
            <Link href={homeHref} className="connection-snapped-action">
              <Home className="h-4 w-4" aria-hidden="true" />
              Home
            </Link>
          )}

          <Link href={supportHref} className="connection-snapped-action">
            <LifeBuoy className="h-4 w-4" aria-hidden="true" />
            Support
          </Link>
        </div>
      </div>
    </section>
  );
}
