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
    /* A FLAT tab bar, not a row of keys. The previous pass made each tab a
       `.key` — five boxed faces with edge rings in a row, which photographs
       as a keyboard, not as navigation; no native tab bar (iOS, X, Instagram)
       boxes its tabs. The bar's own top hairline and mat are the boundary;
       WITHIN it, tabs are icon + label, and the active one is stated by ink
       (--accent-text, the contrast-measured ink for the mat) on both icon
       and label plus aria-current — never by a filled box. Labels are back
       because icon-only navigation makes people guess: every native tab bar
       ships ~10px labels under the glyphs. */
    <Link
      href={resolvedHref}
      onClick={() => impactFeedback("LIGHT")}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "relative flex min-h-[52px] flex-col items-center justify-center gap-0.5 px-1",
        isActive ? "text-[var(--accent-text)]" : "text-[var(--text-muted)]",
      )}
    >
      <motion.span animate={iconControls} className="relative flex">
        <item.icon className="h-[23px] w-[23px]" aria-hidden="true" />
        {badgeCount > 0 && (
          <motion.span
            key={badgeCount}
            initial={{ scale: 0.4 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 520, damping: 18 }}
            /* --accent-ink is the pinned ink for an --accent fill (tokens.css). */
            className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-micro font-semibold text-[var(--accent-ink)]"
          >
            {badgeCount > 99 ? "99+" : badgeCount}
          </motion.span>
        )}
      </motion.span>
      <span className="text-[0.625rem] font-medium leading-none">{item.label}</span>
    </Link>
  );
}

export function MobileNav({ unreadNotifications = 0, unreadMessages = 0, username }: MobileNavProps) {
  const pathname = usePathname();
  const { isKeyboardVisible } = useKeyboard();

  const navClass = useMemo(
    () =>
      cn(
        "safe-area-bottom mobile-bottom-nav fixed bottom-0 left-0 right-0 z-50 w-full border-t border-[var(--mesh-border)] transition-all duration-200 md:hidden",
        isKeyboardVisible && "pointer-events-none translate-y-24 opacity-0"
      ),
    [isKeyboardVisible],
  );

  // The FAB keeps its class rather than gaining `.key` — `.mobile-compose-fab`
  // is pinned by `!important` blocks in globals.css that `.key` cannot outrank.
  const composeClass = cn(
    "mobile-compose-fab mesh-fab-enter fixed bottom-[calc(5.45rem+env(safe-area-inset-bottom))] right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full transition-all duration-200 md:hidden",
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
          onClick={() => impactFeedback("MEDIUM")}
          className={composeClass}
          aria-label="Create post"
          title="Create post"
        >
          <PlusSquare className="h-[24px] w-[24px]" aria-hidden="true" />
        </Link>
      )}
      <nav className={navClass} aria-label="Primary mobile navigation">
        <div className="grid grid-cols-5 items-center">
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
