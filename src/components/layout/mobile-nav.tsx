"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Waypoints, MessageCircle, Bell, User, Compass, Rss } from "lucide-react";
import { impactFeedback } from "@/lib/native/haptics";

interface MobileNavProps {
  unreadNotifications?: number;
  unreadMessages?: number;
  username?: string;
}

export function MobileNav({ unreadNotifications = 0, unreadMessages = 0, username }: MobileNavProps) {
  const pathname = usePathname();

  const items = [
    { href: "/mesh", icon: Waypoints, label: "Mesh" },
    { href: "/feed", icon: Rss, label: "Feed" },
    { href: "/explore", icon: Compass, label: "Explore" },
    { href: "/messages", icon: MessageCircle, label: "Chat", badge: unreadMessages },
    { href: "/notifications", icon: Bell, label: "Alerts", badge: unreadNotifications },
    { href: username ? `/profile/${username}` : "/profile", icon: User, label: "Profile" },
  ];

  return (
    <nav className="safe-area-bottom fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 z-50 w-[calc(100%-1rem)] max-w-xl -translate-x-1/2 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-1.5 shadow-[var(--shadow-lg)] backdrop-blur-2xl lg:hidden">
      <div className="grid grid-cols-6 gap-0.5">
        {items.map((item) => {
          const isActive = item.label === "Profile"
            ? pathname.includes(`/profile/${username}`)
            : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => impactFeedback("LIGHT")}
              className={cn(
                "relative flex flex-col items-center justify-center rounded-xl px-1 py-2 text-[9px] font-medium transition-all active:scale-95",
                isActive ? "bg-[var(--accent-subtle)] text-[var(--accent)]" : "text-[var(--text-muted)]"
              )}
            >
              <item.icon className="h-[17px] w-[17px]" />
              <span className="mt-0.5">{item.label}</span>
              {item.badge && item.badge > 0 && (
                <span className="absolute right-1 top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-500 px-0.5 text-[7px] font-bold text-white">
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
