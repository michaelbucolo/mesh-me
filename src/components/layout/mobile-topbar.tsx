"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { Bot, Search, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlatform } from "@/hooks/use-platform";
import { useMeshiPreferences } from "@/hooks/use-meshi-preferences";
import { MeshiMascot } from "@/components/meshi/meshi-mascot";
import { openMeshi } from "@/lib/meshi-events";

interface MobileTopbarProps {
  username: string;
}

const routeTitles: Record<string, string> = {
  "/mesh": "Your Mesh",
  "/feed": "Feed",
  "/explore": "Explore",
  "/messages": "Messages",
  "/notifications": "Notifications",
  "/communities": "Communities",
  "/innovation": "Create",
  "/settings": "Settings",
};

export function MobileTopbar({ username }: MobileTopbarProps) {
  const pathname = usePathname();
  const { ios } = usePlatform();
  const meshiPrefs = useMeshiPreferences();

  const title = useMemo(() => {
    const firstSegment = `/${pathname.split("/").filter(Boolean)[0] ?? ""}`;
    return routeTitles[pathname] ?? routeTitles[firstSegment] ?? "mesh.me";
  }, [pathname]);

  const subtitle = pathname === "/mesh" ? "Live map + creator intelligence" : "Built for quick mobile workflows";

  return (
    <header
      className={cn(
        "safe-area-top sticky top-0 z-40 border-b border-[var(--glass-border)] px-3 pb-3 pt-2 backdrop-blur-xl lg:hidden",
        ios ? "bg-[color-mix(in_oklab,var(--glass-bg)_70%,transparent)]" : "bg-[var(--glass-bg)]/95"
      )}
    >
      <div className="mx-auto flex w-full max-w-md flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">mobile workspace</p>
            <h1 className="truncate text-lg font-semibold text-[var(--text-primary)]">{title}</h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openMeshi("speech")}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/70 text-[var(--text-secondary)] active:scale-95"
              aria-label="Ask Meshi"
            >
              <Bot className="h-4 w-4" />
            </button>
            <Link
              href="/search"
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/70 text-[var(--text-secondary)] active:scale-95"
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
            </Link>
            <Link
              href={`/profile/${username}`}
              className="inline-flex h-10 items-center gap-1.5 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/70 px-3 text-xs font-medium text-[var(--text-secondary)] active:scale-95"
              aria-label="Open profile"
            >
              <MeshiMascot
                size={16}
                color={meshiPrefs.color}
                hat={meshiPrefs.hat}
                mood={meshiPrefs.face}
                showGlow={false}
                animate={false}
              />
              You
            </Link>
          </div>
        </div>
        <div className="mobile-topbar-banner inline-flex items-center gap-2 rounded-xl border border-[var(--border-secondary)] px-3 py-2 text-xs text-[var(--text-secondary)]">
          <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
          <span className="truncate">{subtitle}</span>
        </div>
      </div>
    </header>
  );
}
