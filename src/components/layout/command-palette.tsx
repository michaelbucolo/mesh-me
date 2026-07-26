"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  BarChart3,
  Bell,
  BookOpen,
  Bug,
  Command,
  CreditCard,
  Database,
  HelpCircle,
  Keyboard,
  Network,
  Palette,
  PenSquare,
  PlugZap,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
  UsersRound,
} from "lucide-react";
import { FlowIcon, MeChatIcon, MeshIcon, ProfileIcon } from "@/components/brand/nav-icons";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { openMeshi } from "@/lib/meshi-events";
import { cn } from "@/lib/utils";

const COMMAND_PALETTE_EVENT = "mesh:open-command-palette";
const BUG_REPORT_EVENT = "mesh:open-bug-report";
const KEYBOARD_SHORTCUTS_EVENT = "mesh:open-keyboard-shortcuts";

const PALETTE_SPRING = { type: "spring" as const, stiffness: 460, damping: 38, mass: 0.7 };
const ROW_SPRING = { type: "spring" as const, stiffness: 520, damping: 40 };

type CommandCategory = "Go" | "Action" | "Settings" | "Help";
type CommandAction = "meshi" | "bugReport" | "shortcuts";

type CommandItem = {
  id: string;
  title: string;
  description: string;
  category: CommandCategory;
  href?: string;
  action?: CommandAction;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  keywords: string[];
};

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9@#?/\s-]/g, " ").replace(/\s+/g, " ").trim();
}

function getSearchText(command: CommandItem) {
  return normalize([
    command.title,
    command.description,
    command.category,
    command.href ?? "",
    command.keywords.join(" "),
  ].join(" "));
}

