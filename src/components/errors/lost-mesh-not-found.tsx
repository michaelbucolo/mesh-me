"use client";

import Link from "next/link";
import { Home, LifeBuoy, Search } from "lucide-react";
import { MeshiLogo } from "@/components/meshi/meshi-mascot";
import { cn } from "@/lib/utils";

type LostMeshNotFoundProps = {
  homeHref?: string;
  searchHref?: string;
  supportHref?: string;
  fullScreen?: boolean;
};

const actions = [
  { key: "home", label: "Home", icon: Home },
  { key: "search", label: "Search", icon: Search },
  { key: "support", label: "Support", icon: LifeBuoy },
] as const;

export function LostMeshNotFound({
  homeHref = "/",
  searchHref = "/search",
  supportHref = "/support",
  fullScreen,
}: LostMeshNotFoundProps) {
  const hrefs = {
    home: homeHref,
    search: searchHref,
    support: supportHref,
  };

  return (
    <section
      className={cn(
        "lost-mesh-page themed-error-screen relative isolate flex min-h-[70vh] items-center justify-center overflow-hidden px-4 py-6 text-center",
        fullScreen && "h-dvh min-h-0",
      )}
      data-meshi-zone="not-found"
    >
      <div className="lost-mesh-card relative z-10 mx-auto w-full max-w-3xl rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)]/92 p-5 shadow-[var(--shadow-md)] backdrop-blur-xl sm:p-8">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[var(--border-primary)] bg-[var(--bg-primary)] px-3 py-1.5 text-[11px] font-semibold mesh-eyebrow text-[var(--text-muted)]">
          <span className="h-2 w-2 rounded-full bg-red-400" aria-hidden="true" />
          404
        </div>

        <div className="lost-mesh-visual mx-auto mt-6" aria-hidden="true">
          <svg className="lost-mesh-strands" viewBox="0 0 360 220" role="img">
            <defs>
              <filter id="lost-mesh-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <linearGradient id="lost-strand" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.16" />
                <stop offset="48%" stopColor="var(--accent)" stopOpacity="0.82" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0.42" />
              </linearGradient>
            </defs>

            <path className="lost-mesh-live-strand" d="M 14 34 C 72 6 112 64 154 48 C 198 31 214 8 262 24 C 302 38 314 76 346 62" />
            <path className="lost-mesh-live-strand lost-mesh-live-strand-soft" d="M 18 174 C 70 138 112 188 154 154 C 206 112 230 144 274 124 C 314 106 328 146 350 132" />
            <path className="lost-mesh-broken-strand" d="M 34 112 C 94 70 130 102 164 104" />
            <path className="lost-mesh-broken-strand" d="M 196 102 C 238 92 270 68 326 88" />
            <path className="lost-mesh-loop" d="M 134 108 C 142 72 202 70 218 108 C 235 150 134 154 142 112 C 149 78 204 84 208 116" />

            {[
              [20, 34], [86, 26], [154, 48], [260, 24], [346, 62],
              [34, 112], [102, 82], [164, 104], [196, 102], [268, 70], [326, 88],
              [18, 174], [96, 158], [154, 154], [236, 136], [350, 132],
            ].map(([cx, cy]) => (
              <circle key={`${cx}-${cy}`} className="lost-mesh-node" cx={cx} cy={cy} r="3" />
            ))}
            <g className="lost-mesh-snap">
              <line x1="174" y1="91" x2="187" y2="113" />
              <line x1="188" y1="91" x2="174" y2="113" />
            </g>
          </svg>

          <div className="lost-mesh-meshi" aria-hidden="true">
            <MeshiLogo size={94} color="blue" mood="surprised" />
          </div>
        </div>

        <h1 className="mx-auto mt-6 max-w-2xl font-display text-3xl font-semibold leading-tight text-[var(--text-primary)] sm:text-5xl">
          Lost in the Mesh
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[var(--text-secondary)] sm:text-base">
          This strand broke or points somewhere that no longer exists. Meshi got a little tangled, but nothing private was exposed.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {actions.map(({ key, label, icon: Icon }) => (
            <Link key={key} href={hrefs[key]} className={cn("lost-mesh-action", key === "home" && "lost-mesh-action-primary")}>
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
