"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { Bell, CalendarDays, Command, MessageCircle, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface PremiumTopbarProps {
  unreadNotifications: number;
  unreadMessages: number;
  onOpenCommandCenter: () => void;
}

const routeMeta: Record<string, { title: string; subtitle: string }> = {
  "/mesh": { title: "The Mesh", subtitle: "Map your identity graph in real time" },
  "/feed": { title: "Creator Feed", subtitle: "Curated momentum from your universe" },
  "/explore": { title: "Explore", subtitle: "Discover creators, communities, and ideas" },
  "/messages": { title: "MeChat", subtitle: "Conversations that keep your network alive" },
  "/notifications": { title: "Notifications", subtitle: "Signals that deserve your attention" },
  "/communities": { title: "Communities", subtitle: "Your spaces for intentional growth" },
  "/settings": { title: "Settings", subtitle: "Tune every layer of your experience" },
};

export function PremiumTopbar({ unreadNotifications, unreadMessages, onOpenCommandCenter }: PremiumTopbarProps) {
  const pathname = usePathname();

  const meta = useMemo(() => {
    const firstSegment = `/${pathname.split("/").filter(Boolean)[0] ?? ""}`;
    return routeMeta[pathname] ?? routeMeta[firstSegment] ?? {
      title: "mesh.me",
      subtitle: "A premium social command center",
    };
  }, [pathname]);

  const today = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        weekday: "short",
      }).format(new Date()),
    [],
  );

  return (
    <header className="sticky top-0 z-30 hidden shrink-0 border-b border-[var(--glass-border)] bg-[var(--glass-bg)]/80 px-5 py-3 backdrop-blur-2xl lg:block">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">Premium Workspace</p>
          <h1 className="truncate text-lg font-semibold text-[var(--text-primary)]">{meta.title}</h1>
          <p className="truncate text-xs text-[var(--text-secondary)]">{meta.subtitle}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenCommandCenter}
            className="group inline-flex items-center gap-2 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/50 px-3 py-2 text-xs text-[var(--text-secondary)] transition hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
          >
            <Search className="h-3.5 w-3.5" />
            Search or jump
            <span className="inline-flex items-center gap-1 rounded-md border border-[var(--border-primary)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-muted)]">
              <Command className="h-3 w-3" />K
            </span>
          </button>

          <span className="inline-flex items-center gap-1 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/40 px-3 py-2 text-xs text-[var(--text-secondary)]">
            <CalendarDays className="h-3.5 w-3.5" />
            {today}
          </span>

          <Link
            href="/trust"
            className="inline-flex items-center rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/40 px-3 py-2 text-xs text-[var(--text-secondary)] transition hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
            title="Trust Center"
          >
            Privacy &amp; security
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
      </div>
    </header>
  );
}
