"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { impactFeedback } from "@/lib/native/haptics";
import { getBadgeCount, isNavItemActive, resolveNavHref } from "@/components/layout/navigation-config";
import { Bell, MessageCircle, Rss, User, Waypoints } from "lucide-react";
import { usePlatform } from "@/hooks/use-platform";

interface MobileNavProps {
  unreadNotifications?: number;
  unreadMessages?: number;
  username?: string;
}

const mobilePrimaryNav = [
  { href: "/mesh", icon: Waypoints, label: "Mesh" },
  { href: "/feed", icon: Rss, label: "Feed" },
  { href: "/messages", icon: MessageCircle, label: "Messages", badgeKey: "messages" as const },
  { href: "/notifications", icon: Bell, label: "Alerts", badgeKey: "notifications" as const },
  { href: "/profile", icon: User, label: "You" },
];

export function MobileNav({ unreadNotifications = 0, unreadMessages = 0, username }: MobileNavProps) {
  const pathname = usePathname();
  const { ios } = usePlatform();

  const navClass = useMemo(
    () =>
      cn(
        "safe-area-bottom fixed bottom-[max(0.45rem,env(safe-area-inset-bottom))] left-1/2 z-50 w-[calc(100%-0.9rem)] max-w-md -translate-x-1/2 rounded-[1.4rem] border p-1.5 shadow-[var(--shadow-lg)] backdrop-blur-2xl lg:hidden",
        ios
          ? "border-white/10 bg-[color-mix(in_oklab,var(--glass-bg)_78%,transparent)]"
          : "border-[var(--glass-border)] bg-[var(--glass-bg)]"
      ),
    [ios],
  );

  return (
    <nav className={navClass}>
      <div className="grid grid-cols-5 gap-1">
        {mobilePrimaryNav.map((item) => {
          const isActive = isNavItemActive(pathname, item.href, username);
          const badgeCount = getBadgeCount(item.badgeKey, unreadNotifications, unreadMessages);

          return (
            <Link
              key={item.href}
              href={resolveNavHref(item.href, username)}
              onClick={() => impactFeedback("LIGHT")}
              className={cn(
                "relative flex min-h-14 flex-col items-center justify-center rounded-xl px-1 py-2 text-[10px] font-medium transition-all duration-200 active:scale-95",
                isActive
                  ? "bg-[var(--accent-subtle)] text-[var(--accent)]"
                  : "text-[var(--text-muted)] active:bg-[var(--bg-hover)]"
              )}
            >
              <item.icon className={cn("h-[18px] w-[18px]", isActive && "drop-shadow-[0_0_8px_var(--accent)]")} />
              <span className="mt-1 leading-none">{item.label}</span>
              {badgeCount > 0 && (
                <span className="absolute right-2 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[8px] font-bold text-white">
                  {badgeCount > 99 ? "99+" : badgeCount}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
