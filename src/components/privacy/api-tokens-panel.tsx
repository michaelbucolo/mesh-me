"use client";

// THE TOKEN DESK — beside the export controls, because this API is the
// export surface made programmatic. House law, load-bearing:
//
//   The full token renders exactly once, from component state, at mint —
//   never localStorage, never sessionStorage, never a URL. After this
//   panel unmounts, nobody (including mesh.me) can read it back; the row
//   keeps a fingerprint, not the secret.
//
//   The journal scope has its own checkbox and is never part of a
//   select-all gesture — memory is opted into by name or not at all.
//
//   Revoke is deletion: instant, uncached, next-request-effective.

import { useState, useTransition } from "react";
import { KeyRound } from "lucide-react";

export type TokenRow = {
  id: string;
  name: string;
  selector: string;
  scopes: string;
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
  // Computed where the list is produced (server page or fetch helper), so
  // the component itself never consults a clock.
  expired: boolean;
};

const SCOPE_CHOICES: Array<{ scope: string; label: string; selectAll: boolean }> = [
  { scope: "profile:read", label: "Profile (includes your email)", selectAll: true },
  { scope: "posts:read", label: "Posts, comments, reactions, saves", selectAll: true },
  { scope: "imported:read", label: "Imported platform history", selectAll: true },
  { scope: "analytics:read", label: "Analytics snapshots", selectAll: true },
  // Deliberately excluded from select-all: memory is opted into by name.
  { scope: "journal:read", label: "Meshi's journal", selectAll: false },
];

const EXPIRY_CHOICES = [
  { days: 7, label: "A week" },
  { days: 30, label: "A month" },
  { days: 90, label: "Three months" },
  { days: 365, label: "A year" },
];

