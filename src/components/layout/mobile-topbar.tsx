"use client";

import Link from "next/link";
import { Bot, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlatform } from "@/hooks/use-platform";
import { MeshiPresenceGlyph } from "@/components/meshi/meshi-presence-glyph";
import { openMeshi } from "@/lib/meshi-events";

interface MobileTopbarProps {
  username: string;
}

export function MobileTopbar({ username }: MobileTopbarProps) {
  const { ios } = usePlatform();

  return (
    <header
      className={cn(
        "safe-area-top sticky top-0 z-40 border-b border-[var(--border-primary)] px-3 py-2 lg:hidden",
        ios ? "bg-[var(--bg-primary)]/95" : "bg-[var(--bg-primary)]/95"
      )}
    >
      <div className="mx-auto flex w-full max-w-md justify-end">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openMeshi("speech")}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-secondary)]"
              aria-label="Ask Meshi"
            >
              <Bot className="h-4 w-4" />
            </button>
            <Link
              href="/search"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-secondary)]"
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
            </Link>
            <Link
              href={`/profile/${username}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-3 text-xs font-medium text-[var(--text-secondary)]"
              aria-label="Open your Meshi profile"
            >
              <MeshiPresenceGlyph size={16} />
              Your Meshi
            </Link>
          </div>
      </div>
    </header>
  );
}