function createCommands(username: string): CommandItem[] {
  return [
    {
      id: "go-feed",
      title: "Open Home Feed",
      description: "Scroll the unified social feed.",
      category: "Go",
      href: "/feed",
      icon: FlowIcon,
      keywords: ["home", "timeline", "twitter", "x", "instagram", "posts"],
    },
    {
      id: "go-mesh",
      title: "Open The Mesh",
      description: "Go to the full-screen digital footprint dashboard.",
      category: "Go",
      href: "/mesh",
      icon: MeshIcon,
      keywords: ["dashboard", "map", "network", "nodes", "constellation"],
    },
    {
      id: "go-search",
      title: "Open Search",
      description: "Find people, posts, communities, and connected content.",
      category: "Go",
      href: "/search",
      icon: Search,
      keywords: ["internet index", "discover", "find"],
    },
    {
      id: "go-messages",
      title: "Open MeChat",
      description: "Jump to messages, shared posts, and group sessions.",
      category: "Go",
      href: "/messages",
      icon: MeChatIcon,
      keywords: ["chat", "dm", "inbox", "conversation", "call"],
    },
    {
      id: "go-notifications",
      title: "Open Notifications",
      description: "Review notifications, security alerts, and privacy updates.",
      category: "Go",
      href: "/notifications",
      icon: Bell,
      keywords: ["notifications", "alerts", "mentions", "likes", "comments"],
    },
    {
      id: "go-profile",
      title: "Open Profile",
      description: "View your public identity and Meshi presence.",
      category: "Go",
      href: `/profile/${username}`,
      icon: ProfileIcon,
      keywords: ["me", "identity", "bio", "public"],
    },
    {
      id: "go-analytics",
      title: "Open Analytics",
      description: "See engagement, growth, activity, and privacy health.",
      category: "Go",
      href: "/analytics",
      icon: BarChart3,
      keywords: ["stats", "creator", "performance", "privacy score"],
    },
    {
      id: "go-communities",
      title: "Open Communities",
      description: "Find friend, creator, family, and project spaces.",
      category: "Go",
      href: "/communities",
      icon: UsersRound,
      keywords: ["groups", "spaces", "servers"],
    },
    {
      id: "go-connections",
      title: "Open One Account",
      description: "Every platform threading into your one mesh.me account.",
      category: "Go",
      href: "/connected-accounts",
      icon: PlugZap,
      keywords: [
        "youtube", "x", "instagram", "discord", "oauth", "sync",
        "one account", "merge", "consolidate", "unify", "identity", "personas",
      ],
    },
    {
      id: "go-privacy",
      title: "Open Privacy settings",
      description: "Control who sees you, your activity, and read receipts.",
      category: "Go",
      href: "/settings#privacy",
      icon: ShieldCheck,
      keywords: ["security", "data", "privacy", "visibility", "activity", "delete", "export"],
    },
    {
      id: "create-post",
      title: "Create Post",
      description: "Open the composer and publish to Mesh.me.",
      category: "Action",
      href: "/feed?compose=true",
      icon: PenSquare,
      keywords: ["compose", "new", "write", "share"],
    },
    {
      id: "ask-meshi",
      title: "Ask Meshi",
      description: "Open your single companion for help, search, and control.",
      category: "Action",
      action: "meshi",
      icon: Sparkles,
      keywords: ["assistant", "companion", "help", "guide"],
    },
    {
      id: "report-bug",
      title: "Report a Bug",
      description: "Open the bug widget with diagnostics attached.",
      category: "Action",
      action: "bugReport",
      icon: Bug,
      keywords: ["issue", "broken", "problem", "feedback"],
    },
    {
      id: "keyboard-shortcuts",
      title: "Keyboard Shortcuts",
      description: "Show every navigation, search, and composer shortcut.",
      category: "Action",
      action: "shortcuts",
      icon: Keyboard,
      keywords: ["hotkeys", "commands", "keys", "?"],
    },
    {
      id: "settings-account",
      title: "Account Settings",
      description: "Email, sign out, account deletion, and profile basics.",
      category: "Settings",
      href: "/settings#account",
      icon: Settings,
      keywords: ["email", "logout", "sign out", "delete account"],
    },
    {
      id: "settings-profile",
      title: "Profile Settings",
      description: "Update name, bio, links, interests, and accent color.",
      category: "Settings",
      href: "/settings#profile",
      icon: UserRound,
      keywords: ["display name", "bio", "links", "identity"],
    },
    {
      id: "settings-privacy",
      title: "Privacy Settings",
      description: "Control visibility, discovery, read receipts, and sensitive content.",
      category: "Settings",
      href: "/settings#privacy",
      icon: ShieldCheck,
      keywords: ["private", "public", "nsfw", "adult verification"],
    },
    {
      id: "settings-notifications",
      title: "Notification Settings",
      description: "Tune messages, mentions, comments, follows, and product alerts.",
      category: "Settings",
      href: "/settings#notifications",
      icon: Bell,
      keywords: ["alerts", "digest", "email", "push"],
    },
    {
      id: "settings-security",
      title: "Security Settings",
      description: "Review verification, password, sessions, and account protection.",
      category: "Settings",
      href: "/settings#security",
      icon: ShieldCheck,
      keywords: ["password", "sessions", "verification", "safe"],
    },
    {
      id: "settings-mesh",
      title: "Mesh Settings",
      description: "Control Mesh visibility, branches, and visual style.",
      category: "Settings",
      href: "/settings#mesh",
      icon: Network,
      keywords: ["map", "branches", "connections", "visuals"],
    },
    {
      id: "settings-meshi",
      title: "Meshi Studio",
      description: "Customize color, hat, hair, eyes, accessories, badges, and outfits.",
      category: "Settings",
      href: "/settings#meshi",
      icon: Palette,
      keywords: ["avatar", "mascot", "customize", "accessories"],
    },
    {
      id: "settings-appearance",
      title: "Appearance Settings",
      description: "Switch system, dark, light, themes, and color presets.",
      category: "Settings",
      href: "/settings#appearance",
      icon: Palette,
      keywords: ["theme", "dark mode", "light mode", "system"],
    },
    {
      id: "settings-billing",
      title: "Billing Settings",
      description: "Manage MeshPro, payments, invoices, and plan details.",
      category: "Settings",
      href: "/settings#billing",
      icon: CreditCard,
      // A COMPARED string, not copy — the matcher lowercases the query, splits
      // it on whitespace and requires every term to be a substring. "meshpro" is
      // strictly the better haystack: typing "mesh pro" gives ["mesh","pro"] and   // MESHPRO-NAME-ALLOW
      // both are substrings of "meshpro", while typing "meshpro" against the old
      // "mesh pro" matched nothing.   // MESHPRO-NAME-ALLOW
      keywords: ["stripe", "subscription", "meshpro", "payment"],
    },
    {
      id: "settings-data",
      title: "Data Settings",
      description: "Export data, review stored records, and delete imported data.",
      category: "Settings",
      href: "/settings#data",
      icon: Database,
      keywords: ["download", "export", "records", "delete data"],
    },
    {
      id: "mesh-pro",
      title: "MeshPro",
      description: "Upgrade for deeper analytics, cosmetics, and customization.",
      category: "Go",
      href: "/meshpro",
      icon: CreditCard,
      keywords: ["premium", "subscription", "stripe", "billing"],
    },
    {
      id: "delete-account",
      title: "Delete Account",
      description: "Open the permanent account deletion page.",
      category: "Settings",
      href: "/account/delete",
      icon: Trash2,
      keywords: ["remove", "close", "erase"],
    },
    {
      id: "help-center",
      title: "Help Center",
      description: "Search articles for accounts, Meshi, safety, billing, and errors.",
      category: "Help",
      href: "/help",
      icon: HelpCircle,
      keywords: ["docs", "articles", "faq", "support"],
    },
    {
      id: "support",
      title: "Contact Support",
      description: "Submit a support ticket with category, priority, and diagnostics.",
      category: "Help",
      href: "/support",
      icon: BookOpen,
      keywords: ["ticket", "help", "contact"],
    },
    {
      id: "system-status",
      title: "System Status",
      description: "Check website, database, messaging, uploads, integrations, and payments.",
      category: "Help",
      href: "/status",
      icon: ShieldCheck,
      keywords: ["uptime", "health", "operational"],
    },
  ];
}

