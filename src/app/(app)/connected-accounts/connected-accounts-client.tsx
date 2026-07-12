"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Link2,
  PauseCircle,
  PlugZap,
  RefreshCw,
  Search,
  Sparkles,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { cn, formatCount } from "@/lib/utils";
import type {
  ConnectedAccountView,
  ConnectedAccountsDashboard,
  SupportedPlatformView,
} from "@/lib/connected-accounts";
import type { PlatformAdapterCategory, PlatformAdapterCapabilityKey } from "@/lib/platform-adapters";

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

function platformInitial(platform: string) {
  return platform.trim().charAt(0).toUpperCase() || "M";
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

function PermissionList({ account }: { account: ConnectedAccountView }) {
  const grantedCount = account.permissions.filter((permission) => permission.state === "granted").length;

  return (
    <details className="group rounded-[var(--ds-radius-md)] border border-[var(--ds-border)] bg-[var(--bg-primary)]/55">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-[var(--text-primary)]">
        <span className="inline-flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />
          Permissions
        </span>
        <span className="text-xs text-[var(--text-muted)]">{grantedCount} granted</span>
      </summary>
      <div className="grid gap-2 border-t border-[var(--ds-border)] px-3 py-3">
        {account.permissions.map((permission) => (
          <div key={`${account.id}-${permission.key}`} className="grid gap-1 rounded-[var(--ds-radius-sm)] bg-[var(--bg-secondary)] px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-[var(--text-primary)]">{permission.label}</span>
              <Badge variant={permission.state === "granted" ? "success" : "outline"}>{permission.state}</Badge>
              <Badge variant="outline">{permission.mode.replace("_", " ")}</Badge>
            </div>
            <p className="text-xs leading-5 text-[var(--text-secondary)]">{permission.description}</p>
          </div>
        ))}
      </div>
    </details>
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
  const countItems = [
    ["Posts", account.counts.posts],
    ["Comments", account.counts.comments],
    ["Followers", account.counts.followers],
    ["Media", account.counts.media],
  ];

  return (
    <Card className="connected-account-card h-full overflow-hidden" hover>
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[var(--ds-border)] bg-[var(--accent-subtle)] text-base font-bold text-[var(--accent)]">
              {platformInitial(account.platformName)}
            </div>
            <div className="min-w-0">
              <CardTitle className="truncate">{account.platformName}</CardTitle>
              <CardDescription className="truncate">
                {account.platformUsername ? `@${account.platformUsername}` : account.accountLabel || "Connected account"}
              </CardDescription>
            </div>
          </div>
          <Badge variant={statusVariant(account)}>{account.healthLabel}</Badge>
        </div>
      </CardHeader>

      <CardContent className="grid gap-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {countItems.map(([label, value]) => (
            <div key={label} className="rounded-[var(--ds-radius-sm)] border border-[var(--ds-border)] bg-[var(--bg-primary)]/55 px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">{label}</p>
              <p className="mt-1 text-sm font-bold text-[var(--text-primary)]">{formatCount(Number(value))}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-1 text-sm text-[var(--text-secondary)]">
          <p>
            <span className="font-semibold text-[var(--text-primary)]">Last sync:</span> {formatDate(account.lastSyncAt)}
          </p>
          <p>
            <span className="font-semibold text-[var(--text-primary)]">Auth:</span> {account.authType === "oauth" ? "OAuth" : "Manual reference"}
          </p>
          {account.syncError && <p className="text-[var(--ds-danger)]">{account.syncError}</p>}
          {needsReconnect && <p className="text-[var(--ds-warning)]">Reconnect this account to restore token access.</p>}
        </div>

        <PermissionList account={account} />

        <div className="flex flex-wrap gap-2">
          {account.authType === "oauth" && account.adapter?.connectHref && (
            <Link
              href={account.adapter.connectHref}
              prefetch={false}
              className={cn(buttonVariants({ variant: needsReconnect ? "default" : "secondary", size: "sm" }))}
            >
              <Link2 className="h-4 w-4" aria-hidden="true" />
              {needsReconnect ? "Reconnect" : "Refresh OAuth"}
            </Link>
          )}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={busyKey === `sync-${account.id}`}
            disabled={!canSync || isBusy}
            onClick={() => onSync(account)}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Sync
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            loading={busyKey === `toggle-${account.id}`}
            disabled={isBusy}
            onClick={() => onToggleActive(account)}
          >
            <PauseCircle className="h-4 w-4" aria-hidden="true" />
            {account.isActive ? "Pause" : "Resume"}
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
      </CardContent>
    </Card>
  );
}

function PlatformCard({
  platform,
  onChooseManual,
}: {
  platform: SupportedPlatformView;
  onChooseManual: (platform: SupportedPlatformView) => void;
}) {
  const enabledCapabilities = Object.entries(platform.capabilities)
    .filter(([, enabled]) => enabled)
    .map(([key]) => key as PlatformAdapterCapabilityKey);
  const authLabel = platform.authType === "oauth" ? "OAuth" : "Manual";

  return (
    <Card className="h-full" hover>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate">{platform.name}</CardTitle>
            <CardDescription>{categoryLabels[platform.category]} · {authLabel}</CardDescription>
          </div>
          {platform.activeCount > 0 ? (
            <Badge variant="success">{platform.activeCount} active</Badge>
          ) : platform.configured ? (
            <Badge variant="secondary">Ready</Badge>
          ) : (
            <Badge variant="warning">Setup needed</Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="grid gap-4">
        <p className="text-sm leading-6 text-[var(--text-secondary)]">{platform.notes}</p>

        <div className="flex flex-wrap gap-2">
          {enabledCapabilities.length > 0 ? enabledCapabilities.map((key) => (
            <Badge key={key} variant="accent">{capabilityLabels[key]}</Badge>
          )) : <Badge variant="outline">Profile only</Badge>}
          <Badge variant="outline">Official API only</Badge>
          <Badge variant="outline">No scraping</Badge>
        </div>

        <details className="rounded-[var(--ds-radius-md)] border border-[var(--ds-border)] bg-[var(--bg-primary)]/55">
          <summary className="cursor-pointer list-none px-3 py-2 text-sm font-semibold text-[var(--text-primary)]">
            OAuth and permission details
          </summary>
          <div className="grid gap-2 border-t border-[var(--ds-border)] px-3 py-3 text-xs leading-5 text-[var(--text-secondary)]">
            {platform.callbackUrl && <p className="break-all"><span className="font-semibold text-[var(--text-primary)]">Callback:</span> {platform.callbackUrl}</p>}
            <p><span className="font-semibold text-[var(--text-primary)]">Sync:</span> {platform.syncCadence}</p>
            {platform.missingEnv.length > 0 && (
              <p><span className="font-semibold text-[var(--text-primary)]">Server setup:</span> {platform.missingEnv.join(", ")}</p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {platform.permissions.map((permission) => (
                <Badge key={`${platform.id}-${permission.key}`} variant="outline">{permission.label}</Badge>
              ))}
            </div>
          </div>
        </details>

        <div className="flex flex-wrap gap-2">
          {platform.authType === "oauth" ? (
            platform.configured && platform.connectHref ? (
              <Link href={platform.connectHref} prefetch={false} className={cn(buttonVariants({ size: "sm" }))}>
                <PlugZap className="h-4 w-4" aria-hidden="true" />
                Connect
              </Link>
            ) : (
              <Button type="button" disabled size="sm">
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
                Needs setup
              </Button>
            )
          ) : (
            <Button type="button" size="sm" onClick={() => onChooseManual(platform)}>
              <PlugZap className="h-4 w-4" aria-hidden="true" />
              Add handle
            </Button>
          )}
          {platform.docsUrl && (
            <a
              href={platform.docsUrl}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            >
              Docs
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function ConnectedAccountsClient({
  initialDashboard,
  fromOnboarding = false,
  preselectPlatforms = [],
}: {
  initialDashboard: ConnectedAccountsDashboard;
  fromOnboarding?: boolean;
  preselectPlatforms?: string[];
}) {
  const [dashboard, setDashboard] = useState(initialDashboard);
  const [actionState, setActionState] = useState<ActionState>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<PlatformAdapterCategory | "all">("all");
  const manualPlatforms = dashboard.supportedPlatforms.filter((platform) => platform.authType === "manual");
  const [manualPlatform, setManualPlatform] = useState(manualPlatforms[0]?.id ?? "bluesky");
  const [manualUsername, setManualUsername] = useState("");
  const [manualLabel, setManualLabel] = useState("");
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

  async function connectManualAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyKey("manual-connect");
    try {
      const result = await requestDashboard("/api/connected-accounts", {
        method: "POST",
        body: JSON.stringify({
          platform: manualPlatform,
          username: manualUsername,
          accountLabel: manualLabel,
        }),
      });
      if ("dashboard" in result && result.dashboard) setDashboard(result.dashboard);
      else await refreshDashboard();
      setManualUsername("");
      setManualLabel("");
      setActionState({ type: "success", message: "Manual account reference added." });
    } catch (error) {
      setActionState({ type: "error", message: error instanceof Error ? error.message : "Could not connect account" });
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

  function chooseManualPlatform(platform: SupportedPlatformView) {
    setManualPlatform(platform.id);
    setActionState({ type: "info", message: `Add your ${platform.name} username below.` });
  }

  return (
    <main data-testid="connected-accounts-center" className="ds-page-shell animate-page-enter grid gap-5">
      <header className="grid gap-4">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--ds-border)] bg-[var(--ds-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)]">
              <ShieldCheck className="h-4 w-4 text-[var(--accent)]" aria-hidden="true" />
              Official APIs, consent, and clear permissions
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-[0] sm:text-4xl">Connected accounts</h1>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)] sm:text-base">
              Link the services you actually use. Mesh.me stores only the connection you authorize, shows every permission clearly, and never asks for outside passwords.
            </p>
          </div>
          <Button type="button" variant="secondary" loading={busyKey === "refresh"} onClick={refreshDashboard}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </Button>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Connected", dashboard.summary.connected],
            ["Active", dashboard.summary.active],
            ["OAuth ready", dashboard.summary.oauthReady],
            ["Manual sources", dashboard.summary.manualAvailable],
            ["Sync issues", dashboard.summary.syncErrors],
          ].map(([label, value]) => (
            <div key={label} className="rounded-[var(--ds-radius-md)] border border-[var(--ds-border)] bg-[var(--ds-surface)] px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">{label}</p>
              <p className="mt-1 text-xl font-bold text-[var(--text-primary)]">{value}</p>
            </div>
          ))}
        </div>
      </header>

      {actionState && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-[var(--ds-radius-md)] border px-4 py-3 text-sm",
            actionState.type === "error" && "border-[var(--ds-danger-border)] bg-[var(--ds-danger-bg)] text-[var(--ds-danger)]",
            actionState.type === "success" && "border-[var(--ds-success-border)] bg-[var(--ds-success-bg)] text-[var(--ds-success)]",
            actionState.type === "info" && "border-[var(--ds-border)] bg-[var(--ds-surface)] text-[var(--text-secondary)]",
          )}
          role="status"
        >
          {actionState.type === "error" ? <AlertCircle className="h-4 w-4" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
          {actionState.message}
        </div>
      )}

      {fromOnboarding && quickMergePlatforms.length > 0 && (
        <section className="grid gap-3 rounded-[var(--ds-radius-lg)] border border-[var(--accent)]/40 bg-[var(--accent-subtle)] p-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/15 text-[var(--accent)]">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-lg font-bold">Merge the apps you picked</h2>
              <p className="text-sm leading-6 text-[var(--text-secondary)]">
                Connect each one to pull your presence into a single mesh. One-tap for OAuth platforms, a quick handle for the rest.
              </p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {quickMergePlatforms.map((platform) => (
              <div
                key={`quick-${platform.id}`}
                className="flex items-center justify-between gap-3 rounded-[var(--ds-radius-md)] border border-[var(--ds-border)] bg-[var(--ds-surface)] px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-[var(--text-primary)]">{platform.name}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {platform.authType === "oauth" ? "One-tap connect" : "Add handle"}
                  </p>
                </div>
                {platform.authType === "oauth" && platform.configured && platform.connectHref ? (
                  <Link href={platform.connectHref} prefetch={false} className={cn(buttonVariants({ size: "sm" }))}>
                    <PlugZap className="h-4 w-4" aria-hidden="true" />
                    Connect
                  </Link>
                ) : platform.authType === "manual" ? (
                  <Button type="button" size="sm" variant="secondary" onClick={() => chooseManualPlatform(platform)}>
                    Add
                  </Button>
                ) : (
                  <Badge variant="warning">Setup needed</Badge>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-3">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-xl font-bold">Your connections</h2>
            <p className="text-sm text-[var(--text-secondary)]">Sync status, permissions, and disconnect controls in one place.</p>
          </div>
        </div>

        {dashboard.accounts.length > 0 ? (
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
        ) : (
          <div className="rounded-[var(--ds-radius-md)] border border-dashed border-[var(--ds-border)] bg-[var(--ds-surface)] px-5 py-8 text-center">
            <PlugZap className="mx-auto h-9 w-9 text-[var(--text-muted)]" aria-hidden="true" />
            <h3 className="mt-3 text-lg font-bold">No accounts connected yet</h3>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--text-secondary)]">
              Start with one OAuth platform or add a manual public handle. Mesh.me will keep the source visible and permission-based.
            </p>
          </div>
        )}
      </section>

      <section className="grid gap-3">
        <div>
          <h2 className="text-xl font-bold">Add a manual account</h2>
          <p className="text-sm text-[var(--text-secondary)]">Use this for platforms where Mesh.me can safely reference a public handle but cannot use OAuth yet.</p>
        </div>
        <form onSubmit={connectManualAccount} className="grid gap-3 rounded-[var(--ds-radius-md)] border border-[var(--ds-border)] bg-[var(--ds-surface)] p-4 md:grid-cols-[12rem_1fr_1fr_auto]">
          <Field label="Platform" htmlFor="manual-platform">
            <select
              id="manual-platform"
              value={manualPlatform}
              onChange={(event) => setManualPlatform(event.target.value)}
              className="ds-focus-ring h-[var(--ds-control-height-lg)] rounded-[var(--ds-radius-md)] border border-[var(--ds-border)] bg-[var(--bg-input)] px-3 text-sm text-[var(--text-primary)]"
            >
              {manualPlatforms.map((platform) => <option key={platform.id} value={platform.id}>{platform.name}</option>)}
            </select>
          </Field>
          <Field label="Username or handle" htmlFor="manual-username">
            <Input
              id="manual-username"
              value={manualUsername}
              onChange={(event) => setManualUsername(event.target.value)}
              placeholder="@username"
              autoComplete="off"
            />
          </Field>
          <Field label="Label" htmlFor="manual-label" description="Optional. Helpful when you have multiple accounts.">
            <Input
              id="manual-label"
              value={manualLabel}
              onChange={(event) => setManualLabel(event.target.value)}
              placeholder="Creator account"
              autoComplete="off"
            />
          </Field>
          <div className="flex items-end">
            <Button type="submit" className="w-full" loading={busyKey === "manual-connect"} disabled={!manualUsername.trim()}>
              Connect
            </Button>
          </div>
        </form>
      </section>

      <section className="grid gap-3">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
          <div>
            <h2 className="text-xl font-bold">Supported platforms</h2>
            <p className="text-sm text-[var(--text-secondary)]">OAuth where official APIs allow it. Manual references where they do not.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search platforms"
              leftAddon={<Search className="h-4 w-4" aria-hidden="true" />}
              className="sm:w-64"
            />
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as PlatformAdapterCategory | "all")}
              className="ds-focus-ring h-[var(--ds-control-height-lg)] rounded-[var(--ds-radius-md)] border border-[var(--ds-border)] bg-[var(--bg-input)] px-3 text-sm text-[var(--text-primary)]"
            >
              <option value="all">All categories</option>
              {categories.map((value) => <option key={value} value={value}>{categoryLabels[value]}</option>)}
            </select>
          </div>
        </div>

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
            <PlatformCard platform={platform} onChooseManual={chooseManualPlatform} />
            </motion.div>
          ))}
          </AnimatePresence>
        </div>
      </section>
    </main>
  );
}
