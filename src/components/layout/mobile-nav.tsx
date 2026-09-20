"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { motion, useAnimationControls, useReducedMotion } from "framer-motion";
import { SPRING_PANEL } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { getBadgeCount, isNavItemActive, primaryNavItems, resolveNavHref, type NavItem } from "@/components/layout/navigation-config";
import { PlusSquare } from "lucide-react";
import { useKeyboard } from "@/hooks/use-keyboard";

interface MobileNavProps {
  unreadNotifications?: number;
  unreadMessages?: number;
  username?: string;
}

// A springy elastic overshoot for the active tab's icon.
const ELASTIC_POP = { duration: 0.52, ease: [0.34, 1.56, 0.64, 1] as const, times: [0, 0.42, 0.72, 1] };

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
  const iconControls = useAnimationControls();
  const reduceMotion = useReducedMotion();
  const wasActive = useRef(isActive);

  // Elastic overshoot the instant a tab becomes the active one (route change),
  // not on every incidental re-render.
  useEffect(() => {
    if (isActive && !wasActive.current && !reduceMotion) {
      void iconControls.start({ scale: [1, 1.28, 0.9, 1] }, ELASTIC_POP);
    }
    wasActive.current = isActive;
  }, [isActive, iconControls, reduceMotion]);

  return (
    /* Labels stay visible; the shared indicator and aria-current identify the
       active destination without relying on color alone. */
    <Link
      href={resolvedHref}
      data-feedback="navigate"
      aria-current={isActive ? "page" : undefined}
      aria-label={badgeCount > 0 ? `${item.label}, ${badgeCount} unread ${item.badgeKey}` : item.label}
      className={cn(
        "mesh-mobile-nav-item relative flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-xl px-1",
        isActive ? "text-[var(--accent-text)]" : "text-[var(--text-muted)]",
      )}
    >
      {isActive && <motion.span layoutId="mobile-nav-indicator" transition={reduceMotion ? { duration: 0 } : SPRING_PANEL} className="mesh-mobile-active" aria-hidden="true" />}
      <motion.span animate={iconControls} className="relative flex">
        <item.icon className="h-[23px] w-[23px]" aria-hidden="true" />
        {badgeCount > 0 && (
          <motion.span
            key={badgeCount}
            initial={reduceMotion ? false : { scale: 0.4 }}
            animate={{ scale: 1 }}
            transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 18 }}
            /* --accent-ink is the pinned ink for an --accent fill (tokens.css). */
            className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-micro font-semibold text-[var(--accent-ink)]"
            aria-hidden="true"
          >
            {badgeCount > 99 ? "99+" : badgeCount}
          </motion.span>
        )}
      </motion.span>
      <span className="relative text-micro font-medium leading-none">{item.label}</span>
    </Link>
  );
}

export function MobileNav({ unreadNotifications = 0, unreadMessages = 0, username }: MobileNavProps) {
  const pathname = usePathname();
  const { isKeyboardVisible } = useKeyboard();

  const navClass = cn(
    "safe-area-bottom mobile-bottom-nav fixed bottom-0 left-0 right-0 z-50 w-full border-t border-[var(--mesh-border)] transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-200 motion-reduce:transition-none md:hidden",
    isKeyboardVisible && "pointer-events-none translate-y-24 opacity-0",
  );

  // The FAB keeps its class rather than gaining `.key` — `.mobile-compose-fab`
  // is pinned by `!important` blocks in globals.css that `.key` cannot outrank.
  const composeClass = cn(
    "mobile-compose-fab mesh-fab-enter fixed bottom-[calc(5.45rem+env(safe-area-inset-bottom))] right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-200 motion-reduce:transition-none md:hidden",
    isKeyboardVisible && "pointer-events-none translate-y-24 opacity-0",
  );

  /* The FAB is the FEED's compose action, and it only renders on the feed.
     As a global overlay it floated over every surface — photographed covering
     Trail's serpentine labels at 390 and sitting beside MeChat's own compose
     key as a second, differently-shaped compose that makes a different kind
     of post. Surfaces with their own primary keep their own. */
  const showComposeFab = pathname === "/feed";

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
      {showComposeFab && (
        <Link
          href="/feed?compose=true"
          data-feedback="navigate"
          className={composeClass}
          aria-label="Create post"
          aria-hidden={isKeyboardVisible || undefined}
          tabIndex={isKeyboardVisible ? -1 : undefined}
          title="Create post"
        >
          <PlusSquare className="h-[24px] w-[24px]" aria-hidden="true" />
        </Link>
      )}
      <nav className={navClass} aria-label="Primary mobile navigation" inert={isKeyboardVisible} aria-hidden={isKeyboardVisible || undefined}>
        <div className="grid grid-cols-5 items-center">
          {primaryNavItems.map((item) => {
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
