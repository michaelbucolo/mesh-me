"use client";

import Link from "next/link";
import { Bell, MessageCircle, Search, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { openMeshi } from "@/lib/meshi-events";
import { useMeshiPreferences } from "@/hooks/use-meshi-preferences";
import { MeshiMascot } from "@/components/meshi/meshi-mascot";

interface PremiumTopbarProps {
  unreadNotifications: number;
  unreadMessages: number;
  onOpenCommandCenter: () => void;
}

export function PremiumTopbar({ unreadNotifications, unreadMessages, onOpenCommandCenter }: PremiumTopbarProps) {
  const meshiPrefs = useMeshiPreferences();

  return (
    <header className="sticky top-0 z-30 hidden shrink-0 border-b border-[var(--glass-border)] bg-[var(--glass-bg)]/80 px-5 py-2 backdrop-blur-2xl lg:block">
      <div className="flex items-center justify-end gap-2">
        <button
            type="button"
            onClick={onOpenCommandCenter}
            className="group inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/50 text-[var(--text-secondary)] transition hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
            title="Search or jump"
          >
            <Search className="h-4 w-4" />
            <span className="sr-only">Search or jump (Ctrl/Cmd + K)</span>
          </button>

          <button
            type="button"
            onClick={() => openMeshi("speech")}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/40 text-[var(--text-secondary)] transition hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
            title="Talk to Meshi"
          >
            <MeshiMascot
              size={16}
              color={meshiPrefs.color}
              hat={meshiPrefs.hat}
              mood={meshiPrefs.face}
              showGlow={false}
              animate={false}
            />
          </button>

          <Link
            href="/trust"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/40 text-[var(--text-secondary)] transition hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
            title="Trust Center"
          >
            <Shield className="h-4 w-4" />
            <span className="sr-only">Trust Center</span>
          </Link>

        {[{ href: "/messages", icon: MessageCircle, count: unreadMessages }, { href: "/notifications", icon: Bell, count: unreadNotifications }].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "relative inline-flex items-center justify-center rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/40 p-2 text-[var(--text-muted)] transition",
              "hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]",
            )}
            title={item.href === "/messages" ? "Messages" : "Notifications"}
          >
            <item.icon className="h-4 w-4" />
            {item.count > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[8px] font-bold text-white">
                {item.count > 99 ? "99+" : item.count}
              </span>
            )}
          </Link>
        ))}
      </div>
    </header>
  );
}
