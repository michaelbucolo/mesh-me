"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  AtSign,
  Bell,
  BellOff,
  Check,
  Heart,
  Loader2,
  LockKeyhole,
  MessageCircle,
  RefreshCw,
  Repeat,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import {
  getNotificationCategoryLabel,
  notificationCategories,
  type NotificationCategory,
  type NotificationCenterPayload,
  type NotificationGroup,
} from "@/lib/notifications";
import { formatRelativeTime } from "@/lib/utils";

type NoticeState = {
  type: "success" | "error" | "info";
  message: string;
} | null;

const categoryIcons: Record<NotificationCategory, typeof Bell> = {
  all: Bell,
  unread: AlertTriangle,
  likes: Heart,
  comments: MessageCircle,
  follows: UserPlus,
  messages: MessageCircle,
  mentions: AtSign,
  communities: Users,
  security: ShieldCheck,
  privacy: LockKeyhole,
  shares: Repeat,
};

const visibleCategories = notificationCategories;

export function NotificationsClient({ initialPayload }: { initialPayload: NotificationCenterPayload }) {
  const [payload, setPayload] = useState(initialPayload);
  const [activeCategory, setActiveCategory] = useState<NotificationCategory>("all");
  const [query, setQuery] = useState("");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [notice, setNotice] = useState<NoticeState>(null);
  const [isPending, startTransition] = useTransition();

  const filteredGroups = useMemo(() => {
    const search = query.trim().toLowerCase();
    return payload.groups.filter((group) => {
      if (activeCategory === "unread" && group.unreadCount === 0) return false;
      if (!["all", "unread"].includes(activeCategory) && group.category !== activeCategory) return false;
      if (showUnreadOnly && group.unreadCount === 0) return false;
      if (!search) return true;
      return [
        group.title,
        group.summary,
        group.category,
        ...group.actorNames,
        ...group.notifications.map((notification) => notification.message),
      ].some((value) => value.toLowerCase().includes(search));
    });
  }, [activeCategory, payload.groups, query, showUnreadOnly]);

  function toggleGroup(key: string) {
    setExpandedGroups((current) => (
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
    ));
  }

  function requestNotificationAction(action: "mark-read" | "mark-unread" | "delete-read", notificationIds?: string[]) {
    startTransition(async () => {
      setNotice(null);
      try {
        const response = await fetch("/api/notifications", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, notificationIds }),
        });
        const data = await response.json().catch(() => ({})) as Partial<NotificationCenterPayload> & { error?: string; updated?: number; deleted?: number };
        if (!response.ok || data.error || !data.groups || !data.categories || !data.notifications) {
          throw new Error(data.error || "Could not update notifications.");
        }
        setPayload(data as NotificationCenterPayload);
        const changed = data.updated ?? data.deleted ?? 0;
        setNotice({
          type: "success",
          message: action === "delete-read"
            ? `${changed} read notification${changed === 1 ? "" : "s"} cleared.`
            : `${changed} notification${changed === 1 ? "" : "s"} updated.`,
        });
      } catch (error) {
        setNotice({ type: "error", message: error instanceof Error ? error.message : "Could not update notifications." });
      }
    });
  }

  function refresh() {
    startTransition(async () => {
      setNotice(null);
      try {
        const response = await fetch("/api/notifications?limit=100", {
          cache: "no-store",
          credentials: "same-origin",
        });
        const data = await response.json().catch(() => ({})) as Partial<NotificationCenterPayload> & { error?: string };
        if (!response.ok || data.error || !data.groups || !data.categories || !data.notifications) {
          throw new Error(data.error || "Could not refresh notifications.");
        }
        setPayload(data as NotificationCenterPayload);
        setNotice({ type: "info", message: "Notification center refreshed." });
      } catch (error) {
        setNotice({ type: "error", message: error instanceof Error ? error.message : "Could not refresh notifications." });
      }
    });
  }

  // The hub stays live on its own: silent background refresh while the tab is
  // visible (and on re-focus), applying state only when something changed —
  // no manual Refresh clicking required.
  useEffect(() => {
    let stopped = false;
    const silentRefresh = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/notifications?limit=100", {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!response.ok) return;
        const data = (await response.json().catch(() => null)) as (Partial<NotificationCenterPayload> & { error?: string }) | null;
        if (stopped || !data || data.error || !data.groups || !data.categories || !data.notifications) return;
        setPayload((prev) =>
          JSON.stringify(prev.notifications) === JSON.stringify(data.notifications)
            ? prev
            : (data as NotificationCenterPayload),
        );
      } catch {
        // Best-effort — the next tick retries.
      }
    };
    const interval = window.setInterval(silentRefresh, 30000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void silentRefresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return (
    <main data-testid="notification-center" data-meshi-zone="notifications" className="simple-page grid gap-5 animate-page-enter">
      <header className="mesh-surface mesh-pop-in rounded-lg p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-primary)] bg-[var(--bg-primary)]/70 px-3 py-2 text-xs font-bold text-[var(--text-secondary)]">
            <Bell size={15} aria-hidden="true" />
            Unified notification hub
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={refresh} disabled={isPending} className="mesh-action mesh-action-secondary px-3 text-sm">
              {isPending ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <RefreshCw size={15} aria-hidden="true" />}
              Refresh
            </button>
            <button
              type="button"
              onClick={() => requestNotificationAction("mark-read")}
              disabled={isPending || payload.unreadCount === 0}
              className="mesh-action mesh-action-primary px-4 text-sm"
              data-testid="mark-all-notifications-read"
            >
              <Check size={15} aria-hidden="true" />
              Mark all read
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
          <div>
            <h1 className="max-w-3xl text-2xl font-bold leading-tight md:text-4xl">One calm place for every alert.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-secondary)] md:text-base">
              Likes, comments, follows, messages, mentions, communities, security, and privacy alerts are grouped so the important parts stay visible.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Metric label="Unread" value={payload.unreadCount} />
            <Metric label="Groups" value={payload.unreadGroupCount} />
            <Metric label="Priority" value={payload.importantCount} />
          </div>
        </div>
      </header>

      <section className="grid gap-5 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <aside className="grid h-fit gap-4 xl:sticky xl:top-5">
          <div className="mesh-surface rounded-lg p-4">
            <h2 className="text-base font-bold">Smart digest</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{payload.smartSummary}</p>
            <div className="mt-4 grid gap-2">
              <PreferenceRow label="Push alerts" active={payload.preferences.pushEnabled} />
              <PreferenceRow label="Messages" active={payload.preferences.messages} />
              <PreferenceRow label="Mentions" active={payload.preferences.mentions} />
              <PreferenceRow label="Security" active={payload.preferences.securityAlerts} />
            </div>
            <Link href="/settings" className="mesh-action mesh-action-secondary mt-4 w-full justify-center px-4 text-sm">
              <LockKeyhole size={15} aria-hidden="true" />
              Notification settings
            </Link>
          </div>

          <div className="mesh-surface rounded-lg p-4">
            <h2 className="text-base font-bold">Duplicate app alerts</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              Once a platform is connected and syncing reliably, Mesh.me can be the cleaner hub instead of letting every app interrupt you separately.
            </p>
            <Link href="/connected-accounts" className="mesh-link-row mt-3 rounded-md px-3 py-3 text-sm">
              <BellOff size={15} aria-hidden="true" />
              Review connected platforms
            </Link>
          </div>
        </aside>

        <section className="grid gap-4">
          <div className="mesh-surface rounded-lg p-3 md:p-4">
            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
              <label className="flex h-11 items-center gap-2 rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)]/70 px-3 text-sm">
                <Search size={15} className="text-[var(--text-muted)]" aria-hidden="true" />
                <input
                  data-testid="notification-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-[var(--text-muted)]"
                  placeholder="Search notifications"
                  suppressHydrationWarning
                />
                {query && (
                  <button type="button" onClick={() => setQuery("")} className="mesh-choice rounded-full p-1" aria-label="Clear search">
                    <X size={14} aria-hidden="true" />
                  </button>
                )}
              </label>
              <button
                type="button"
                onClick={() => setShowUnreadOnly((current) => !current)}
                aria-pressed={showUnreadOnly}
                className={`mesh-action px-4 text-sm ${showUnreadOnly ? "mesh-action-primary" : "mesh-action-secondary"}`}
              >
                <AlertTriangle size={15} aria-hidden="true" />
                Unread only
              </button>
            </div>

            <div className="mt-3 flex gap-2 overflow-x-auto pb-1" data-testid="notification-category-tabs">
              {visibleCategories.map((category) => {
                const Icon = categoryIcons[category];
                const counts = payload.categories[category];
                const active = activeCategory === category;
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setActiveCategory(category)}
                    className={`mesh-choice shrink-0 rounded-full px-3 py-2 text-xs font-bold ${active ? "border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-primary)]" : "text-[var(--text-secondary)]"}`}
                    aria-pressed={active}
                  >
                    <Icon size={14} aria-hidden="true" />
                    {getNotificationCategoryLabel(category)}
                    {counts.unread > 0 ? <span className="rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[10px] text-white">{counts.unread}</span> : null}
                  </button>
                );
              })}
            </div>
          </div>

          {notice && (
            <div className={`rounded-md border px-4 py-3 text-sm ${
              notice.type === "error"
                ? "border-red-400/25 bg-red-500/10 text-red-100"
                : notice.type === "success"
                  ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100"
                  : "border-[var(--border-primary)] bg-[var(--bg-primary)]/70 text-[var(--text-secondary)]"
            }`}>
              {notice.message}
            </div>
          )}

          {filteredGroups.length > 0 ? (
            <div className="grid gap-3" data-testid="notification-group-list">
              <AnimatePresence mode="popLayout">
              {filteredGroups.map((group, idx) => (
                <motion.div
                  key={group.key}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.28, delay: Math.min(idx * 0.04, 0.4), ease: [0.16, 1, 0.3, 1] }}
                >
                <NotificationGroupCard
                  key={group.key}
                  group={group}
                  expanded={expandedGroups.includes(group.key)}
                  busy={isPending}
                  onToggle={() => toggleGroup(group.key)}
                  onMarkRead={() => requestNotificationAction("mark-read", group.notifications.map((item) => item.id))}
                  onMarkUnread={() => requestNotificationAction("mark-unread", group.notifications.map((item) => item.id))}
                />
                </motion.div>
              ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="mesh-surface rounded-lg p-8">
              <EmptyState
                icon={Bell}
                title="No matching notifications"
                description="Try another category, clear search, or turn off unread-only filtering."
              />
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => requestNotificationAction("delete-read")}
              disabled={isPending || !payload.notifications.some((notification) => notification.read)}
              className="mesh-action border-red-400/25 bg-red-500/10 px-4 text-sm text-red-200"
            >
              <Trash2 size={15} aria-hidden="true" />
              Clear read
            </button>
          </div>
        </section>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)]/60 p-3 text-center"
    >
      <strong className="block text-xl text-[var(--text-primary)]">{value.toLocaleString()}</strong>
      <span className="text-xs font-semibold text-[var(--text-muted)]">{label}</span>
    </motion.div>
  );
}

