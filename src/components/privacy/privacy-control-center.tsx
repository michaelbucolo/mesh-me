"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useMemo, useState, useTransition } from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Database,
  Download,
  Eye,
  EyeOff,
  FileDown,
  KeyRound,
  Loader2,
  LockKeyhole,
  Pause,
  Play,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UserRound,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { updateMeshPrivacy, updatePrivacy } from "@/lib/actions";
import { cn, formatCount, formatRelativeTime } from "@/lib/utils";
import type { PrivacyControlCenterData } from "@/lib/privacy-control-center";

type ControlData = NonNullable<PrivacyControlCenterData>;
type Account = ControlData["connected"]["accounts"][number];
type ImportedPost = ControlData["recentImportedContent"][number];
type VisibilityPolicy = ControlData["visibilityPolicies"][number];
type Notice = { type: "success" | "error"; message: string } | null;

const visibilityOptions = ["private", "friends", "public", "unlisted", "hidden"] as const;
const meshVisibilityOptions = ["private", "friends", "public", "partial"] as const;

const defaultPolicyRows = [
  {
    entityType: "profile",
    label: "Profile",
    description: "Who can discover your identity outside direct shares.",
    defaultVisibility: "private",
  },
  {
    entityType: "native_posts",
    label: "Mesh.me posts",
    description: "Default handling for posts created directly on Mesh.me.",
    defaultVisibility: "friends",
  },
  {
    entityType: "messages",
    label: "MeChat",
    description: "Message metadata and shared post privacy.",
    defaultVisibility: "private",
  },
  {
    entityType: "analytics",
    label: "Analytics",
    description: "Performance data used inside the private analytics dashboard.",
    defaultVisibility: "private",
  },
  {
    entityType: "meshi_memory",
    label: "Meshi memory",
    description: "What Meshi can use locally to answer questions about your Mesh.",
    defaultVisibility: "private",
  },
] as const;

function formatDate(value: string | null) {
  if (!value) return "Never";
  return formatRelativeTime(value);
}

async function requestJson<T>(url: string, init: RequestInit) {
  const response = await fetch(url, {
    credentials: "same-origin",
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || "Request failed");
  }
  return payload as T;
}

function accountLabel(account: Pick<Account, "platformName" | "platformUsername" | "accountLabel">) {
  return account.accountLabel || account.platformUsername || account.platformName;
}

