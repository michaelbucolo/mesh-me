"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Accessibility, Keyboard, Navigation, PenSquare, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { openCommandPalette } from "@/components/layout/command-palette";
import { Modal } from "@/components/ui/modal";
import { openMeshi } from "@/lib/meshi-events";
import { SPRING_PANEL } from "@/lib/motion";

const SHORTCUTS_EVENT = "mesh:open-keyboard-shortcuts";
const SEQUENCE_TIMEOUT_MS = 1200;
const OVERLAY_SPRING = SPRING_PANEL;

type Shortcut = {
  keys: string[];
  label: string;
  description?: string;
  action?: ShortcutAction;
};

type ShortcutAction =
  | "home"
  | "mesh"
  | "search"
  | "messages"
  | "notifications"
  | "profile"
  | "settings"
  | "compose"
  | "studio"
  | "contentHub"
  | "meshi"
  | "commandPalette";

type ShortcutGroup = {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  shortcuts: Shortcut[];
};

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;

  return Boolean(
    target.closest("input, textarea, select, [contenteditable='true'], [role='textbox']"),
  );
}

function shortcutKey(value: string) {
  return (
    <kbd
      key={value}
      className="inline-flex min-h-7 min-w-7 items-center justify-center rounded-md border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-2 text-xs font-semibold text-[var(--text-primary)] shadow-sm"
    >
      {value}
    </kbd>
  );
}

const shortcutGroups: ShortcutGroup[] = [
  {
    title: "Navigation",
    description: "Press G, then the destination key.",
    icon: Navigation,
    shortcuts: [
      { keys: ["G", "H"], label: "Home feed", description: "Go to the unified feed.", action: "home" },
      { keys: ["G", "M"], label: "The Mesh", description: "Open the full-screen Mesh dashboard.", action: "mesh" },
      { keys: ["G", "S"], label: "Search", description: "Find people, posts, and connected content.", action: "search" },
      { keys: ["G", "I"], label: "MeChat", description: "Open conversations and shared sessions.", action: "messages" },
      { keys: ["G", "N"], label: "Notifications", description: "Open the Notification Center.", action: "notifications" },
      { keys: ["G", "P"], label: "Profile", description: "Open your public identity page.", action: "profile" },
      { keys: ["G", ","], label: "Settings", description: "Open account, privacy, and Meshi controls.", action: "settings" },
    ],
  },
  {
    title: "Search",
    description: "Jump to the internet index quickly.",
    icon: Search,
    shortcuts: [
      { keys: ["/"], label: "Open search", description: "Works anywhere outside text fields.", action: "search" },
      { keys: ["Ctrl", "K"], label: "Command palette", description: "Use Cmd+K on macOS. Type a destination, action, or setting.", action: "commandPalette" },
      { keys: ["G", "S"], label: "Go to Search", description: "Same destination from navigation mode.", action: "search" },
    ],
  },
  {
    title: "Composer",
    description: "Create or manage content with fewer clicks.",
    icon: PenSquare,
    shortcuts: [
      { keys: ["C"], label: "New post", description: "Open the feed composer.", action: "compose" },
      // Quick capture and deliberate publishing are different intents; both
      // get one keystroke. G,C rides the navigation prefix because the Studio
      // is a PLACE (composer + schedule + queue), not a popover.
      { keys: ["G", "C"], label: "Post everywhere", description: "Open the Publish Studio — every platform, now or scheduled.", action: "studio" },
      { keys: ["Shift", "C"], label: "One Account", description: "Manage every platform threading into your mesh.me account.", action: "contentHub" },
      { keys: ["A"], label: "Ask Meshi", description: "Open the single Meshi companion.", action: "meshi" },
    ],
  },
  {
    title: "Accessibility",
    description: "Core keyboard behavior for moving safely through the app.",
    icon: Accessibility,
    shortcuts: [
      { keys: ["?"], label: "Open this panel", description: "Available outside text fields." },
      { keys: ["Esc"], label: "Close panel", description: "Dismiss shortcuts or active dialogs." },
      { keys: ["Tab"], label: "Next control", description: "Move through buttons, fields, and links." },
      { keys: ["Shift", "Tab"], label: "Previous control", description: "Move backward through controls." },
      { keys: ["Enter"], label: "Activate", description: "Open the focused link or press the focused button." },
    ],
  },
];

