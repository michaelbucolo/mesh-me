"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { impactFeedback } from "@/lib/native/haptics";
import { getBadgeCount, isNavItemActive, resolveNavHref } from "@/components/layout/navigation-config";
import { Bell, House, MessageCircle, PlusSquare, Search, Waypoints } from "lucide-react";
import { usePlatform } from "@/hooks/use-platform";
import { useKeyboard } from "@/hooks/use-keyboard";

interface MobileNavProps {
  unreadNotifications?: number;
  unreadMessages?: number;
  username?: string;
}

const mobilePrimaryNav = [
  { href: "/feed", icon: House, label: "Home" },
  { href: "/search", icon: Search, label: "Search" },
  { href: "/mesh", icon: Waypoints, label: "Mesh" },
  { href: "/notifications", icon: Bell, label: "Notifications", badgeKey: "notifications" as const },
  { href: "/messages", icon: MessageCircle, label: "MeChat", badgeKey: "messages" as const },
];

export function MobileNav({ unreadNotifications = 0, unreadMessages = 0, username }: MobileNavProps) {
  const pathname = usePathname();
  const { ios } = usePlatform();
  const { isKeyboardVisible } = useKeyboard();

  const navClass = useMemo(
    () =>
      cn(
        "safe-area-bottom mobile-bottom-nav fixed bottom-[max(0.35rem,env(safe-area-inset-bottom))] left-1/2 z-50 w-[calc(100%-0.75rem)] max-w-md -translate-x-1/2 rounded-[1.1rem] border p-1.5 shadow-[var(--shadow-md)] transition-all duration-200 md:hidden",
        ios
          ? "border-[var(--border-primary)] bg-[var(--bg-primary)]/96 backdrop-blur-xl"
          : "border-[var(--border-primary)] bg-[var(--bg-primary)]/96 backdrop-blur-xl",
        isKeyboardVisible && "pointer-events-none translate-y-24 opacity-0"
      ),
    [ios, isKeyboardVisible],
  );

  const composeClass = cn(
    "mobile-compose-fab fixed bottom-[calc(5.45rem+env(safe-area-inset-bottom))] right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full text-[var(--compose-fg)] shadow-[var(--shadow-md)] transition-all duration-200 md:hidden",
    isKeyboardVisible && "pointer-events-none translate-y-24 opacity-0",
  );

  return (
    <>
      <Link
        href="/feed?compose=true"
        onClick={() => impactFeedback("MEDIUM")}
        className={composeClass}
        aria-label="Create post"
        title="Create post"
      >
        <PlusSquare className="h-[24px] w-[24px]" aria-hidden="true" />
      </Link>
      <nav className={navClass} aria-label="Primary mobile navigation">
        <div className="grid grid-cols-5 items-center gap-1">
          {mobilePrimaryNav.map((item) => {
            const isActive = isNavItemActive(pathname, item.href, username);
            const badgeCount = getBadgeCount(item.badgeKey, unreadNotifications, unreadMessages);
            const resolvedHref = resolveNavHref(item.href, username);
            const isMesh = item.href === "/mesh";

            return (
              <Link
                key={item.href}
                href={resolvedHref}
                onClick={() => impactFeedback("LIGHT")}
                aria-current={isActive ? "page" : undefined}
                aria-label={item.label}
                title={item.label}
                className={cn(
                  "relative flex min-h-12 items-center justify-center rounded-full px-1 transition-all duration-150",
                  isActive
                    ? "text-[var(--text-primary)]"
                    : "text-[var(--text-muted)] active:bg-[var(--bg-hover)]",
                  isMesh && "mobile-mesh-slot",
                  isActive && isMesh && "mobile-mesh-slot-active",
                )}
              >
                <item.icon className={cn("h-[22px] w-[22px]", isMesh && "h-[24px] w-[24px]")} aria-hidden="true" />
                <span className="sr-only">{item.label}</span>
                {isActive && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-[var(--text-primary)]" aria-hidden="true" />}
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
    </>
  );
}
