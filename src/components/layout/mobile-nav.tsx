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

export function MobileNav({
  unreadNotifications = 0,
  unreadMessages = 0,
  username,
}: MobileNavProps) {
  const pathname = usePathname();

  const items = [
    { href: "/mesh", icon: Waypoints, label: "Mesh" },
    { href: "/feed", icon: Rss, label: "Feed" },
    { href: "/explore", icon: Compass, label: "Explore" },
    { href: "/messages", icon: MessageCircle, label: "Chat", badge: unreadMessages },
    { href: "/notifications", icon: Bell, label: "Alerts", badge: unreadNotifications },
    { href: username ? `/profile/${username}` : "/profile", icon: User, label: "Me" },
  ];

  return (
    <nav className="safe-area-bottom fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--border-secondary)] bg-[var(--bg-primary)]/90 backdrop-blur-xl lg:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-6">
        {items.map((item) => {
          const isActive =
            item.label === "Me"
              ? pathname.includes(`/profile/${username}`)
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => impactFeedback("LIGHT")}
              className={cn(
                "relative flex flex-col items-center justify-center py-2 text-[10px] font-medium transition-colors duration-150 active:scale-90",
                isActive
                  ? "text-[var(--text-primary)]"
                  : "text-[var(--text-muted)]"
              )}
            >
              <item.icon
                className={cn("h-5 w-5", isActive && "text-[var(--accent)]")}
              />
              <span className="mt-0.5">{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="absolute right-2 top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-500 px-0.5 text-[7px] font-bold text-white">
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              )}
              {isActive && (
                <span className="absolute -top-px left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-[var(--accent)]" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