function ShortcutRow({ shortcut, onAction }: { shortcut: Shortcut; onAction: (action: ShortcutAction) => void }) {
  const content = (
    <>
      <span className="flex min-w-0 flex-col text-left">
        <span className="text-sm font-semibold text-[var(--text-primary)]">{shortcut.label}</span>
        {shortcut.description ? (
          <span className="text-xs leading-5 text-[var(--text-muted)]">{shortcut.description}</span>
        ) : null}
      </span>
      <span className="ml-auto flex shrink-0 flex-wrap justify-end gap-1.5" aria-hidden="true">
        {shortcut.keys.map(shortcutKey)}
      </span>
    </>
  );

  if (!shortcut.action) {
    return <div className="keyboard-shortcut-row">{content}</div>;
  }

  return (
    /* An actionable shortcut row stays a ROW — it sits in a --bg-secondary group
       card with two to five siblings, and a list of rows is a place, not a rack
       of keys (globals.css:4894-4897 is explicit about this: rows are `.leaf`,
       and that is what keeps a viewport under the plinth cap).
       What is removed is the two bits of motion that contradicted the press
       model in the rest of the product: `whileHover={{ x: 2 }}` slid the row
       sideways when the pointer merely crossed it — the same 2px sideways slide
       globals.css:7654-7656 deleted from `.insta-rail-link` for being "a control
       that goes somewhere; a row is a place" — and `whileTap={{ scale: 0.98 }}`
       shrank it AWAY from the finger, the precise opposite of a key bottoming
       out (globals.css:7466-7469). The row still answers, by brightening. */
    <motion.button
      type="button"
      onClick={() => onAction(shortcut.action as ShortcutAction)}
      transition={OVERLAY_SPRING}
      className="keyboard-shortcut-row keyboard-shortcut-row-action"
    >
      {content}
    </motion.button>
  );
}

function ShortcutGroupCard({ group, onAction, index }: { group: ShortcutGroup; onAction: (action: ShortcutAction) => void; index: number }) {
  const Icon = group.icon;

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...OVERLAY_SPRING, delay: 0.05 * index }}
      className="plate p-3 sm:p-4"
    >
      <div className="mb-3 flex items-start gap-3">
        <motion.span
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 480, damping: 20, delay: 0.05 * index + 0.05 }}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-subtle)] text-[var(--accent-text)]"
        >
          <Icon className="h-4 w-4" aria-hidden />
        </motion.span>
        <span className="min-w-0">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{group.title}</h3>
          <p className="mt-0.5 text-xs leading-5 text-[var(--text-muted)]">{group.description}</p>
        </span>
      </div>
      <div className="grid gap-2">
        {group.shortcuts.map((shortcut) => (
          <ShortcutRow key={`${group.title}-${shortcut.label}`} shortcut={shortcut} onAction={onAction} />
        ))}
      </div>
    </motion.section>
  );
}

export function openKeyboardShortcutsOverlay() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SHORTCUTS_EVENT));
}

