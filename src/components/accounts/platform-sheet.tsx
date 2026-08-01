"use client";

// EVERYTHING THE TILE COULD NOT SAY IN ONE LINE.
//
// The grid answers "in or not". This answers the rest, for one platform, at the
// moment somebody asked about that platform: the handle, what has synced, what
// it can and cannot read before you connect, which scopes the provider
// actually confirmed, and the three controls that change something — sync,
// pause, disconnect.
//
// It is the same information the old page printed for all twelve platforms at
// once, in two stacked sections and a wall of badges. None of it was deleted.
// It was moved to where it is relevant, which is the only reason the grid could
// become a grid.

import Link from "next/link";
import { motion } from "framer-motion";
import { PauseCircle, PlayCircle, PlugZap, RefreshCw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { PlatformLogo } from "@/components/platform/platform-logo";
import { cn, formatCount } from "@/lib/utils";
import type { ConnectedAccountView, SupportedPlatformView } from "@/lib/connected-accounts";
import type { PlatformAdapterCapabilityKey } from "@/lib/platform-adapters";
import type { SupplyNote } from "@/app/(app)/connected-accounts/public-supply-status";

// What connecting this platform actually gets you. Read from the adapter's own
// capability table, which is derived from the messaging/capability registries
// rather than restated here — the version that was restated said X and Reddit
// could not sync messages while the sync path was actively mirroring them.
const CAPABILITY_LABELS: Record<PlatformAdapterCapabilityKey, string> = {
  profile: "Profile",
  content: "Posts",
  messages: "Messages",
  notifications: "Alerts",
  analytics: "Analytics",
  posting: "Post from mesh",
  actions: "Likes & replies",
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
  // Retired is neutral, not red. Mesh.me stopped offering the platform; the
  // person did nothing wrong and nothing is failing. Danger styling here would
  // read as "your account is broken" for a state that is purely our decision.
  if (account.health === "retired") return "secondary";
  if (account.health === "paused") return "warning";
  return "danger";
}

function AccountBlock({
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
  // "Granted" means the PROVIDER told us it granted this scope. When a provider
  // returns no scope field the OAuth callback falls back to what we requested,
  // and this used to count those too — so a user who unticked a scope on the
  // consent screen was still shown it as granted. Only provider-confirmed
  // scopes are counted; the rest are reported as requested, which is the true
  // statement we can make about them.
  const confirmedCount = account.permissions.filter(
    (permission) => permission.state === "granted" && permission.source === "oauth_scope",
  ).length;
  const assumedCount = account.permissions.filter(
    (permission) => permission.state === "granted" && permission.source !== "oauth_scope",
  ).length;
  const counts: [string, number][] = [
    ["Posts", account.counts.posts],
    ["Comments", account.counts.comments],
    ["Followers", account.counts.followers],
    ["Media", account.counts.media],
  ];
  const withData = counts.filter(([, value]) => value > 0);

  return (
    <div className="grid gap-3 rounded-[var(--ds-radius-md)] border border-[var(--ds-border)] bg-[var(--bg-primary)]/45 p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--text-primary)]">
          {account.platformUsername ? `@${account.platformUsername}` : account.accountLabel || "Connected"}
        </p>
        <Badge variant={statusVariant(account)}>{account.healthLabel}</Badge>
      </div>

      {account.syncError && (
        <p className="text-xs leading-5 text-[var(--ds-danger)]">{account.syncError}</p>
      )}

      <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-secondary)]">
        {withData.map(([label, value]) => (
          <div key={label} className="flex items-baseline gap-1">
            <dt className="text-[var(--text-muted)]">{label}</dt>
            <dd className="font-semibold tabular-nums text-[var(--text-primary)]">{formatCount(value)}</dd>
          </div>
        ))}
        <div className="flex items-baseline gap-1">
          <dt className="text-[var(--text-muted)]">Last sync</dt>
          <dd className="font-semibold text-[var(--text-primary)]">{formatDate(account.lastSyncAt)}</dd>
        </div>
      </dl>

      {/* Confirmed and assumed are different claims about what you agreed to,
          and must never be summed into one figure labelled "granted". */}
      {(confirmedCount > 0 || assumedCount > 0) && (
        <p className="text-xs leading-5 text-[var(--text-muted)]">
          {confirmedCount > 0 && `${confirmedCount} permission${confirmedCount === 1 ? "" : "s"} confirmed by ${account.platformName}`}
          {confirmedCount > 0 && assumedCount > 0 && " · "}
          {assumedCount > 0 && `${assumedCount} requested but never confirmed back`}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {needsReconnect && account.adapter?.connectHref ? (
          <Link href={account.adapter.connectHref} prefetch={false} className={cn(buttonVariants({ size: "sm" }))}>
            <PlugZap className="h-4 w-4" aria-hidden="true" />
            Reconnect
          </Link>
        ) : null}
        {/* No Sync control for a manual reference or a retired platform: neither
            carries anything syncable, so the button could only ever render
            disabled — dead chrome promising an import that cannot happen. */}
        {account.authType !== "manual" && account.health !== "retired" && !needsReconnect && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={busyKey === `sync-${account.id}`}
            disabled={!canSync || isBusy}
            onClick={() => onSync(account)}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Sync now
          </Button>
        )}
        {account.health !== "retired" && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            loading={busyKey === `toggle-${account.id}`}
            disabled={isBusy}
            onClick={() => onToggleActive(account)}
          >
            {account.isActive ? (
              <>
                <PauseCircle className="h-4 w-4" aria-hidden="true" />
                Pause
              </>
            ) : (
              <>
                <PlayCircle className="h-4 w-4" aria-hidden="true" />
                Resume
              </>
            )}
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-[var(--ds-danger)]"
          disabled={isBusy}
          onClick={() => onDisconnect(account)}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Disconnect
        </Button>
      </div>
    </div>
  );
}

export function PlatformSheet({
  platform,
  accounts,
  supplyNote,
  busyKey,
  onClose,
  onSync,
  onToggleActive,
  onDisconnect,
}: {
  /** Null closes the sheet. */
  platform: SupportedPlatformView | null;
  accounts: ConnectedAccountView[];
  supplyNote: SupplyNote | null;
  busyKey: string | null;
  onClose: () => void;
  onSync: (account: ConnectedAccountView) => void;
  onToggleActive: (account: ConnectedAccountView) => void;
  onDisconnect: (account: ConnectedAccountView) => void;
}) {
  const open = platform !== null;
  const canConnect = platform
    ? platform.authType !== "oauth" || (platform.configured && Boolean(platform.connectHref))
    : false;
  const enabledCapabilities = platform
    ? (Object.entries(platform.capabilities)
        .filter(([, enabled]) => enabled)
        .map(([key]) => key) as PlatformAdapterCapabilityKey[])
    : [];

  return (
    <Modal open={open} onClose={onClose} title={platform?.name ?? "Platform"}>
      {platform && (
        <div className="grid gap-4">
          <motion.div
            className="flex items-center gap-3"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <PlatformLogo platform={platform.id} size={44} className="shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                {accounts.length > 0
                  ? `${accounts.length} connection${accounts.length === 1 ? "" : "s"} merged`
                  : "Not merged yet"}
              </p>
              {supplyNote && (
                <p className="text-xs font-semibold text-[var(--text-muted)]">{supplyNote.label} without connecting</p>
              )}
            </div>
          </motion.div>

          {/* The platform's own policy reason, from the supply registry. This is
              the sentence that stops "connect Instagram to see Instagram" from
              being a surprise discovered after connecting. */}
          {supplyNote && (
            <p className="text-sm leading-6 text-[var(--text-secondary)]">{supplyNote.reason}</p>
          )}

          {/* What connecting brings. Every entry is read from the adapter's
              capability table, so this cannot advertise a lane the code does not
              implement — most of these platforms cannot be posted to from here,
              and the badge row is where that is legible instead of implied. */}
          <div className="flex flex-wrap items-center gap-1.5">
            {enabledCapabilities.length > 0 ? (
              enabledCapabilities.map((key) => (
                <Badge key={key} variant="accent">
                  {CAPABILITY_LABELS[key]}
                </Badge>
              ))
            ) : (
              <Badge variant="outline">Profile only</Badge>
            )}
          </div>

          {accounts.length > 0 && (
            <div className="grid gap-2.5">
              {accounts.map((account) => (
                <AccountBlock
                  key={account.id}
                  account={account}
                  busyKey={busyKey}
                  onSync={onSync}
                  onToggleActive={onToggleActive}
                  onDisconnect={onDisconnect}
                />
              ))}
            </div>
          )}

          {canConnect && platform.connectHref && (
            <Link href={platform.connectHref} prefetch={false} className={cn(buttonVariants(), "w-full")}>
              <PlugZap className="h-4 w-4" aria-hidden="true" />
              {accounts.length > 0 ? `Add another ${platform.name} account` : `Connect ${platform.name}`}
            </Link>
          )}

          {/* "Coming soon" was a promise nobody scheduled. The platform is inert
              because this deployment lacks the provider credentials — say that,
              and hand the owner the exact switch. */}
          {!canConnect && platform.missingEnv.length > 0 && (
            <div className="grid gap-2 rounded-[var(--ds-radius-md)] border border-[var(--ds-border)] bg-[var(--bg-primary)]/45 p-3.5">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Not set up on this deployment</p>
              <p className="text-xs leading-5 text-[var(--text-secondary)]">
                {platform.name} sign-in needs a developer app on {platform.name}&apos;s side. Add these to the
                deployment and redeploy:
              </p>
              <ul className="grid gap-1">
                {platform.missingEnv.map((name) => (
                  <li key={name}>
                    <code className="rounded bg-[var(--ds-surface)] px-1.5 py-0.5 font-mono text-[0.6875rem] text-[var(--text-primary)]">
                      {name}
                    </code>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs leading-5 text-[var(--text-muted)]">{platform.notes}</p>
        </div>
      )}
    </Modal>
  );
}
