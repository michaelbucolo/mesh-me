"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { Bell, MessageCircle, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlatform } from "@/hooks/use-platform";

interface MobileTopbarProps {
  unreadNotifications: number;
  unreadMessages: number;
}

const routeTitles: Record<string, string> = {
  "/mesh": "Mesh",
  "/feed": "Feed",
  "/explore": "Explore",
  "/messages": "Messages",
  "/notifications": "Notifications",
  "/communities": "Communities",
  "/innovation": "Create",
  "/settings": "Settings",
};

export function MobileTopbar({ unreadNotifications, unreadMessages }: MobileTopbarProps) {
  const pathname = usePathname();
  const { ios } = usePlatform();

  const title = useMemo(() => {
    const firstSegment = `/${pathname.split("/").filter(Boolean)[0] ?? ""}`;
    return routeTitles[pathname] ?? routeTitles[firstSegment] ?? "mesh.me";
  }, [pathname]);

  return (
    <header
      className={cn(
        "safe-area-top sticky top-0 z-40 border-b border-[var(--glass-border)] px-4 pb-3 pt-2 backdrop-blur-2xl lg:hidden",
        ios ? "bg-[color-mix(in_oklab,var(--glass-bg)_74%,transparent)]" : "bg-[var(--glass-bg)]/90"
      )}
    >
      <div className="mx-auto flex w-full max-w-md items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">mesh.me</p>
          <h1 className="truncate text-base font-semibold text-[var(--text-primary)]">{title}</h1>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/search"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/60 text-[var(--text-secondary)]"
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
          </Link>
          {[
            { href: "/messages", icon: MessageCircle, count: unreadMessages, label: "Messages" },
            { href: "/notifications", icon: Bell, count: unreadNotifications, label: "Notifications" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/60 text-[var(--text-secondary)]"
              aria-label={item.label}
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