function CommandKey({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-h-6 min-w-6 items-center justify-center rounded-md border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-1.5 text-micro font-semibold text-[var(--text-muted)]">
      {children}
    </kbd>
  );
}

export function openCommandPalette() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(COMMAND_PALETTE_EVENT));
}

export function CommandPalette({ username }: { username: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const commands = useMemo(() => createCommands(username), [username]);

  const visibleCommands = useMemo(() => {
    const trimmed = query.trim();
    const terms = normalize(trimmed).split(" ").filter(Boolean);

    if (!terms.length) return commands.slice(0, 12);

    const matches = commands.filter((command) => {
      const searchText = getSearchText(command);
      return terms.every((term) => searchText.includes(term));
    });

    if (matches.length) return matches.slice(0, 14);

    return [
      {
        id: "search-fallback",
        title: `Search for "${trimmed}"`,
        description: "Run this query in Mesh.me Search.",
        category: "Action",
        href: `/search?q=${encodeURIComponent(trimmed)}`,
        icon: Search,
        keywords: ["fallback", "query"],
      } satisfies CommandItem,
    ];
  }, [commands, query]);

  const closePalette = useCallback(() => {
    setOpen(false);
    setQuery("");
    setSelectedIndex(0);
  }, []);

  const runCommand = useCallback((command: CommandItem) => {
    closePalette();

    if (command.href) {
      router.push(command.href);
      return;
    }

    if (command.action === "meshi") {
      openMeshi("actions");
      return;
    }

    if (command.action === "bugReport") {
      window.dispatchEvent(new Event(BUG_REPORT_EVENT));
      return;
    }

    if (command.action === "shortcuts") {
      window.dispatchEvent(new Event(KEYBOARD_SHORTCUTS_EVENT));
    }
  }, [closePalette, router]);

  useEffect(() => {
    const onOpenCommandPalette = () => {
      setQuery("");
      setSelectedIndex(0);
      setOpen(true);
    };
    window.addEventListener(COMMAND_PALETTE_EVENT, onOpenCommandPalette);
    return () => window.removeEventListener(COMMAND_PALETTE_EVENT, onOpenCommandPalette);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && key === "k") {
        event.preventDefault();
        setQuery("");
        setSelectedIndex(0);
        setOpen(true);
        return;
      }

      if (event.key === "Escape" && open) {
        event.preventDefault();
        closePalette();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closePalette, open]);

  useEffect(() => {
    if (!open) return;

    const timeoutId = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [open]);

  const selectedCommandIndex = Math.min(selectedIndex, Math.max(visibleCommands.length - 1, 0));
  const selectedCommandId = visibleCommands[selectedCommandIndex]?.id;

  function onPaletteKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((current) => (current + 1) % Math.max(visibleCommands.length, 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((current) => (current - 1 + Math.max(visibleCommands.length, 1)) % Math.max(visibleCommands.length, 1));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const selectedCommand = visibleCommands[selectedCommandIndex];
      if (selectedCommand) runCommand(selectedCommand);
    }
  }

  return (
    <Modal
      open={open}
      onClose={closePalette}
      title="Command palette"
      description="Jump to pages, start actions, search settings, or open help."
      className="command-palette-modal max-w-2xl"
    >
      <motion.div
        className="command-palette-shell"
        initial={{ opacity: 0, scale: 0.96, y: -6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={PALETTE_SPRING}
        style={{ transformOrigin: "top center" }}
      >
        <div className="command-palette-search">
          <Command className="h-5 w-5 shrink-0 text-[var(--accent)]" aria-hidden />
          <label htmlFor="mesh-command-palette-input" className="sr-only">Search commands</label>
          <input
            id="mesh-command-palette-input"
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.currentTarget.value);
              setSelectedIndex(0);
            }}
            onKeyDown={onPaletteKeyDown}
            className="min-w-0 flex-1 bg-transparent text-base font-semibold text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
            placeholder="Where do you want to go?"
            role="combobox"
            aria-expanded={open}
            aria-controls="mesh-command-palette-results"
            aria-activedescendant={selectedCommandId ? `mesh-command-${selectedCommandId}` : undefined}
            autoComplete="off"
            spellCheck={false}
          />
          <span className="hidden items-center gap-1 sm:inline-flex" aria-hidden="true">
            <CommandKey>Ctrl</CommandKey>
            <CommandKey>K</CommandKey>
          </span>
        </div>

        <div id="mesh-command-palette-results" className="command-palette-results ds-scrollbar" role="listbox" aria-label="Command results">
          {visibleCommands.map((command, index) => {
            const Icon = command.icon;
            const active = index === selectedCommandIndex;

            return (
              <motion.button
                key={command.id}
                id={`mesh-command-${command.id}`}
                type="button"
                role="option"
                aria-selected={active}
                onMouseEnter={() => setSelectedIndex(index)}
                onClick={() => runCommand(command)}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...ROW_SPRING, delay: Math.min(index * 0.022, 0.22) }}
                className={cn("command-palette-item relative")}
              >
                {active && (
                  <motion.span
                    layoutId="command-active-highlight"
                    transition={PALETTE_SPRING}
                    className="pointer-events-none absolute inset-0 rounded-[0.85rem]"
                    style={{
                      background: "color-mix(in srgb, var(--bg-primary) 84%, var(--accent-subtle))",
                      border: "1px solid color-mix(in srgb, var(--accent) 42%, var(--border-primary))",
                    }}
                    aria-hidden="true"
                  />
                )}
                <span className="command-palette-icon relative z-[1]">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="relative z-[1] min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm font-semibold text-[var(--text-primary)]">{command.title}</span>
                  <span className="mt-0.5 block truncate text-xs font-semibold text-[var(--text-muted)]">{command.description}</span>
                </span>
                <Badge variant={command.category === "Action" ? "accent" : "secondary"} className="command-palette-badge relative z-[1]">
                  {command.category}
                </Badge>
              </motion.button>
            );
          })}
        </div>

        <div className="command-palette-footer" aria-hidden="true">
          <span><CommandKey>Up</CommandKey><CommandKey>Down</CommandKey> move</span>
          <span><CommandKey>Enter</CommandKey> open</span>
          <span><CommandKey>Esc</CommandKey> close</span>
        </div>
      </motion.div>
    </Modal>
  );
}