export function PrivacyControlCenter({ data }: { data: ControlData }) {
  const router = useRouter();
  const [accounts, setAccounts] = useState(data.connected.accounts);
  const [recentContent, setRecentContent] = useState(data.recentImportedContent);
  const [policies, setPolicies] = useState(data.visibilityPolicies);
  const [profilePrivacy, setProfilePrivacy] = useState({
    isPublic: data.user.isPublic,
    showInDiscovery: data.user.showInDiscovery,
    hideActivityStatus: data.user.hideActivityStatus,
    readReceipts: data.user.readReceipts,
  });
  const [meshPrivacy, setMeshPrivacy] = useState({
    meshVisibility: data.meshPrivacy.meshVisibility,
    showConnections: data.meshPrivacy.showConnections,
    showStats: data.meshPrivacy.showStats,
  });
  const [notice, setNotice] = useState<Notice>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [confirmingImportDelete, setConfirmingImportDelete] = useState<{ account: Account | null } | null>(null);
  const [isPending, startTransition] = useTransition();

  const policyByType = useMemo(() => {
    const legacyAliases: Record<string, string> = { meshi_ai: "meshi_memory" };
    const map = new Map<string, VisibilityPolicy>();
    for (const policy of policies) {
      const normalized = legacyAliases[policy.entityType] || policy.entityType;
      if (!policy.entityId && !map.has(normalized)) {
        map.set(normalized, policy);
      }
    }
    return map;
  }, [policies]);

  async function runMutation<T>(
    key: string,
    successMessage: string,
    task: () => Promise<T>,
    onSuccess?: (payload: T) => void,
  ) {
    setPendingKey(key);
    setNotice(null);
    try {
      const payload = await task();
      onSuccess?.(payload);
      setNotice({ type: "success", message: successMessage });
      router.refresh();
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Action failed" });
    } finally {
      setPendingKey(null);
    }
  }

  function saveProfilePrivacy() {
    startTransition(async () => {
      setNotice(null);
      const formData = new FormData();
      formData.set("isPublic", String(profilePrivacy.isPublic));
      formData.set("showInDiscovery", String(profilePrivacy.showInDiscovery));
      formData.set("hideActivityStatus", String(profilePrivacy.hideActivityStatus));
      formData.set("readReceipts", String(profilePrivacy.readReceipts));
      const result = await updatePrivacy(formData);
      if (result && typeof result === "object" && "error" in result) {
        setNotice({ type: "error", message: String(result.error) });
        return;
      }
      setNotice({ type: "success", message: "Profile privacy saved." });
      router.refresh();
    });
  }

  function saveMeshPrivacy() {
    startTransition(async () => {
      setNotice(null);
      const result = await updateMeshPrivacy({
        meshVisibility: meshPrivacy.meshVisibility,
        showConnections: meshPrivacy.showConnections,
        showStats: meshPrivacy.showStats,
      });
      if (result && typeof result === "object" && "error" in result) {
        setNotice({ type: "error", message: String(result.error) });
        return;
      }
      setNotice({ type: "success", message: "Mesh visibility saved." });
      router.refresh();
    });
  }

  function toggleSync(account: Account) {
    void runMutation(
      `sync-${account.id}`,
      account.isActive ? `${account.platformName} sync paused.` : `${account.platformName} sync resumed.`,
      () =>
        requestJson<{ account: { id: string; isActive: boolean; syncStatus: string; syncError: string | null; lastSyncAt: string | null } }>(
          `/api/connected-accounts/${account.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({ isActive: !account.isActive }),
          },
        ),
      (payload) => {
        setAccounts((current) =>
          current.map((item) =>
            item.id === account.id
              ? {
                  ...item,
                  isActive: payload.account.isActive,
                  syncStatus: payload.account.syncStatus,
                  syncError: payload.account.syncError,
                  lastSyncAt: payload.account.lastSyncAt,
                  health: payload.account.isActive ? "ready" : "paused",
                  healthLabel: payload.account.isActive ? "Ready" : "Paused",
                }
              : item,
          ),
        );
      },
    );
  }

  function syncNow(account: Account) {
    void runMutation(
      `sync-now-${account.id}`,
      `${account.platformName} sync started.`,
      () =>
        requestJson<{ success?: boolean }>(`/api/connected-accounts/${account.id}/sync`, {
          method: "POST",
          body: JSON.stringify({ syncType: "full" }),
        }),
    );
  }

  function deleteImportedData(account?: Account) {
    const scopeLabel = account ? accountLabel(account) : "all connected platforms";
    void runMutation(
      account ? `delete-import-${account.id}` : "delete-import-all",
      account ? `Imported data removed for ${scopeLabel}.` : "All imported platform data removed from Mesh.me.",
      () =>
        requestJson<{ deleted: { total: number } }>("/api/data-controls", {
          method: "POST",
          body: JSON.stringify({
            action: "delete-synced-data",
            connectedAccountId: account?.id,
          }),
        }),
      () => {
        if (account) {
          setRecentContent((current) => current.filter((post) => post.account.id !== account.id));
          setAccounts((current) =>
            current.map((item) =>
              item.id === account.id
                ? { ...item, counts: { posts: 0, comments: 0, followers: 0, media: 0 }, _count: { platformPosts: 0, platformComments: 0, platformFollowers: 0, platformMedia: 0 } }
                : item,
            ),
          );
        } else {
          setRecentContent([]);
          setAccounts((current) =>
            current.map((item) => ({
              ...item,
              counts: { posts: 0, comments: 0, followers: 0, media: 0 },
              _count: { platformPosts: 0, platformComments: 0, platformFollowers: 0, platformMedia: 0 },
            })),
          );
        }
      },
    );
  }

  function updatePostVisibility(post: ImportedPost, visibility: string) {
    void runMutation(
      `post-visibility-${post.id}`,
      visibility === "hidden" ? "Imported post hidden from Mesh.me." : "Imported post visibility updated.",
      () =>
        requestJson<{ post: { id: string; visibility: string; updatedAt: string } }>("/api/data-controls", {
          method: "POST",
          body: JSON.stringify({
            action: "update-platform-post-visibility",
            postId: post.id,
            visibility,
          }),
        }),
      (payload) => {
        setRecentContent((current) =>
          current.map((item) =>
            item.id === post.id
              ? { ...item, visibility: payload.post.visibility, updatedAt: payload.post.updatedAt }
              : item,
          ),
        );
      },
    );
  }

  function updatePolicy(row: (typeof defaultPolicyRows)[number], visibility: string) {
    const current = policyByType.get(row.entityType);
    void runMutation(
      `policy-${row.entityType}`,
      `${row.label} rule saved.`,
      () =>
        requestJson<{ policy: VisibilityPolicy }>("/api/data-controls", {
          method: "POST",
          body: JSON.stringify({
            action: "update-visibility-policy",
            entityType: row.entityType,
            visibility,
            allowDiscovery: visibility === "public",
            allowAnalytics: visibility !== "hidden",
            allowMeshiUse: row.entityType === "meshi_memory" ? visibility !== "hidden" : false,
          }),
        }),
      (payload) => {
        setPolicies((existing) => {
          const withoutCurrent = existing.filter((policy) => policy.id !== current?.id && policy.id !== payload.policy.id);
          return [payload.policy, ...withoutCurrent];
        });
      },
    );
  }

  const isBusy = isPending || Boolean(pendingKey);

  return (
    <main className="simple-page grid gap-5">
      <header className="mesh-surface mesh-pop-in rounded-lg p-4 md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Badge variant="accent" className="gap-2">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Privacy control center
            </Badge>
            <h1 className="mt-3 text-3xl font-bold leading-tight text-[var(--text-primary)] md:text-5xl">
              Own every copy of your world.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-secondary)] md:text-base">
              Review connected data, pause sync, hide imported content, export your archive, and delete your account from one place.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[23rem]">
            <LinkButton href="/api/data-controls?action=export" variant="secondary" download>
              <Download className="h-4 w-4" aria-hidden="true" />
              Export all data
            </LinkButton>
            <LinkButton href="/account/delete" variant="danger">
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Delete account
            </LinkButton>
          </div>
        </div>
      </header>

      {notice && (
        <div
          role="status"
          className={cn(
            "rounded-md border px-4 py-3 text-sm font-semibold",
            notice.type === "success"
              ? "border-[var(--ds-success-border)] bg-[var(--ds-success-bg)] text-[var(--ds-success)]"
              : "border-[var(--ds-danger-border)] bg-[var(--ds-danger-bg)] text-[var(--ds-danger)]",
          )}
        >
          <div className="flex items-center gap-2">
            {notice.type === "success" ? <CheckCircle2 size={16} aria-hidden="true" /> : <AlertTriangle size={16} aria-hidden="true" />}
            {notice.message}
          </div>
        </div>
      )}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Server} label="Connected accounts" value={formatCount(accounts.length)} detail={`${formatCount(accounts.filter((account) => account.isActive).length)} active`} />
        <MetricCard icon={Database} label="Imported records" value={formatCount(data.storedData.totals.imported)} detail="Synced copies on Mesh.me" />
        <MetricCard icon={LockKeyhole} label="Native records" value={formatCount(data.storedData.totals.native)} detail="Created inside Mesh.me" />
        <MetricCard icon={SlidersHorizontal} label="Visibility rules" value={formatCount(policies.length)} detail={`${formatCount(data.storedData.native.sessions)} active session records`} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="grid gap-5">
          <Panel
            icon={UserRound}
            title="Profile and Mesh visibility"
            description="These are the public-facing defaults people see before you choose to share more."
          >
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)]/55 p-3">
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Profile</h3>
                <div className="mt-3 grid gap-2">
                  <ToggleRow label="Public profile" checked={profilePrivacy.isPublic} onChange={(value) => setProfilePrivacy((current) => ({ ...current, isPublic: value }))} />
                  <ToggleRow label="Show in discovery" checked={profilePrivacy.showInDiscovery} onChange={(value) => setProfilePrivacy((current) => ({ ...current, showInDiscovery: value }))} />
                  <ToggleRow label="Hide activity status" checked={profilePrivacy.hideActivityStatus} onChange={(value) => setProfilePrivacy((current) => ({ ...current, hideActivityStatus: value }))} />
                  <ToggleRow label="Read receipts" checked={profilePrivacy.readReceipts} onChange={(value) => setProfilePrivacy((current) => ({ ...current, readReceipts: value }))} />
                </div>
                <Button type="button" variant="secondary" className="mt-3 w-full" onClick={saveProfilePrivacy} disabled={isBusy}>
                  {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  Save profile privacy
                </Button>
              </div>

              <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)]/55 p-3">
                <h3 className="text-sm font-bold text-[var(--text-primary)]">The Mesh</h3>
                <label className="mt-3 grid gap-2 text-sm font-bold text-[var(--text-primary)]">
                  Overall visibility
                  <select
                    value={meshPrivacy.meshVisibility}
                    onChange={(event) => setMeshPrivacy((current) => ({ ...current, meshVisibility: event.target.value }))}
                    className="simple-input h-11 px-3 text-sm capitalize"
                  >
                    {meshVisibilityOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </label>
                <div className="mt-3 grid gap-2">
                  <ToggleRow label="Show connections" checked={meshPrivacy.showConnections} onChange={(value) => setMeshPrivacy((current) => ({ ...current, showConnections: value }))} />
                  <ToggleRow label="Show stats" checked={meshPrivacy.showStats} onChange={(value) => setMeshPrivacy((current) => ({ ...current, showStats: value }))} />
                </div>
                <Button type="button" variant="secondary" className="mt-3 w-full" onClick={saveMeshPrivacy} disabled={isBusy}>
                  {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  Save Mesh visibility
                </Button>
              </div>
            </div>
          </Panel>

          <Panel
            icon={Server}
            title="Connected data and sync"
            description="Pause account sync, trigger a fresh sync, review permissions, or delete imported Mesh.me copies without touching the source platform."
          >
            <div className="mt-4 grid gap-3">
              {accounts.length === 0 ? (
                <EmptyState
                  compact
                  icon={Server}
                  title="No connected accounts yet"
                  description="Connect a platform to start importing posts, messages, analytics, and source-labeled activity."
                >
                  <LinkButton href="/connected-accounts" variant="secondary">Connect an account</LinkButton>
                </EmptyState>
              ) : (
                accounts.map((account) => (
                  <AccountCard
                    key={account.id}
                    account={account}
                    pendingKey={pendingKey}
                    onToggleSync={() => toggleSync(account)}
                    onSyncNow={() => syncNow(account)}
                    onDeleteImportedData={() => setConfirmingImportDelete({ account })}
                  />
                ))
              )}
            </div>
          </Panel>

          <Panel
            icon={EyeOff}
            title="Hide or restore imported content"
            description="Imported items can be hidden from Mesh.me while staying untouched on the original platform."
          >
            <div className="mt-4 grid gap-3">
              {recentContent.length === 0 ? (
                <EmptyState
                  compact
                  icon={Search}
                  title="No imported content to review"
                  description="When connected accounts sync posts, they will appear here for quick visibility control."
                />
              ) : (
                recentContent.map((post) => (
                  <ImportedContentRow
                    key={post.id}
                    post={post}
                    pending={pendingKey === `post-visibility-${post.id}`}
                    onVisibilityChange={(visibility) => updatePostVisibility(post, visibility)}
                  />
                ))
              )}
            </div>
          </Panel>

          <Panel
            icon={SlidersHorizontal}
            title="Data visibility rules"
            description="Set simple defaults for discovery, analytics, and Meshi access. Hidden means Mesh.me will not use that category for display or assistant context."
          >
            <div className="mt-4 grid gap-3">
              {defaultPolicyRows.map((row) => {
                const current = policyByType.get(row.entityType);
                return (
                  <PolicyRow
                    key={row.entityType}
                    label={row.label}
                    description={row.description}
                    value={current?.visibility ?? row.defaultVisibility}
                    pending={pendingKey === `policy-${row.entityType}`}
                    onChange={(visibility) => updatePolicy(row, visibility)}
                  />
                );
              })}
            </div>
          </Panel>
        </div>

        <aside className="grid h-fit gap-4">
          <Panel icon={FileDown} title="Export" description="Download a complete account archive or a smaller account snapshot.">
            <div className="mt-4 grid gap-2">
              <LinkButton href="/api/data-controls?action=export" variant="secondary" className="w-full justify-start" download>
                <Download className="h-4 w-4" aria-hidden="true" />
                Full data export
              </LinkButton>
              <LinkButton href="/api/account/export" variant="ghost" className="w-full justify-start" download>
                <FileDown className="h-4 w-4" aria-hidden="true" />
                Account snapshot
              </LinkButton>
            </div>
          </Panel>

          <Panel icon={Trash2} title="Imported data" description="Remove synced platform copies stored by Mesh.me. Source platforms are not changed.">
            <div className="mt-4 grid gap-2">
              <Button type="button" variant="danger" className="w-full justify-start" onClick={() => setConfirmingImportDelete({ account: null })} disabled={isBusy || accounts.length === 0}>
                {pendingKey === "delete-import-all" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
                Delete all imported data
              </Button>
              <p className="text-xs leading-5 text-[var(--text-muted)]">
                This keeps your Mesh.me account and connections, but removes imported posts, comments, media, followers, analytics, and sync jobs.
              </p>
            </div>
          </Panel>

          <Panel icon={KeyRound} title="Account access" description="Sign out is always visible. Permanent deletion requires your current password.">
            <div className="mt-4 grid gap-2">
              <LinkButton href="/settings" variant="secondary" className="w-full justify-start">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Settings and sign out
              </LinkButton>
              <LinkButton href="/account/delete" variant="danger" className="w-full justify-start">
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Permanently delete account
              </LinkButton>
            </div>
          </Panel>

          <Panel icon={BarChart3} title="Stored data" description="A transparent count of what Mesh.me currently stores for this account.">
            <div className="mt-4 grid gap-2">
              {Object.entries(data.storedData.native).map(([label, value]) => (
                <MiniStat key={label} label={label} value={value} />
              ))}
              {Object.entries(data.storedData.imported).map(([label, value]) => (
                <MiniStat key={label} label={label} value={value} tone="imported" />
              ))}
            </div>
          </Panel>
        </aside>
      </section>
      <ConfirmDialog
        open={confirmingImportDelete !== null}
        onClose={() => setConfirmingImportDelete(null)}
        onConfirm={() => deleteImportedData(confirmingImportDelete?.account ?? undefined)}
        title="Delete imported copies?"
        description={`Imported Mesh.me copies from ${
          confirmingImportDelete?.account ? accountLabel(confirmingImportDelete.account) : "all connected platforms"
        } will be removed. Nothing is deleted from the original platform.`}
        confirmLabel="Delete imported data"
        destructive
      />
    </main>
  );
}

function LinkButton({
  href,
  variant,
  className,
  download = false,
  children,
}: {
  href: string;
  variant: "default" | "secondary" | "ghost" | "danger";
  className?: string;
  download?: boolean;
  children: ReactNode;
}) {
  const classes = cn(buttonVariants({ variant, className }));
  if (download || href.startsWith("/api/")) {
    return (
      <a href={href} download={download || undefined} className={classes}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  );
}

function MetricCard({ icon: Icon, label, value, detail }: { icon: typeof Server; label: string; value: string; detail: string }) {
  return (
    <div className="mesh-surface rounded-lg p-4">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
        <Icon className="h-4 w-4 text-[var(--accent)]" aria-hidden="true" />
        {label}
      </div>
      <p className="mt-3 text-3xl font-bold text-[var(--text-primary)]">{value}</p>
      <p className="mt-1 text-xs font-semibold text-[var(--text-muted)]">{detail}</p>
    </div>
  );
}

function Panel({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof ShieldCheck;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="mesh-surface rounded-lg p-4 md:p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)]/62 text-[var(--accent)]">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "mesh-choice flex items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left",
        checked && "border-[var(--accent-muted)] bg-[var(--accent-subtle)]",
      )}
      aria-pressed={checked}
    >
      <span className="text-sm font-bold text-[var(--text-primary)]">{label}</span>
      <span className="inline-flex items-center gap-1 text-xs font-bold text-[var(--text-muted)]">
        {checked ? <Eye className="h-3.5 w-3.5" aria-hidden="true" /> : <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />}
        {checked ? "On" : "Off"}
      </span>
    </button>
  );
}

function AccountCard({
  account,
  pendingKey,
  onToggleSync,
  onSyncNow,
  onDeleteImportedData,
}: {
  account: Account;
  pendingKey: string | null;
  onToggleSync: () => void;
  onSyncNow: () => void;
  onDeleteImportedData: () => void;
}) {
  const label = accountLabel(account);
  const accountPending = pendingKey?.endsWith(account.id);
  const permissionPreview = account.permissions.slice(0, 6);

  return (
    <article className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)]/55 p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-bold text-[var(--text-primary)]">{account.platformName}</h3>
            <Badge variant={account.isActive ? "success" : "warning"}>{account.healthLabel}</Badge>
            <Badge variant="outline">{account.authType}</Badge>
          </div>
          <p className="mt-1 text-sm font-semibold text-[var(--text-secondary)]">{label}</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Last sync: {formatDate(account.lastSyncAt)} {account.syncError ? `- ${account.syncError}` : ""}
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[24rem]">
          <Button type="button" variant={account.isActive ? "secondary" : "default"} onClick={onToggleSync} disabled={Boolean(accountPending)}>
            {pendingKey === `sync-${account.id}` ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : account.isActive ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
            {account.isActive ? "Pause" : "Resume"}
          </Button>
          <Button type="button" variant="ghost" onClick={onSyncNow} disabled={!account.isActive || Boolean(accountPending)}>
            {pendingKey === `sync-now-${account.id}` ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
            Sync
          </Button>
          <Button type="button" variant="danger" onClick={onDeleteImportedData} disabled={Boolean(accountPending)}>
            {pendingKey === `delete-import-${account.id}` ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
            Delete copies
          </Button>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        <MiniStat label="posts" value={account.counts.posts} />
        <MiniStat label="comments" value={account.counts.comments} />
        <MiniStat label="followers" value={account.counts.followers} />
        <MiniStat label="media" value={account.counts.media} />
      </div>

      <div className="mt-3 rounded-md border border-[var(--border-primary)] bg-[var(--bg-secondary)]/60 p-3">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Permissions</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {permissionPreview.length > 0 ? permissionPreview.map((permission) => (
            <Badge
              key={`${account.id}-${permission.key}`}
              variant={permission.state === "granted" ? "accent" : permission.state === "revoked" ? "danger" : "warning"}
            >
              {permission.label}
            </Badge>
          )) : <span className="text-sm text-[var(--text-muted)]">No platform permissions recorded yet.</span>}
        </div>
      </div>
    </article>
  );
}

function ImportedContentRow({
  post,
  pending,
  onVisibilityChange,
}: {
  post: ImportedPost;
  pending: boolean;
  onVisibilityChange: (visibility: string) => void;
}) {
  return (
    <article className="grid gap-3 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)]/55 p-3 md:grid-cols-[minmax(0,1fr)_12rem] md:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{post.account.platform}</Badge>
          <Badge variant={post.visibility === "hidden" ? "danger" : "secondary"}>{post.visibility}</Badge>
          {post.isNsfw && <Badge variant="danger">Sensitive</Badge>}
        </div>
        <h3 className="mt-2 truncate text-base font-bold text-[var(--text-primary)]">
          {post.title || post.content || "Untitled imported post"}
        </h3>
        <p className="mt-1 line-clamp-2 text-sm leading-6 text-[var(--text-secondary)]">
          {post.content || post.url || "No caption was imported for this item."}
        </p>
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          {post.postType} from {post.account.platformUsername || post.account.accountLabel || post.account.platform} - updated {formatDate(post.updatedAt)}
        </p>
      </div>
      <label className="grid gap-2 text-sm font-bold text-[var(--text-primary)]">
        Visibility
        <span className="relative">
          <select
            value={post.visibility}
            onChange={(event) => onVisibilityChange(event.target.value)}
            disabled={pending}
            className="simple-input h-11 w-full px-3 text-sm capitalize"
          >
            {visibilityOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          {pending && <Loader2 className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 animate-spin text-[var(--text-muted)]" aria-hidden="true" />}
        </span>
      </label>
    </article>
  );
}

function PolicyRow({
  label,
  description,
  value,
  pending,
  onChange,
}: {
  label: string;
  description: string;
  value: string;
  pending: boolean;
  onChange: (visibility: string) => void;
}) {
  return (
    <article className="grid gap-3 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)]/55 p-3 md:grid-cols-[minmax(0,1fr)_12rem] md:items-center">
      <div>
        <h3 className="text-sm font-bold text-[var(--text-primary)]">{label}</h3>
        <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
      </div>
      <label className="grid gap-2 text-sm font-bold text-[var(--text-primary)]">
        Default
        <span className="relative">
          <select
            value={value}
            onChange={(event) => onChange(event.target.value)}
            disabled={pending}
            className="simple-input h-11 w-full px-3 text-sm capitalize"
          >
            {visibilityOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          {pending && <Loader2 className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 animate-spin text-[var(--text-muted)]" aria-hidden="true" />}
        </span>
      </label>
    </article>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone?: "imported" }) {
  return (
    <div className="rounded-md border border-[var(--border-primary)] bg-[var(--bg-secondary)]/60 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
        {label.replace(/([A-Z])/g, " $1").trim()}
      </p>
      <p className={cn("mt-1 text-sm font-bold text-[var(--text-primary)]", tone === "imported" && "text-[var(--accent)]")}>
        {formatCount(value)}
      </p>
    </div>
  );
}
