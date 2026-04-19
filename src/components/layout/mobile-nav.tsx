"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { impactFeedback } from "@/lib/native/haptics";
import { getBadgeCount, isNavItemActive, resolveNavHref } from "@/components/layout/navigation-config";
import { Bell, MessageCircle, Plus, User, Waypoints } from "lucide-react";
import { usePlatform } from "@/hooks/use-platform";
import { useKeyboard } from "@/hooks/use-keyboard";

interface MobileNavProps {
  unreadNotifications?: number;
  unreadMessages?: number;
  username?: string;
}

const mobilePrimaryNav = [
  { href: "/mesh", icon: Waypoints, label: "Mesh" },
  { href: "/messages", icon: MessageCircle, label: "Inbox", badgeKey: "messages" as const },
  { href: "/notifications", icon: Bell, label: "Alerts", badgeKey: "notifications" as const },
  { href: "/profile", icon: User, label: "You" },
];

export function MobileNav({ unreadNotifications = 0, unreadMessages = 0, username }: MobileNavProps) {
  const pathname = usePathname();
  const { ios } = usePlatform();
  const { isKeyboardVisible } = useKeyboard();

  const navClass = useMemo(
    () =>
      cn(
        "safe-area-bottom fixed bottom-[max(0.45rem,env(safe-area-inset-bottom))] left-1/2 z-50 w-[calc(100%-0.9rem)] max-w-md -translate-x-1/2 rounded-[1.55rem] border p-2 shadow-[var(--shadow-lg)] backdrop-blur-2xl transition-all duration-200 lg:hidden",
        ios
          ? "border-white/10 bg-[color-mix(in_oklab,var(--glass-bg)_72%,transparent)]"
          : "border-[var(--glass-border)] bg-[var(--glass-bg)]",
        isKeyboardVisible && "pointer-events-none translate-y-24 opacity-0"
      ),
    [ios, isKeyboardVisible],
  );

  return (
    <nav className={navClass}>
      <div className="grid grid-cols-[1fr_1fr_auto_1fr_1fr] items-center gap-1">
        {mobilePrimaryNav.slice(0, 2).map((item) => {
          const isActive = isNavItemActive(pathname, item.href, username);
          const badgeCount = getBadgeCount(item.badgeKey, unreadNotifications, unreadMessages);

          return (
            <Link
              key={item.href}
              href={resolveNavHref(item.href, username)}
              onClick={() => impactFeedback("LIGHT")}
              className={cn(
                "relative flex min-h-14 flex-col items-center justify-center rounded-xl px-1 text-[10px] font-medium transition-all duration-200 active:scale-95",
                isActive ? "bg-[var(--accent-subtle)] text-[var(--accent)]" : "text-[var(--text-muted)] active:bg-[var(--bg-hover)]"
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

        <Link
          href="/innovation"
          onClick={() => impactFeedback("MEDIUM")}
          className="mx-1 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand-gradient)] text-white shadow-[0_10px_22px_rgba(0,210,255,0.35)] active:scale-95"
          aria-label="Create"
        >
          <Plus className="h-5 w-5" />
        </Link>

        {mobilePrimaryNav.slice(2).map((item) => {
          const isActive = isNavItemActive(pathname, item.href, username);
          const badgeCount = getBadgeCount(item.badgeKey, unreadNotifications, unreadMessages);

          return (
            <Link
              key={item.href}
              href={resolveNavHref(item.href, username)}
              onClick={() => impactFeedback("LIGHT")}
              className={cn(
                "relative flex min-h-14 flex-col items-center justify-center rounded-xl px-1 text-[10px] font-medium transition-all duration-200 active:scale-95",
                isActive ? "bg-[var(--accent-subtle)] text-[var(--accent)]" : "text-[var(--text-muted)] active:bg-[var(--bg-hover)]"
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
