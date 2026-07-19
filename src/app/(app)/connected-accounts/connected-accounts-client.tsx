"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Combine,
  Info,
  KeyRound,
  PauseCircle,
  PlayCircle,
  PlugZap,
  RefreshCw,
  Search,
  Sparkles,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCount } from "@/lib/utils";
import type {
  ConnectedAccountView,
  ConnectedAccountsDashboard,
  SupportedPlatformView,
} from "@/lib/connected-accounts";
import type { PlatformAdapterCategory, PlatformAdapterCapabilityKey } from "@/lib/platform-adapters";
import { OneMeshHub, type HubAccount } from "@/components/accounts/one-mesh-hub";
import { foldPersonaIntoMainIdentity } from "@/lib/one-account-actions";

/** A separate identity (alter ego) that can be folded into the one account. */
type PersonaView = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  accountCount: number;
};

type ActionState = {
  type: "success" | "error" | "info";
  message: string;
} | null;

const categoryLabels: Record<PlatformAdapterCategory | "all", string> = {
  all: "All",
  social: "Social",
  video: "Video",
  messaging: "Messaging",
  creator: "Creator",
  music: "Music",
  community: "Community",
  portfolio: "Portfolio",
};

const capabilityLabels: Record<PlatformAdapterCapabilityKey, string> = {
  profile: "Profile",
  content: "Content",
  messages: "Messages",
  notifications: "Alerts",
  analytics: "Analytics",
  posting: "Post",
  actions: "Actions",
};

// Clean, consistent brand monograms. Kept to plain text (no OS symbol glyphs
// like ♫/▶/𝕏, which render inconsistently and can flip to emoji) so every
// platform avatar reads uniformly on every device.
const platformBrands: Record<string, { glyph: string; bg: string; fg?: string }> = {
  github: { glyph: "GH", bg: "#24292e" },
  linkedin: { glyph: "in", bg: "#0077b5" },
  medium: { glyph: "M", bg: "#292929" },
  spotify: { glyph: "SP", bg: "#1db954" },
  twitter: { glyph: "X", bg: "#0f1419" },
  x: { glyph: "X", bg: "#0f1419" },
  youtube: { glyph: "YT", bg: "#ff0000" },
  tiktok: { glyph: "TT", bg: "#010101" },
  instagram: { glyph: "IG", bg: "#e4405f" },
  discord: { glyph: "DC", bg: "#5865f2" },
  twitch: { glyph: "TW", bg: "#9146ff" },
  facebook: { glyph: "FB", bg: "#1877f2" },
  snapchat: { glyph: "SN", bg: "#fffc00", fg: "#0f1419" },
  reddit: { glyph: "r/", bg: "#ff4500" },
  pinterest: { glyph: "PI", bg: "#e60023" },
  soundcloud: { glyph: "SC", bg: "#ff5500" },
  bluesky: { glyph: "BS", bg: "#0085ff" },
  threads: { glyph: "@", bg: "#101010" },
};

