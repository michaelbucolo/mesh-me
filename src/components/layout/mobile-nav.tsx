"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { impactFeedback } from "@/lib/native/haptics";
import { getBadgeCount, isNavItemActive, mobileNavItems, resolveNavHref } from "@/components/layout/navigation-config";
import { PlusSquare } from "lucide-react";
import { useKeyboard } from "@/hooks/use-keyboard";

interface MobileNavProps {
  unreadNotifications?: number;
  unreadMessages?: number;
  username?: string;
}

export function MobileNav({ unreadNotifications = 0, unreadMessages = 0, username }: MobileNavProps) {
  const pathname = usePathname();
  const { isKeyboardVisible } = useKeyboard();

  const navClass = useMemo(
    () =>
      cn(
        "safe-area-bottom mobile-bottom-nav fixed bottom-0 left-0 right-0 z-50 w-full border-t border-[var(--mesh-border)] bg-[var(--mesh-bg)]/96 backdrop-blur-xl transition-all duration-200 md:hidden",
        isKeyboardVisible && "pointer-events-none translate-y-24 opacity-0"
      ),
    [isKeyboardVisible],
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
          {mobileNavItems.map((item) => {
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