function PreferenceRow({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)]/60 px-3 py-2 text-sm">
      <span className="font-semibold text-[var(--text-secondary)]">{label}</span>
      <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${active ? "bg-emerald-300/10 text-emerald-100" : "bg-[var(--bg-tertiary)] text-[var(--text-muted)]"}`}>
        {active ? "On" : "Off"}
      </span>
    </div>
  );
}

function NotificationGroupCard({
  group,
  expanded,
  busy,
  onToggle,
  onMarkRead,
  onMarkUnread,
}: {
  group: NotificationGroup;
  expanded: boolean;
  busy: boolean;
  onToggle: () => void;
  onMarkRead: () => void;
  onMarkUnread: () => void;
}) {
  const Icon = categoryIcons[group.category];
  const primary = group.notifications[0];

  return (
    <article
      className={`mesh-surface mesh-pressable rounded-lg p-4 transition ${group.unreadCount > 0 ? "ring-1 ring-[var(--accent-muted)]" : ""}`}
      data-testid="notification-group"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <Link href={group.href} className="flex min-w-0 flex-1 items-start gap-3">
          <div className="relative shrink-0">
            {primary.actor ? (
              <Avatar src={primary.actor.avatarUrl} alt={primary.actor.displayName} size="md" />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-primary)] bg-[var(--bg-secondary)]">
                <Bell size={18} aria-hidden="true" />
              </span>
            )}
            <span className={`absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-[var(--border-primary)] ${group.priority === "high" ? "bg-red-500 text-white" : "bg-[var(--bg-primary)] text-[var(--accent)]"}`}>
              <Icon size={13} aria-hidden="true" />
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="min-w-0 truncate text-base font-bold text-[var(--text-primary)]">{group.title}</h2>
              {group.unreadCount > 0 && (
                <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-bold text-white">
                  {group.unreadCount} unread
                </span>
              )}
              {group.priority === "high" && (
                <span className="rounded-full border border-red-400/25 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-100">
                  Priority
                </span>
              )}
            </div>
            <p className="mt-1 line-clamp-2 text-sm leading-6 text-[var(--text-secondary)]">{group.summary}</p>
            <p className="mt-2 text-xs font-semibold text-[var(--text-muted)]">
              {getNotificationCategoryLabel(group.category)} - {formatRelativeTime(group.latestAt)}
              {group.count > 1 ? ` - ${group.count} related` : ""}
            </p>
          </div>
        </Link>

        <div className="flex flex-wrap gap-2 md:justify-end">
          <button type="button" onClick={onToggle} className="mesh-action mesh-action-secondary px-3 text-xs">
            {expanded ? "Hide" : "Details"}
          </button>
          {group.unreadCount > 0 ? (
            <button type="button" onClick={onMarkRead} disabled={busy} className="mesh-action mesh-action-primary px-3 text-xs" aria-label={`Mark ${group.title} read`}>
              <Check size={13} aria-hidden="true" />
              Read
            </button>
          ) : (
            <button type="button" onClick={onMarkUnread} disabled={busy} className="mesh-action mesh-action-secondary px-3 text-xs" aria-label={`Mark ${group.title} unread`}>
              Unread
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="overflow-hidden"
        >
        <div className="mt-4 grid gap-2 border-t border-[var(--border-primary)] pt-3">
          {group.notifications.map((notification) => (
            <Link
              key={notification.id}
              href={notification.href}
              className="mesh-link-row rounded-md px-3 py-3 text-sm"
              data-testid="notification-row"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${notification.read ? "bg-[var(--border-primary)]" : "bg-[var(--accent)]"}`} />
                <span className="min-w-0">
                  <span className="block truncate font-bold text-[var(--text-primary)]">{notification.message}</span>
                  <span className="block text-xs text-[var(--text-muted)]">{formatRelativeTime(notification.createdAt)}</span>
                </span>
              </div>
            </Link>
          ))}
        </div>
        </motion.div>
      )}
      </AnimatePresence>
    </article>
  );
}