function PlatformAvatar({ platform, name, size = "md" }: { platform: string; name: string; size?: "md" | "lg" }) {
  const brand = platformBrands[platform.toLowerCase()];
  const dimensions = size === "lg" ? "h-12 w-12 text-base" : "h-10 w-10 text-sm";
  return (
    <div
      aria-hidden="true"
      className={cn("flex shrink-0 items-center justify-center rounded-full font-bold", dimensions)}
      style={{
        backgroundColor: brand?.bg ?? "var(--accent-subtle)",
        color: brand ? brand.fg ?? "#ffffff" : "var(--accent)",
      }}
    >
      {brand?.glyph ?? (name.trim().charAt(0).toUpperCase() || "M")}
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusVariant(account: ConnectedAccountView): "success" | "warning" | "danger" | "secondary" {
  if (account.health === "ready") return "success";
  if (account.health === "manual") return "secondary";
  if (account.health === "paused") return "warning";
  return "danger";
}

async function requestDashboard(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    cache: "no-store",
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data?.error === "string" ? data.error : "Request failed";
    throw new Error(message);
  }
  return data as ConnectedAccountsDashboard | { dashboard?: ConnectedAccountsDashboard };
}

function Toast({ state, onDismiss }: { state: ActionState; onDismiss: () => void }) {
  useEffect(() => {
    if (!state) return;
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [state, onDismiss]);

  return (
    <AnimatePresence>
      {state && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          className={cn(
            "fixed bottom-6 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-2 rounded-full border px-4 py-3 text-sm shadow-lg backdrop-blur",
            state.type === "error" && "border-[var(--ds-danger-border)] bg-[var(--ds-danger-bg)] text-[var(--ds-danger)]",
            state.type === "success" && "border-[var(--ds-success-border)] bg-[var(--ds-success-bg)] text-[var(--ds-success)]",
            state.type === "info" && "border-[var(--ds-border)] bg-[var(--ds-surface)] text-[var(--text-secondary)]",
          )}
          role="status"
        >
          {state.type === "error" ? (
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          ) : state.type === "info" ? (
            <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <span className="min-w-0 flex-1">{state.message}</span>
          <button type="button" onClick={onDismiss} className="shrink-0 opacity-70 transition-opacity hover:opacity-100" aria-label="Dismiss">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function AccountCard({
  account,
  busyKey,
  onSync,
  onToggleActive,
  onDisconnect,
}: {
  account: ConnectedAccountView;
  busyKey: string | null;
  onSync: (account: ConnectedAccountView) => void;
  onToggleActive: (account: ConnectedAccountView) => void;
  onDisconnect: (account: ConnectedAccountView) => void;
}) {
  const isBusy = busyKey?.endsWith(account.id) ?? false;
  const canSync = Boolean(account.adapter?.canSync && account.hasCredential && account.isActive);
  const needsReconnect = account.authType === "oauth" && account.health === "needs_reconnect";
  const grantedCount = account.permissions.filter((permission) => permission.state === "granted").length;
  const countItems: [string, number][] = [
    ["Posts", account.counts.posts],
    ["Comments", account.counts.comments],
    ["Followers", account.counts.followers],
    ["Media", account.counts.media],
  ];

  return (
    <div className="connected-account-card overflow-hidden rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface)] transition-colors hover:border-[var(--accent)]/40">
      <div className="flex items-center gap-3 p-4">
        <PlatformAvatar platform={account.platform} name={account.platformName} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-base font-bold text-[var(--text-primary)]">{account.platformName}</p>
            <Badge variant={statusVariant(account)}>{account.healthLabel}</Badge>
          </div>
          <p className="truncate text-sm text-[var(--text-secondary)]">
            {account.platformUsername ? `@${account.platformUsername}` : account.accountLabel || "Connected"}
          </p>
        </div>
        {needsReconnect && account.adapter?.connectHref ? (
          <Link
            href={account.adapter.connectHref}
            prefetch={false}
            className={cn(buttonVariants({ size: "sm" }), "shrink-0")}
          >
            <PlugZap className="h-4 w-4" aria-hidden="true" />
            Reconnect
          </Link>
        ) : (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="shrink-0"
            loading={busyKey === `sync-${account.id}`}
            disabled={!canSync || isBusy}
            onClick={() => onSync(account)}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Sync
          </Button>
        )}
      </div>

      {(account.syncError || needsReconnect) && (
        <div className="mx-4 mb-3 flex items-start gap-2 rounded-[var(--ds-radius-md)] border border-[var(--ds-warning-border,var(--ds-border))] bg-[var(--bg-primary)]/55 px-3 py-2 text-xs leading-5">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--ds-warning)]" aria-hidden="true" />
          <span className={account.syncError ? "text-[var(--ds-danger)]" : "text-[var(--ds-warning)]"}>
            {account.syncError ?? "Reconnect this account to keep it syncing."}
          </span>
        </div>
      )}

      <details className="group border-t border-[var(--ds-border)]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-2.5 text-xs font-semibold text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]">
          <span className="inline-flex items-center gap-1.5">
            <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
            Details
          </span>
          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="grid gap-3 border-t border-[var(--ds-border)] px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
            <span>{grantedCount} permission{grantedCount === 1 ? "" : "s"} granted</span>
            <span>Last synced {formatDate(account.lastSyncAt)}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {countItems.map(([label, value]) => (
              <div key={label} className="rounded-[var(--ds-radius-sm)] bg-[var(--bg-primary)]/55 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">{label}</p>
                <p className="mt-0.5 text-sm font-bold text-[var(--text-primary)]">{formatCount(Number(value))}</p>
              </div>
            ))}
          </div>

          {account.permissions.length > 0 && (
            <div className="grid gap-1.5">
              {account.permissions.map((permission) => (
                <div key={`${account.id}-${permission.key}`} className="flex items-start justify-between gap-3 rounded-[var(--ds-radius-sm)] bg-[var(--bg-primary)]/55 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{permission.label}</p>
                    <p className="text-xs leading-5 text-[var(--text-secondary)]">{permission.description}</p>
                  </div>
                  <Badge variant={permission.state === "granted" ? "success" : "outline"}>{permission.state}</Badge>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
            <span>{account.authType === "oauth" ? "Secured with OAuth — Mesh.me never sees your password." : "Public reference only — no login shared."}</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {account.authType === "oauth" && account.adapter?.connectHref && !needsReconnect && (
              <Link
                href={account.adapter.connectHref}
                prefetch={false}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Refresh access
              </Link>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={busyKey === `toggle-${account.id}`}
              disabled={isBusy}
              onClick={() => onToggleActive(account)}
            >
              {account.isActive ? <PauseCircle className="h-4 w-4" aria-hidden="true" /> : <PlayCircle className="h-4 w-4" aria-hidden="true" />}
              {account.isActive ? "Pause syncing" : "Resume syncing"}
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              loading={busyKey === `delete-${account.id}`}
              disabled={isBusy}
              onClick={() => onDisconnect(account)}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Disconnect
            </Button>
          </div>
        </div>
      </details>
    </div>
  );
}

function PlatformCard({
  platform,
  busyKey,
  onConnectManual,
}: {
  platform: SupportedPlatformView;
  busyKey: string | null;
  onConnectManual: (platform: SupportedPlatformView, username: string) => Promise<boolean>;
}) {
  const [handleOpen, setHandleOpen] = useState(false);
  const [handle, setHandle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const enabledCapabilities = Object.entries(platform.capabilities)
    .filter(([, enabled]) => enabled)
    .map(([key]) => key as PlatformAdapterCapabilityKey);
  const isOauth = platform.authType === "oauth";
  const canConnect = isOauth ? platform.configured && Boolean(platform.connectHref) : true;

  useEffect(() => {
    if (handleOpen) inputRef.current?.focus();
  }, [handleOpen]);

  async function submitHandle(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const added = await onConnectManual(platform, handle);
    if (added) {
      setHandle("");
      setHandleOpen(false);
    }
  }

  return (
    <div
      className={cn(
        "flex h-full flex-col gap-3 rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface)] p-4 transition-colors",
        canConnect ? "hover:border-[var(--accent)]/40" : "opacity-70",
      )}
    >
      <div className="flex items-center gap-3">
        <PlatformAvatar platform={platform.id} name={platform.name} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-bold text-[var(--text-primary)]">{platform.name}</p>
            {platform.activeCount > 0 && <Badge variant="success">Connected</Badge>}
            {!canConnect && <Badge variant="outline">Coming soon</Badge>}
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            {categoryLabels[platform.category]} · {isOauth ? "One-tap connect" : "Public handle"}
          </p>
        </div>
        {canConnect && !handleOpen && (
          isOauth && platform.connectHref ? (
            <Link href={platform.connectHref} prefetch={false} className={cn(buttonVariants({ size: "sm" }), "shrink-0")}>
              <PlugZap className="h-4 w-4" aria-hidden="true" />
              {platform.activeCount > 0 ? "Add another" : "Connect"}
            </Link>
          ) : (
            <Button type="button" size="sm" className="shrink-0" onClick={() => setHandleOpen(true)}>
              <PlugZap className="h-4 w-4" aria-hidden="true" />
              {platform.activeCount > 0 ? "Add another" : "Connect"}
            </Button>
          )
        )}
      </div>

      {handleOpen && (
        <form onSubmit={submitHandle} className="flex items-center gap-2">
          <Input
            ref={inputRef}
            value={handle}
            onChange={(event) => setHandle(event.target.value)}
            placeholder="@username"
            autoComplete="off"
            aria-label={`${platform.name} username`}
            className="flex-1"
          />
          <Button type="submit" size="sm" loading={busyKey === `manual-${platform.id}`} disabled={!handle.trim()}>
            Link
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setHandleOpen(false)} aria-label="Cancel">
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </form>
      )}

      <p className="text-xs leading-5 text-[var(--text-secondary)]">{platform.notes}</p>

      <div className="mt-auto flex flex-wrap gap-1.5">
        {enabledCapabilities.length > 0 ? enabledCapabilities.map((key) => (
          <Badge key={key} variant="accent">{capabilityLabels[key]}</Badge>
        )) : <Badge variant="outline">Profile only</Badge>}
      </div>
    </div>
  );
}

export function ConnectedAccountsClient({
  initialDashboard,
  initialPersonas = [],
  identity,
  fromOnboarding = false,
  preselectPlatforms = [],
}: {
  initialDashboard: ConnectedAccountsDashboard;
  initialPersonas?: PersonaView[];
  identity: { username: string; displayName: string; avatarUrl: string | null };
  fromOnboarding?: boolean;
  preselectPlatforms?: string[];
}) {
  const [dashboard, setDashboard] = useState(initialDashboard);
  const [personas, setPersonas] = useState(initialPersonas);

  // Each connected account, resolved to its brand monogram, for the One Mesh hub.
  const hubAccounts = useMemo<HubAccount[]>(
    () =>
      dashboard.accounts.map((account) => {
        const brand = platformBrands[account.platform.toLowerCase()];
        return {
          id: account.id,
          platform: account.platform,
          name: account.platformName,
          glyph: brand?.glyph ?? (account.platformName.trim().charAt(0).toUpperCase() || "M"),
          bg: brand?.bg ?? "var(--accent)",
          fg: brand?.fg,
          synced: account.isActive && account.hasCredential && account.health === "ready",
        };
      }),
    [dashboard.accounts],
  );
  const [actionState, setActionState] = useState<ActionState>(null);
  const dismissToast = useCallback(() => setActionState(null), []);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<PlatformAdapterCategory | "all">("all");
  const refreshAttemptedRef = useRef(false);
  const hasRefreshableAccounts = useMemo(
    () => dashboard.accounts.some((account) => (
      account.health === "needs_reconnect" && account.hasRefreshToken
    )),
    [dashboard.accounts],
  );

  useEffect(() => {
    if (!hasRefreshableAccounts || refreshAttemptedRef.current) return;
    refreshAttemptedRef.current = true;

    void (async () => {
      const response = await fetch("/api/connected-accounts/refresh", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
      }).catch(() => null);
      if (!response?.ok) return;

      const data = await response.json().catch(() => null) as { refreshed?: unknown } | null;
      if (typeof data?.refreshed !== "number" || data.refreshed <= 0) return;

      const refreshed = await requestDashboard("/api/connected-accounts").catch(() => null);
      if (refreshed && "accounts" in refreshed) {
        setDashboard(refreshed as ConnectedAccountsDashboard);
      }
    })();
  }, [hasRefreshableAccounts]);

  const filteredPlatforms = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return dashboard.supportedPlatforms.filter((platform) => {
      const matchesCategory = category === "all" || platform.category === category;
      const matchesQuery = !normalizedQuery
        || platform.name.toLowerCase().includes(normalizedQuery)
        || platform.id.toLowerCase().includes(normalizedQuery)
        || platform.category.toLowerCase().includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
  }, [category, dashboard.supportedPlatforms, query]);

  const categories = useMemo(() => {
    const values = new Set<PlatformAdapterCategory>();
    for (const platform of dashboard.supportedPlatforms) values.add(platform.category);
    return Array.from(values).sort();
  }, [dashboard.supportedPlatforms]);

  const quickMergePlatforms = useMemo(() => {
    if (preselectPlatforms.length === 0) return [];
    const byId = new Map(dashboard.supportedPlatforms.map((platform) => [platform.id, platform]));
    return preselectPlatforms
      .map((id) => byId.get(id))
      .filter((platform): platform is SupportedPlatformView => Boolean(platform) && platform!.activeCount === 0);
  }, [preselectPlatforms, dashboard.supportedPlatforms]);

  async function refreshDashboard() {
    setBusyKey("refresh");
    try {
      const refreshed = await requestDashboard("/api/connected-accounts");
      setDashboard(refreshed as ConnectedAccountsDashboard);
      setActionState({ type: "success", message: "Connected accounts refreshed." });
    } catch (error) {
      setActionState({ type: "error", message: error instanceof Error ? error.message : "Refresh failed" });
    } finally {
      setBusyKey(null);
    }
  }

  async function connectManualAccount(platform: SupportedPlatformView, username: string) {
    setBusyKey(`manual-${platform.id}`);
    try {
      const result = await requestDashboard("/api/connected-accounts", {
        method: "POST",
        body: JSON.stringify({
          platform: platform.id,
          username,
          accountLabel: "",
        }),
      });
      if ("dashboard" in result && result.dashboard) setDashboard(result.dashboard);
      else {
        const refreshed = await requestDashboard("/api/connected-accounts");
        setDashboard(refreshed as ConnectedAccountsDashboard);
      }
      setActionState({ type: "success", message: `${platform.name} linked.` });
      return true;
    } catch (error) {
      setActionState({ type: "error", message: error instanceof Error ? error.message : "Could not connect account" });
      return false;
    } finally {
      setBusyKey(null);
    }
  }

  async function syncAccount(account: ConnectedAccountView) {
    setBusyKey(`sync-${account.id}`);
    try {
      await requestDashboard(`/api/connected-accounts/${account.id}/sync`, {
        method: "POST",
        body: JSON.stringify({ syncType: "full" }),
      });
      const refreshed = await requestDashboard("/api/connected-accounts");
      setDashboard(refreshed as ConnectedAccountsDashboard);
      setActionState({ type: "success", message: `${account.platformName} sync completed.` });
    } catch (error) {
      setActionState({ type: "error", message: error instanceof Error ? error.message : "Sync failed" });
    } finally {
      setBusyKey(null);
    }
  }

  async function toggleActive(account: ConnectedAccountView) {
    setBusyKey(`toggle-${account.id}`);
    try {
      await requestDashboard(`/api/connected-accounts/${account.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !account.isActive }),
      });
      const refreshed = await requestDashboard("/api/connected-accounts");
      setDashboard(refreshed as ConnectedAccountsDashboard);
      setActionState({
        type: "success",
        message: `${account.platformName} ${account.isActive ? "paused" : "resumed"}.`,
      });
    } catch (error) {
      setActionState({ type: "error", message: error instanceof Error ? error.message : "Could not update account" });
    } finally {
      setBusyKey(null);
    }
  }

  async function disconnectAccount(account: ConnectedAccountView) {
    const confirmed = window.confirm(`Disconnect ${account.platformName}? Mesh.me will remove the saved connection and local permission records.`);
    if (!confirmed) return;

    setBusyKey(`delete-${account.id}`);
    try {
      await requestDashboard(`/api/connected-accounts/${account.id}`, { method: "DELETE" });
      const refreshed = await requestDashboard("/api/connected-accounts");
      setDashboard(refreshed as ConnectedAccountsDashboard);
      setActionState({ type: "success", message: `${account.platformName} disconnected.` });
    } catch (error) {
      setActionState({ type: "error", message: error instanceof Error ? error.message : "Could not disconnect account" });
    } finally {
      setBusyKey(null);
    }
  }

  async function foldPersona(persona: PersonaView) {
    setBusyKey(`fold-${persona.id}`);
    try {
      const result = await foldPersonaIntoMainIdentity(persona.id);
      if (result && "error" in result && result.error) throw new Error(result.error);
      const refreshed = await requestDashboard("/api/connected-accounts");
      setDashboard(refreshed as ConnectedAccountsDashboard);
      setPersonas((current) => current.filter((entry) => entry.id !== persona.id));
      setActionState({ type: "success", message: `@${persona.username} folded into your account.` });
    } catch (error) {
      setActionState({ type: "error", message: error instanceof Error ? error.message : "Could not unify identity" });
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <main data-testid="connected-accounts-center" className="ds-page-shell animate-page-enter grid gap-6">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-bold tracking-[0] sm:text-4xl">Connected accounts</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)] sm:text-base">
            Bring your platforms into one mesh. One tap to connect — you approve every permission, and Mesh.me never sees your passwords.
          </p>
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)]">
            <ShieldCheck className="h-4 w-4 text-[var(--accent)]" aria-hidden="true" />
            Official APIs only · disconnect anytime
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" loading={busyKey === "refresh"} onClick={refreshDashboard}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </Button>
        </div>
      </header>

      {/* The One Mesh — your mesh.me identity at the center, every connected
          account threading home to it. */}
      <section className="grid gap-4 rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface)] p-5 sm:p-6">
        <OneMeshHub identity={identity} accounts={hubAccounts} />
        <p className="mx-auto max-w-md text-center text-sm leading-6 text-[var(--text-secondary)]">
          {hubAccounts.length > 0 ? (
            <>
              Every platform you connect threads back to one identity —{" "}
              <span className="font-semibold text-[var(--text-primary)]">@{identity.username}</span>. Synced
              accounts stream their content home.
            </>
          ) : (
            "This is your one mesh.me account. Connect a platform below and watch it thread into your mesh."
          )}
        </p>
      </section>

      {personas.length > 0 && (
        <section className="grid gap-3 rounded-[var(--ds-radius-lg)] border border-[var(--accent)]/30 bg-[var(--accent-subtle)] p-5">
          <div>
            <h2 className="text-lg font-bold">Bring your other identities home</h2>
            <p className="text-sm leading-6 text-[var(--text-secondary)]">
              Fold a separate persona’s connections into your one mesh.me account — nothing stays split off.
            </p>
          </div>
          <div className="grid gap-2">
            {personas.map((persona) => (
              <div
                key={persona.id}
                className="flex items-center gap-3 rounded-[var(--ds-radius-md)] border border-[var(--ds-border)] bg-[var(--ds-surface)] p-3"
              >
                <PlatformAvatar platform="mesh" name={persona.displayName || persona.username} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-[var(--text-primary)]">@{persona.username}</p>
                  <p className="truncate text-xs text-[var(--text-muted)]">
                    {persona.accountCount} connection{persona.accountCount === 1 ? "" : "s"}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  loading={busyKey === `fold-${persona.id}`}
                  onClick={() => foldPersona(persona)}
                >
                  <Combine className="h-4 w-4" aria-hidden="true" />
                  Fold in
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      {fromOnboarding && quickMergePlatforms.length > 0 && (
        <section className="grid gap-3 rounded-[var(--ds-radius-lg)] border border-[var(--accent)]/40 bg-[var(--accent-subtle)] p-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/15 text-[var(--accent)]">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-lg font-bold">Finish setting up the apps you picked</h2>
              <p className="text-sm leading-6 text-[var(--text-secondary)]">
                Connect each one below to pull your presence into a single mesh.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {quickMergePlatforms.map((platform) => (
              <span key={`quick-${platform.id}`} className="inline-flex items-center gap-2 rounded-full border border-[var(--ds-border)] bg-[var(--ds-surface)] py-1 pl-1 pr-3 text-sm font-semibold text-[var(--text-primary)]">
                <span className="[&>div]:h-7 [&>div]:w-7 [&>div]:text-[10px]">
                  <PlatformAvatar platform={platform.id} name={platform.name} />
                </span>
                {platform.name}
              </span>
            ))}
          </div>
        </section>
      )}

      {dashboard.accounts.length > 0 && (
        <section className="grid gap-3">
          <div>
            <h2 className="text-xl font-bold">Your connections</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              {dashboard.summary.active} of {dashboard.summary.connected} syncing
              {dashboard.summary.syncErrors > 0 && ` · ${dashboard.summary.syncErrors} need${dashboard.summary.syncErrors === 1 ? "s" : ""} attention`}
            </p>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {dashboard.accounts.map((account, idx) => (
              <motion.div
                key={account.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.32, delay: Math.min(idx * 0.06, 0.4), ease: [0.16, 1, 0.3, 1] }}
              >
                <AccountCard
                  account={account}
                  busyKey={busyKey}
                  onSync={syncAccount}
                  onToggleActive={toggleActive}
                  onDisconnect={disconnectAccount}
                />
              </motion.div>
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-3">
        <div>
          <h2 className="text-xl font-bold">{dashboard.accounts.length > 0 ? "Add more platforms" : "Connect your first platform"}</h2>
          <p className="text-sm text-[var(--text-secondary)]">
            One-tap connect where platforms support it, or link a public handle for the rest.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search platforms"
            leftAddon={<Search className="h-4 w-4" aria-hidden="true" />}
            className="sm:max-w-xs"
          />
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Platform categories">
            {(["all", ...categories] as (PlatformAdapterCategory | "all")[]).map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={category === value}
                onClick={() => setCategory(value)}
                className={cn(
                  "ds-focus-ring rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors",
                  category === value
                    ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast,#fff)]"
                    : "border-[var(--ds-border)] bg-[var(--ds-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                )}
              >
                {categoryLabels[value]}
              </button>
            ))}
          </div>
        </div>

        {filteredPlatforms.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {filteredPlatforms.map((platform, idx) => (
                <motion.div
                  key={platform.id}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.28, delay: Math.min(idx * 0.035, 0.4), ease: [0.16, 1, 0.3, 1] }}
                  layout
                >
                  <PlatformCard
                    platform={platform}
                    busyKey={busyKey}
                    onConnectManual={connectManualAccount}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="rounded-[var(--ds-radius-md)] border border-dashed border-[var(--ds-border)] bg-[var(--ds-surface)] px-5 py-8 text-center">
            <Search className="mx-auto h-8 w-8 text-[var(--text-muted)]" aria-hidden="true" />
            <p className="mt-3 text-sm text-[var(--text-secondary)]">No platforms match your search. Try a different name or category.</p>
          </div>
        )}
      </section>

      <Toast state={actionState} onDismiss={dismissToast} />
    </main>
  );
}