export function KeyboardShortcutsOverlay({ username }: { username: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sequenceActive, setSequenceActive] = useState(false);
  const sequenceActiveRef = useRef(false);
  const sequenceTimerRef = useRef<number | null>(null);

  const closeOverlay = useCallback(() => setOpen(false), []);

  const clearSequence = useCallback(() => {
    sequenceActiveRef.current = false;
    setSequenceActive(false);
    if (sequenceTimerRef.current !== null) {
      window.clearTimeout(sequenceTimerRef.current);
      sequenceTimerRef.current = null;
    }
  }, []);

  const navigate = useCallback((href: string) => {
    clearSequence();
    setOpen(false);
    router.push(href);
  }, [clearSequence, router]);

  const runAction = useCallback((action: ShortcutAction) => {
    if (action === "commandPalette") {
      clearSequence();
      setOpen(false);
      openCommandPalette();
      return;
    }

    if (action === "meshi") {
      clearSequence();
      setOpen(false);
      openMeshi("actions");
      return;
    }

    const actionHref: Record<Exclude<ShortcutAction, "meshi" | "commandPalette">, string> = {
      home: "/feed",
      mesh: "/mesh",
      search: "/search",
      messages: "/messages",
      notifications: "/notifications",
      profile: `/profile/${username}`,
      settings: "/settings",
      compose: "/feed?compose=true",
      studio: "/compose",
      contentHub: "/connected-accounts",
    };

    navigate(actionHref[action]);
  }, [clearSequence, navigate, username]);

  const navigationMap = useMemo<Record<string, ShortcutAction>>(
    () =>
      ({
        h: "home",
        m: "mesh",
        s: "search",
        i: "messages",
        n: "notifications",
        p: "profile",
        c: "studio",
        ",": "settings",
      }),
    [],
  );

  useEffect(() => {
    const onOpenShortcuts = () => setOpen(true);
    window.addEventListener(SHORTCUTS_EVENT, onOpenShortcuts);
    return () => window.removeEventListener(SHORTCUTS_EVENT, onOpenShortcuts);
  }, []);

  useEffect(() => {
    return () => clearSequence();
  }, [clearSequence]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if (event.key === "Escape") {
        if (open) {
          event.preventDefault();
          setOpen(false);
        }
        clearSequence();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && key === "k") {
        event.preventDefault();
        runAction("commandPalette");
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) {
        return;
      }

      if (event.key === "?") {
        event.preventDefault();
        setOpen(true);
        clearSequence();
        return;
      }

      if (event.key === "/") {
        event.preventDefault();
        runAction("search");
        return;
      }

      if (sequenceActiveRef.current) {
        const action = navigationMap[key];
        event.preventDefault();
        if (action) runAction(action);
        else clearSequence();
        return;
      }

      if (key === "g") {
        event.preventDefault();
        sequenceActiveRef.current = true;
        setSequenceActive(true);
        if (sequenceTimerRef.current !== null) window.clearTimeout(sequenceTimerRef.current);
        sequenceTimerRef.current = window.setTimeout(clearSequence, SEQUENCE_TIMEOUT_MS);
        return;
      }

      if (event.key === "C" && event.shiftKey) {
        event.preventDefault();
        runAction("contentHub");
        return;
      }

      if (key === "c") {
        event.preventDefault();
        runAction("compose");
        return;
      }

      if (key === "a") {
        event.preventDefault();
        runAction("meshi");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [clearSequence, navigationMap, open, runAction]);

  return (
    <>
      <Modal
        open={open}
        onClose={closeOverlay}
        title="Keyboard shortcuts"
        description="Move around Mesh.me without taking your hands off the keyboard."
        className="max-w-4xl"
      >
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent-subtle)] text-[var(--accent-text)]">
                <Keyboard className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--text-primary)]">Press ? anytime outside a text field.</p>
                <p className="text-xs leading-5 text-[var(--text-muted)]">Use G as a navigation prefix, or click any actionable row below.</p>
              </div>
            </div>
            <Badge variant="accent">Your World, Your Way</Badge>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {shortcutGroups.map((group, index) => (
              <ShortcutGroupCard key={group.title} group={group} onAction={runAction} index={index} />
            ))}
          </div>

          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={closeOverlay} leftIcon={<X className="h-4 w-4" aria-hidden />}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      <motion.div
        className="pointer-events-none fixed left-1/2 top-4 z-[90] rounded-full border border-[var(--border-primary)] bg-[var(--bg-primary)]/95 px-3 py-2 text-xs font-semibold text-[var(--text-primary)] shadow-[var(--shadow-md)] backdrop-blur"
        style={{ x: "-50%" }}
        initial={false}
        animate={sequenceActive ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: -12, scale: 0.96 }}
        transition={OVERLAY_SPRING}
        role="status"
        aria-live="polite"
      >
        <span className="mr-2 text-[var(--accent-text)]">G</span>
        <span className="text-[var(--text-muted)]">then H, M, S, I, N, P, or ,</span>
      </motion.div>
    </>
  );
}
