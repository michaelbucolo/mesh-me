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

// Six domains, six plastics — the SAME assignment the sidebar already ships at
// globals.css:7370-7375 (`.mesh-nav-item[href="/mesh"] { --domain: … }`), keyed
// on the unresolved `item.href` so /profile still matches after
// resolveNavHref() has expanded it to /profile/<username>. Colour is WHICH tab,
// never how loud: every triple below is pinned in tokens.css:87-93, so the ink
// that rides with each fill is contrast-verified rather than guessed.
const TAB_MOULD: Record<string, string> = {
  "/mesh": "[--mould:var(--mould-tomato)] [--mould-ink:var(--mould-tomato-ink)] [--mould-plinth:var(--mould-tomato-plinth)]",
  "/flow": "[--mould:var(--mould-cobalt)] [--mould-ink:var(--mould-cobalt-ink)] [--mould-plinth:var(--mould-cobalt-plinth)]",
  "/messages": "[--mould:var(--mould-jade)] [--mould-ink:var(--mould-jade-ink)] [--mould-plinth:var(--mould-jade-plinth)]",
  "/explore": "[--mould:var(--mould-grape)] [--mould-ink:var(--mould-grape-ink)] [--mould-plinth:var(--mould-grape-plinth)]",
  "/profile": "[--mould:var(--mould-teal)] [--mould-ink:var(--mould-teal-ink)] [--mould-plinth:var(--mould-teal-plinth)]",
};

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
    /* THE FIVE TABS HAD NO MATERIAL AT ALL — a radius, a text colour, and an
       `active:bg` tint. No face, no --edge ring (so no WCAG 1.4.11 boundary on
       the primary navigation of the whole mobile app), and no side wall. They
       are `.key` now (globals.css:4942), and the active one is `.key-lit`
       (globals.css:4996) moulded from its own domain plastic.

       The `layoutId="mobile-nav-pill"` sliding highlight is GONE with it. It was
       `color-mix(--accent 22%)` under `boxShadow: 0 0 16px color-mix(--accent
       28%)` — a translucent tint plus a literal glow, i.e. the active state was
       carried by brightness. Emphasis here is material and plinth, never
       saturation, so the highlight has nothing left to say; laid over an opaque
       `--face` it would only have muddied it. The elastic icon pop on route
       change is untouched — that is content arriving, not ambient motion.

       Tailwind's `rounded-full` / `transition-all` / `active:bg-*` are deleted
       rather than left: this file's CSS is unlayered and Tailwind's utilities
       are in `@layer utilities`, so `.key` already beat all three and they were
       markup that read as if it still did something. */
    <Link
      href={resolvedHref}
      onClick={() => impactFeedback("LIGHT")}
      aria-current={isActive ? "page" : undefined}
      aria-label={item.label}
      title={item.label}
      className={cn(
        "key relative flex min-h-12 items-center justify-center px-1",
        isActive
          ? cn("key-lit", TAB_MOULD[item.href])
          : "text-[var(--text-muted)]",
      )}
    >
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
          /* `text-white` on `bg-[var(--accent)]` measures ~1.9:1 in Worklight,
             where --accent is #93a9ff (tokens.css:194). --accent-ink is the
             pinned ink for that fill (tokens.css:69, 197). */
          className="absolute right-2 top-1.5 z-10 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[8px] font-semibold text-[var(--accent-ink)]"
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
        // `backdrop-blur-xl` removed: backdrop-filter is banned system-wide, and
        // globals.css:4202-4210 already cancels it with `backdrop-filter: none
        // !important` — so the utility was naming a property it never got. The
        // translucent `bg-[var(--mesh-bg)]/96` went with it for the same reason;
        // that same block forces `background: var(--bg-primary) !important`, an
        // opaque mat, which is what a row of keys has to sit on.
        "safe-area-bottom mobile-bottom-nav fixed bottom-0 left-0 right-0 z-50 w-full border-t border-[var(--mesh-border)] transition-all duration-200 md:hidden",
        isKeyboardVisible && "pointer-events-none translate-y-24 opacity-0"
      ),
    [isKeyboardVisible],
  );

  // The FAB keeps its class rather than gaining `.key`, and that is deliberate:
  // `.mobile-compose-fab` is pinned by three `!important` blocks
  // (globals.css:4096-4103, 4106-4112, 4114-4121) that `.key` cannot outrank on
  // specificity, and `.key`'s --radius-md would square off a round FAB. The
  // material it was missing — the --edge ring, the cobalt side wall, and a press
  // that replaces the `translateY(-1px)` hover LIFT at :4110 — arrives as an
  // `!important` block appended after those three. `shadow-[var(--shadow-md)]`
  // and `text-[var(--compose-fg)]` are dropped here because :4102 and :4118
  // already overrode both; they were dead.
  const composeClass = cn(
    "mobile-compose-fab mesh-fab-enter fixed bottom-[calc(5.45rem+env(safe-area-inset-bottom))] right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full transition-all duration-200 md:hidden",
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