function spoken(date: string | null) {
  if (!date) return "never";
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

async function fetchTokens(): Promise<TokenRow[] | null> {
  try {
    const res = await fetch("/api/settings/api-tokens");
    if (!res.ok) return null;
    const data = (await res.json().catch(() => null)) as { tokens?: Array<Omit<TokenRow, "expired">> } | null;
    if (!data?.tokens) return null;
    const now = Date.now();
    return data.tokens.map((t) => ({ ...t, expired: new Date(t.expiresAt).getTime() <= now }));
  } catch {
    // The panel is ambient; a failed load just tries again next refresh.
    return null;
  }
}

export function ApiTokensPanel({ initialTokens }: { initialTokens: TokenRow[] }) {
  // The server page provides the first list, so there is no mount effect;
  // refresh() only ever runs from event handlers after an action.
  const [tokens, setTokens] = useState<TokenRow[]>(initialTokens);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>([]);
  const [expiryDays, setExpiryDays] = useState(90);
  const [minted, setMinted] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);

  async function refresh() {
    const rows = await fetchTokens();
    if (rows) setTokens(rows);
  }

  function post(body: Record<string, unknown>, after?: (json: Record<string, unknown>) => void) {
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch("/api/settings/api-tokens", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (!res.ok) {
          setError(typeof json.error === "string" ? json.error : "Something went wrong.");
          return;
        }
        after?.(json);
        void refresh();
      } catch {
        setError("Something went wrong.");
      }
    });
  }

  return (
    <section className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-elevated)] p-5">
      <div className="flex items-center gap-2">
        <KeyRound size={16} aria-hidden="true" className="text-[var(--text-muted)]" />
        <h2 className="text-base font-semibold text-[var(--text-primary)]">API tokens</h2>
      </div>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        Read your own data from scripts and servers — the same data for everyone, no paywall. Tokens are
        read-only, scoped, and they all expire. We keep a fingerprint, not the token: nobody at mesh.me can
        read one back.{" "}
        <a href="/developers" className="font-semibold text-[var(--accent-text)] underline underline-offset-4">
          Read the docs
        </a>
      </p>

      {minted && (
        <div className="mt-3 rounded-xl border border-[var(--accent-primary,#3b82f6)] bg-[var(--bg-tertiary)] p-3">
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            Copy it now — this is the only time it exists.
          </p>
          <code className="mt-1.5 block overflow-x-auto rounded-md bg-[var(--bg-primary)] px-2.5 py-2 text-xs text-[var(--text-primary)]">
            {minted}
          </code>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(minted);
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
              className="rounded-md bg-[var(--bg-hover)] px-2.5 py-1 text-micro font-semibold text-[var(--text-primary)]"
            >
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMinted(null);
                setCopied(false);
              }}
              className="rounded-md px-2.5 py-1 text-micro text-[var(--text-muted)]"
            >
              I saved it
            </button>
          </div>
        </div>
      )}

      {tokens && tokens.length > 0 && (
        <ul className="mt-3 space-y-2">
          {tokens.map((token) => {
            const expired = token.expired;
            return (
              <li key={token.id} className="rounded-lg bg-[var(--bg-tertiary)] px-3 py-2">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-sm font-semibold text-[var(--text-primary)]">{token.name}</span>
                  <code className="text-micro text-[var(--text-muted)]">mesh_pat_{token.selector}…</code>
                  <span className="text-micro text-[var(--text-muted)]">
                    {expired ? `expired ${spoken(token.expiresAt)}` : `expires ${spoken(token.expiresAt)}`} · last used {spoken(token.lastUsedAt)}
                  </span>
                  <span className="ml-auto">
                    {confirmRevokeId === token.id ? (
                      <span className="flex items-center gap-2 text-micro">
                        <span className="text-[var(--text-muted)]">
                          Anything using it stops on its next request. New tokens are free.
                        </span>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => post({ action: "revoke", tokenId: token.id }, () => setConfirmRevokeId(null))}
                          className="font-semibold text-[var(--danger,#dc2626)]"
                        >
                          Revoke
                        </button>
                        <button type="button" onClick={() => setConfirmRevokeId(null)} className="text-[var(--text-secondary)]">
                          Keep
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => setConfirmRevokeId(token.id)}
                        className="text-micro text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]"
                      >
                        Revoke
                      </button>
                    )}
                  </span>
                </div>
                <p className="mt-0.5 text-micro text-[var(--text-muted)]">{token.scopes.split(" ").join(" · ")}</p>
              </li>
            );
          })}
        </ul>
      )}

      {creating ? (
        <div className="mt-3 rounded-lg bg-[var(--bg-tertiary)] px-3 py-3">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={64}
            placeholder="Name it after the script that will use it"
            aria-label="Token name"
            className="w-full rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)] px-2.5 py-1.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
          />
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setScopes(SCOPE_CHOICES.filter((c) => c.selectAll).map((c) => c.scope))}
              className="rounded-md bg-[var(--bg-hover)] px-2 py-1 text-micro text-[var(--text-secondary)]"
            >
              Everything but the journal
            </button>
          </div>
          <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
            {SCOPE_CHOICES.map((choice) => (
              <label key={choice.scope} className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  checked={scopes.includes(choice.scope)}
                  onChange={(event) =>
                    setScopes((current) =>
                      event.target.checked ? [...current, choice.scope] : current.filter((s) => s !== choice.scope),
                    )
                  }
                />
                {choice.label}
              </label>
            ))}
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <span className="text-micro text-[var(--text-muted)]">Expires in</span>
            {EXPIRY_CHOICES.map((choice) => (
              <button
                key={choice.days}
                type="button"
                onClick={() => setExpiryDays(choice.days)}
                aria-pressed={expiryDays === choice.days}
                className={`rounded-full px-2.5 py-1 text-micro font-medium ${expiryDays === choice.days ? "bg-[var(--accent-primary,#3b82f6)] text-white" : "bg-[var(--bg-hover)] text-[var(--text-secondary)]"}`}
              >
                {choice.label}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              disabled={isPending || !name.trim() || scopes.length === 0}
              onClick={() =>
                post({ action: "create", name, scopes, expiryDays }, (json) => {
                  if (typeof json.token === "string") setMinted(json.token);
                  setCreating(false);
                  setName("");
                  setScopes([]);
                })
              }
              className="rounded-md bg-[var(--bg-hover)] px-3 py-1.5 text-sm font-semibold text-[var(--text-primary)] disabled:opacity-55"
            >
              Create token
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="rounded-md px-3 py-1.5 text-sm text-[var(--text-muted)]"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setCreating(true);
            setMinted(null);
          }}
          className="mt-3 rounded-md bg-[var(--bg-tertiary)] px-3 py-1.5 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
        >
          New token
        </button>
      )}

      {error && <p className="mt-2 text-micro text-[var(--danger,#dc2626)]">{error}</p>}
    </section>
  );
}
