"use client";

import { useMemo, useState } from "react";
import { Eye, KeyRound, ShieldCheck } from "lucide-react";
import { PaperWait } from "@/components/loading/paper-wait";
import { getDisplayNameForAnyPlatform } from "@/lib/platform-capabilities";

type ConnectedAnalyticsAccount = {
  id: string;
  platform: string;
  platformUsername: string | null;
  isActive: boolean;
  scopes: string | null;
  _count: {
    platformPosts: number;
    platformComments: number;
    platformFollowers: number;
    platformMedia: number;
  };
};

type PermissionKey = "analytics.read" | "content.read" | "audience.read" | "media.read";

const PERMISSIONS: { key: PermissionKey; label: string; description: string }[] = [
  { key: "analytics.read", label: "Analytics", description: "Reads views, reach, and engagement trends." },
  { key: "content.read", label: "Content", description: "Reads imported posts and comments." },
  { key: "audience.read", label: "Audience", description: "Reads follower and community growth signals." },
  { key: "media.read", label: "Media", description: "Reads imported media metadata and previews." },
];

export function PrivacyPermissionsManager({ accounts }: { accounts: ConnectedAnalyticsAccount[] }) {
  const [items, setItems] = useState(accounts);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const totals = useMemo(() => {
    return items.reduce(
      (acc, account) => {
        acc.apps += 1;
        acc.posts += account._count.platformPosts;
        acc.comments += account._count.platformComments;
        acc.followers += account._count.platformFollowers;
        acc.media += account._count.platformMedia;
        return acc;
      },
      { apps: 0, posts: 0, comments: 0, followers: 0, media: 0 },
    );
  }, [items]);

  function parseScopes(scopes: string | null) {
    return new Set((scopes || "").split(/[\s,]+/).map((value) => value.trim()).filter(Boolean));
  }

  async function updateAccount(accountId: string, payload: Record<string, unknown>, saveLabel: string) {
    setSavingKey(saveLabel);
    setStatus(null);
    try {
      const res = await fetch(`/api/connected-accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({ error: "Failed to update permissions" }));
      if (!res.ok) throw new Error(data.error || "Failed to update permissions");
      setItems((prev) => prev.map((item) => (item.id === accountId ? { ...item, ...data.account } : item)));
      setStatus("Privacy permissions saved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to update permissions");
    } finally {
      setSavingKey(null);
    }
  }

  async function togglePermission(account: ConnectedAnalyticsAccount, key: PermissionKey) {
    const current = parseScopes(account.scopes);
    if (current.has(key)) current.delete(key);
    else current.add(key);
    await updateAccount(account.id, { scopes: Array.from(current).join(",") }, `${account.id}:${key}`);
  }

  async function toggleAccountAccess(account: ConnectedAnalyticsAccount) {
    await updateAccount(account.id, { isActive: !account.isActive }, `${account.id}:isActive`);
  }

  return (
    <div className="grid gap-6">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Connected apps" value={totals.apps} />
        <Stat label="Imported posts" value={totals.posts} />
        <Stat label="Imported comments" value={totals.comments} />
        <Stat label="Imported media" value={totals.media} />
      </section>

      <section className="mesh-section rounded-3xl p-5">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-[var(--accent-text)]" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Privacy tab: app access + data inventory</h2>
        </div>
        <p className="text-xs leading-5 text-[var(--text-secondary)]">
          Review exactly which apps are connected, what data Mesh.me is currently reading, and adjust permissions with one tap.
        </p>
      </section>

      {status && <p className="text-xs text-[var(--text-secondary)]">{status}</p>}

      <section className="grid gap-3">
        {items.length === 0 ? (
          <p className="mesh-panel rounded-2xl p-4 text-sm text-[var(--text-secondary)]">No connected apps yet. Connect accounts to manage privacy permissions here.</p>
        ) : (
          items.map((account) => {
            const scopes = parseScopes(account.scopes);
            return (
              <div key={account.id} className="mesh-panel rounded-2xl p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{getDisplayNameForAnyPlatform(account.platform)}</p>
                    <p className="text-xs text-[var(--text-muted)]">{account.platformUsername || "No username"}</p>
                  </div>
                  {/* Both of this panel's controls are toggles that only ever
                      said which way they were set in prose inside themselves.
                      These decide what Mesh.me may read from a connected
                      account, so the state belongs on the control. */}
                  <button
                    type="button"
                    aria-pressed={account.isActive}
                    onClick={() => toggleAccountAccess(account)}
                    disabled={savingKey === `${account.id}:isActive`}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${account.isActive ? "bg-emerald-500/15 text-[var(--success)]" : "bg-[var(--bg-tertiary)] text-[var(--text-muted)]"}`}
                  >
                    {savingKey === `${account.id}:isActive` ? "Saving..." : account.isActive ? "Access enabled" : "Access paused"}
                  </button>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <MiniStat icon={Eye} label="Posts" value={account._count.platformPosts} />
                  <MiniStat icon={KeyRound} label="Comments" value={account._count.platformComments} />
                  <MiniStat icon={Eye} label="Followers" value={account._count.platformFollowers} />
                  <MiniStat icon={KeyRound} label="Media" value={account._count.platformMedia} />
                </div>

                <div className="mt-4 grid gap-2 md:grid-cols-2">
                  {PERMISSIONS.map((permission) => {
                    const active = scopes.has(permission.key);
                    const loading = savingKey === `${account.id}:${permission.key}`;
                    return (
                      <button
                        key={permission.key}
                        type="button"
                        aria-pressed={active}
                        onClick={() => togglePermission(account, permission.key)}
                        disabled={loading}
                        className={`rounded-xl border p-3 text-left transition ${active ? "border-emerald-500/35 bg-emerald-500/10" : "border-[var(--border-primary)] bg-[var(--bg-card)]"}`}
                      >
                        <p className="text-xs font-semibold text-[var(--text-primary)]">{permission.label}</p>
                        <p className="mt-1 text-micro leading-5 text-[var(--text-muted)]">{permission.description}</p>
                        <span className={`mt-2 inline-flex items-center gap-1 text-micro font-semibold ${active ? "text-emerald-400" : "text-[var(--text-muted)]"}`}>
                          {loading && <PaperWait size="sm" />}
                          {active ? "Allowed" : "Not allowed"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="mesh-stat-card">
      <p className="text-2xl font-semibold text-[var(--text-primary)]">{value.toLocaleString()}</p>
      <p className="mt-1 text-xs text-[var(--text-muted)]">{label}</p>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value }: { icon: typeof Eye; label: string; value: number }) {
  return (
    <div className="plate p-3">
      <Icon className="mb-2 h-4 w-4 text-[var(--accent-text)]" />
      <p className="text-lg font-semibold text-[var(--text-primary)]">{value.toLocaleString()}</p>
      <p className="text-micro text-[var(--text-muted)]">{label}</p>
    </div>
  );
}
