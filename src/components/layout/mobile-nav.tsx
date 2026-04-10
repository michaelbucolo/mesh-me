"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Waypoints, MessageCircle, Bell, User, Compass } from "lucide-react";

interface MobileNavProps {
  unreadNotifications?: number;
  username?: string;
}

export function MobileNav({ unreadNotifications = 0, username }: MobileNavProps) {
  const pathname = usePathname();

  const items = [
    { href: "/mesh", icon: Waypoints, label: "Mesh" },
    { href: "/explore", icon: Compass, label: "Explore" },
    { href: "/feed", icon: MessageCircle, label: "Feed" },
    { href: "/notifications", icon: Bell, label: "Alerts", badge: unreadNotifications },
    { href: username ? `/profile/${username}` : "/profile", icon: User, label: "Profile" },
  ];

  return (
    <nav className="safe-area-bottom fixed bottom-3 left-1/2 z-40 w-[calc(100%-1rem)] max-w-xl -translate-x-1/2 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-1.5 shadow-[var(--shadow-lg)] backdrop-blur-2xl lg:hidden">
      <div className="grid grid-cols-5 gap-1">
        {items.map((item) => {
          const isActive = item.href === "/feed"
            ? pathname === "/feed" || pathname.startsWith("/feed")
            : item.href === "/mesh"
              ? pathname === "/mesh"
            : item.label === "Profile"
              ? pathname.includes(`/profile/${username}`)
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex flex-col items-center justify-center rounded-xl px-1.5 py-2 text-[10px] font-medium transition-all active:scale-95",
                isActive ? "bg-[var(--accent-subtle)] text-[var(--accent)]" : "text-[var(--text-muted)]"
              )}
            >
              <item.icon className="h-[18px] w-[18px]" />
              <span className="mt-1">{item.label}</span>
              {item.badge && item.badge > 0 && (
                <span className="absolute right-1.5 top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-500 px-0.5 text-[8px] font-bold text-white">
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
