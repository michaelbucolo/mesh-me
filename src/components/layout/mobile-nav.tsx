"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";
import { motion, useAnimationControls } from "framer-motion";
import { cn } from "@/lib/utils";
import { impactFeedback } from "@/lib/native/haptics";
import { getBadgeCount, isNavItemActive, mobileNavItems, resolveNavHref, type NavItem } from "@/components/layout/navigation-config";
import { PlusSquare } from "lucide-react";
import { useKeyboard } from "@/hooks/use-keyboard";

interface MobileNavProps {
  unreadNotifications?: number;
  unreadMessages?: number;
  username?: string;
}

// A springy elastic overshoot for the active tab's icon.
const ELASTIC_POP = { duration: 0.52, ease: [0.34, 1.56, 0.64, 1] as const, times: [0, 0.42, 0.72, 1] };
const PILL_SPRING = { type: "spring" as const, stiffness: 460, damping: 34 };

function MobileNavItem({
  item,
  isActive,
  badgeCount,
  resolvedHref,
}: {
  item: NavItem;
  isActive: boolean;
  badgeCount: number;
  resolvedHref: string;
}) {
  const isMesh = item.href === "/mesh";
  const iconControls = useAnimationControls();
  const wasActive = useRef(isActive);

  // Elastic overshoot the instant a tab becomes the active one (route change),
  // not on every incidental re-render.
  useEffect(() => {
    if (isActive && !wasActive.current) {
      void iconControls.start({ scale: [1, 1.28, 0.9, 1] }, ELASTIC_POP);
    }
    wasActive.current = isActive;
  }, [isActive, iconControls]);

  return (
    <Link
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
      {/* Liquid pill that slides horizontally between tabs via shared layout. */}
      {isActive && (
        <motion.span
          layoutId="mobile-nav-pill"
          transition={PILL_SPRING}
          className="pointer-events-none absolute inset-x-1.5 inset-y-1 rounded-full"
          style={{
            background: "color-mix(in srgb, var(--accent) 22%, transparent)",
            boxShadow: "0 0 16px color-mix(in srgb, var(--accent) 28%, transparent)",
          }}
          aria-hidden="true"
        />
      )}
      <motion.span animate={iconControls} className="relative z-10 flex">
        <item.icon className={cn("h-[22px] w-[22px]", isMesh && "h-[24px] w-[24px]")} aria-hidden="true" />
      </motion.span>
      <span className="sr-only">{item.label}</span>
      {badgeCount > 0 && (
        <motion.span
          key={badgeCount}
          initial={{ scale: 0.4 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 520, damping: 18 }}
          className="absolute right-2 top-1.5 z-10 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[8px] font-semibold text-white"
        >
          {badgeCount > 99 ? "99+" : badgeCount}
        </motion.span>
      )}
    </Link>
  );
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
    "mobile-compose-fab mesh-fab-enter fixed bottom-[calc(5.45rem+env(safe-area-inset-bottom))] right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full text-[var(--compose-fg)] shadow-[var(--shadow-md)] transition-all duration-200 md:hidden",
    isKeyboardVisible && "pointer-events-none translate-y-24 opacity-0",
  );

  return (
    <>
      {/* Bespoke FAB entrance keyframe (spring in, slight rotate). `backwards`
          fill leaves the base transform untouched once done, so the keyboard-hide
          translate keeps working. Self-guards for reduced motion. */}
      <style>{`
        @keyframes meshFabEnter {
          0% { opacity: 0; transform: scale(0.8) rotate(-14deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        .mesh-fab-enter { animation: meshFabEnter 480ms var(--mesh-spring-lush) backwards; }
        @media (prefers-reduced-motion: reduce) {
          .mesh-fab-enter { animation: none; }
        }
      `}</style>
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

            return (
              <MobileNavItem
                key={item.href}
                item={item}
                isActive={isActive}
                badgeCount={badgeCount}
                resolvedHref={resolvedHref}
              />
            );
          })}
        </div>
      </nav>
    </>
  );
}
