"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, CheckCircle2, Combine, Info, RefreshCw, ShieldCheck, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import type {
  ConnectedAccountView,
  ConnectedAccountsDashboard,
  SupportedPlatformView,
} from "@/lib/connected-accounts";
import { PlatformGrid, type PlatformTile, type TileState } from "@/components/accounts/platform-grid";
import { PlatformSheet } from "@/components/accounts/platform-sheet";
import { OneMeshHub, type HubAccount } from "@/components/accounts/one-mesh-hub";
import { foldPersonaIntoMainIdentity } from "@/lib/one-account-actions";
import { AccountMergePanel } from "./account-merge-panel";
import type { SupplyNote } from "./public-supply-status";
import type { AccountMergeCenter } from "@/lib/account-merge";
import { publishMeshiCause } from "@/lib/meshi-bus";

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

// The real brand fills. These eighteen colours are not ours — #1db954 is
// Spotify's green whether it suits the palette or not.
//
// They are a TINT SOURCE, and only that: the halo behind a merged platform's
// tile, and the thread colour in the One Mesh. Nothing sets text on them, which
// is deliberate — the page used to render each platform as a monogram disc in
// its brand colour, and white-on-brand measured 2.59:1 on Spotify, 3.21:1 on
// SoundCloud, 3.44:1 on Reddit. Real drawn marks carry their own contrasting
// ink inside the mark, so the question of what ink survives on the fill does
// not arise.
const platformBrands: Record<string, { bg: string }> = {
  github: { bg: "#24292e" },
  linkedin: { bg: "#0077b5" },
  medium: { bg: "#292929" },
  spotify: { bg: "#1db954" },
  twitter: { bg: "#0f1419" },
  x: { bg: "#0f1419" },
  youtube: { bg: "#ff0000" },
  tiktok: { bg: "#010101" },
  instagram: { bg: "#e4405f" },
  discord: { bg: "#5865f2" },
  twitch: { bg: "#9146ff" },
  facebook: { bg: "#1877f2" },
  snapchat: { bg: "#fffc00" },
  reddit: { bg: "#ff4500" },
  pinterest: { bg: "#e60023" },
  soundcloud: { bg: "#ff5500" },
  bluesky: { bg: "#0085ff" },
  threads: { bg: "#101010" },
};

function tintFor(platform: string): string {
  return platformBrands[platform.toLowerCase()]?.bg ?? "#7c8cf8";
}

/** Which states count as "the platform is in and working". */
const HEALTHY = new Set(["ready", "manual"]);

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

  /* Portalled to <body>: this toast is `position: fixed`, and any transformed
     ancestor (a route slot mid page-enter animation, a future animated
     wrapper) becomes its containing block — measured on the built page as the
     toast positioning against the scrolled document instead of the viewport.
     From <body> there is no ancestor to trap it. */
  if (typeof document === "undefined") return null;
  return createPortal(
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
    </AnimatePresence>,
    document.body,
  );
}

export function ConnectedAccountsClient({
  initialDashboard,
  mergeCenter,
  initialPersonas = [],
  identity,
  supplyNotes = {},
  browsableCount = 0,
  serverKeyMissing = false,
  justConnectedPlatform = null,
  connectError = null,
  preselectPlatforms = [],
}: {
  initialDashboard: ConnectedAccountsDashboard;
  /** Two-party account merge state: my open requests + requests targeting me. */
  mergeCenter: AccountMergeCenter;
  initialPersonas?: PersonaView[];
  identity: { username: string; displayName: string; avatarUrl: string | null };
  /** What each platform supplies without connecting, keyed by platform id. */
  supplyNotes?: Record<string, SupplyNote>;
  /** How many platforms feed the Flow with nothing linked at all. */
  browsableCount?: number;
  /** No APP_DATA_ENCRYPTION_KEY on this deployment: nothing can store a token,
   *  so every platform is unconnectable until an admin sets it. */
  serverKeyMissing?: boolean;
  /** Platform id just connected via OAuth this visit (from ?connected=). */
  justConnectedPlatform?: string | null;
  /** OAuth failure message this visit (from ?error=). */
  connectError?: string | null;
  /** Platform ids the user picked during onboarding (from ?preselect=),
   *  already validated server-side and minus anything since connected. */
  preselectPlatforms?: string[];
}) {
  const [dashboard, setDashboard] = useState(initialDashboard);
  const [personas, setPersonas] = useState(initialPersonas);
  // The just-connected account stays lit for a beat after you return from
  // OAuth, then settles in with the rest.
  const [justConnected, setJustConnected] = useState<string | null>(justConnectedPlatform);
  // Returning from a completed OAuth flow IS the server confirmation — the
  // account row exists or we wouldn't be lit. One brief celebration, in step
  // with the tile burst the grid already fires for the same fact.
  useEffect(() => {
    if (justConnectedPlatform) publishMeshiCause({ kind: "account:connected" });
    // The prop is set once by the server on the OAuth return render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [openPlatformId, setOpenPlatformId] = useState<string | null>(null);
  const [actionState, setActionState] = useState<ActionState>(null);
  const dismissToast = useCallback(() => setActionState(null), []);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<ConnectedAccountView | null>(null);
  const refreshAttemptedRef = useRef(false);

  // Each connected account, resolved to its brand tint, for the One Mesh hub.
  const hubAccounts = useMemo<HubAccount[]>(
    () =>
      dashboard.accounts.map((account) => ({
        id: account.id,
        platform: account.platform,
        name: account.platformName,
        tint: tintFor(account.platform),
        synced: account.isActive && account.hasCredential && account.health === "ready",
      })),
    [dashboard.accounts],
  );

  // Connections grouped by platform — the grid is one tile per PLATFORM, and a
  // platform can carry more than one account.
  const accountsByPlatform = useMemo(() => {
    const map = new Map<string, ConnectedAccountView[]>();
    for (const account of dashboard.accounts) {
      const key = account.platform.toLowerCase();
      const list = map.get(key);
      if (list) list.push(account);
      else map.set(key, [account]);
    }
    return map;
  }, [dashboard.accounts]);

  const tiles = useMemo<PlatformTile[]>(() => {
    const rank: Record<TileState, number> = { merged: 0, attention: 1, open: 2, locked: 3 };
    const preselectRank = new Map(preselectPlatforms.map((id, index) => [id, index] as const));

    const built = dashboard.supportedPlatforms.map((platform) => {
      const accounts = accountsByPlatform.get(platform.id) ?? [];
      // The server key gates EVERY platform. A tile that still offers a tap
      // sends someone to a real consent screen to grant real access that this
      // deployment then cannot keep.
      const canConnect =
        !serverKeyMissing
        && (platform.authType !== "oauth" || (platform.configured && Boolean(platform.connectHref)));
      const note = supplyNotes[platform.id] ?? null;

      let state: TileState;
      let caption: string;

      if (accounts.length > 0 && accounts.every((account) => !HEALTHY.has(account.health))) {
        // Every connection on this platform is in a state the user has to do
        // something about. Worth its own colour: a tile that reads "merged"
        // while nothing has synced for a month is the page lying quietly.
        state = "attention";
        caption = accounts[0].healthLabel;
      } else if (accounts.length > 0) {
        state = "merged";
        const healthy = accounts.filter((account) => HEALTHY.has(account.health));
        caption =
          accounts.length > 1
            ? `${accounts.length} accounts`
            : healthy[0]?.platformUsername
              ? `@${healthy[0].platformUsername}`
              : "Merged";
      } else if (!canConnect) {
        state = "locked";
        caption = serverKeyMissing ? "Server not ready" : "Needs setup";
      } else {
        state = "open";
        // The registry's own researched label. "Browse freely" under an
        // unmerged logo is the most useful thing this page can say about that
        // platform: you do not have to connect it to see it.
        caption = note?.label ?? "Tap to connect";
      }

      return {
        tile: {
          id: platform.id,
          name: platform.name,
          tint: tintFor(platform.id),
          state,
          caption,
          connectHref: state === "open" ? platform.connectHref : null,
        } satisfies PlatformTile,
        // Onboarding picks sort ahead of the other unconnected platforms: the
        // ones the user just said they use should not be hunted for.
        preselect: preselectRank.get(platform.id) ?? Number.MAX_SAFE_INTEGER,
        name: platform.name,
      };
    });

    built.sort((a, b) => {
      const byState = rank[a.tile.state] - rank[b.tile.state];
      if (byState !== 0) return byState;
      if (a.preselect !== b.preselect) return a.preselect - b.preselect;
      return a.name.localeCompare(b.name);
    });

    return built.map((entry) => entry.tile);
  }, [accountsByPlatform, dashboard.supportedPlatforms, preselectPlatforms, supplyNotes, serverKeyMissing]);

  const openPlatform = useMemo<SupportedPlatformView | null>(
    () => dashboard.supportedPlatforms.find((platform) => platform.id === openPlatformId) ?? null,
    [dashboard.supportedPlatforms, openPlatformId],
  );

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

  // Returning from an OAuth connect: the callback redirects here with
  // ?connected=<platform> on success or ?error=…&platform on failure. Surface
  // it, then scrub the query so a refresh doesn't replay it.
  useEffect(() => {
    if (justConnectedPlatform) {
      const name =
        initialDashboard.supportedPlatforms.find((platform) => platform.id === justConnectedPlatform)?.name ??
        justConnectedPlatform.charAt(0).toUpperCase() + justConnectedPlatform.slice(1);
      setActionState({ type: "success", message: `${name} merged into your one account.` });
    } else if (connectError) {
      setActionState({ type: "error", message: connectError });
    }
    // preselect is scrubbed too — the picks live in React state now, and a
    // refresh shouldn't replay a stale onboarding hand-off.
    if (justConnectedPlatform || connectError || preselectPlatforms.length > 0) {
      try {
        window.history.replaceState(null, "", window.location.pathname);
      } catch {
        // best-effort URL scrub
      }
    }
    // Runs once on the return visit only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Let the new platform settle after its arrival flourish.
  useEffect(() => {
    if (!justConnected) return;
    const timer = setTimeout(() => setJustConnected(null), 6000);
    return () => clearTimeout(timer);
  }, [justConnected]);

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

  const mergedCount = tiles.filter((tile) => tile.state === "merged").length;

  return (
    /* `grid-cols-[minmax(0,1fr)]`, not a bare `grid`. A single IMPLICIT column
       is sized `auto`, which never shrinks below the min-content width of its
       widest child — so the one-line header (min-content = the whole sentence
       plus the button, 393px) widened the column past the 338px content box on
       a 375px phone, and the page shell's own clipping hid it: the document
       reported scrollWidth 370 of 375, no overflow, while Refresh was cut off
       the screen. `minmax(0, 1fr)` caps the column at the container. */
    <main
      data-testid="connected-accounts-center"
      className="ds-page-shell grid grid-cols-[minmax(0,1fr)] gap-6"
    >
      {/* One line, and it stays one line. This wrapped on a phone — a promise
          and a button stacked into two rows of chrome above a page whose whole
          point is the grid underneath. */}
      <header className="flex items-center justify-between gap-3">
        <p className="inline-flex min-w-0 items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)]">
          <ShieldCheck className="size-4 shrink-0 text-[var(--accent-text)]" aria-hidden="true" />
          {/* `min-w-0` on BOTH the row and the text. The text is a flex item of
              an inline-flex parent, so its automatic minimum size is its
              min-content width — and `truncate` sets `white-space: nowrap`,
              which makes that the whole sentence. Without this the row cannot
              shrink and the Refresh button is clipped off a 375px screen while
              the document reports no overflow at all, because the shell clips
              it. Measured: header 393px inside a 338px content box. */}
          <span className="min-w-0 truncate">Official APIs only · disconnect anytime</span>
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="shrink-0"
          loading={busyKey === "refresh"}
          onClick={refreshDashboard}
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          Refresh
        </Button>
      </header>

      {/* SAID ONCE, AND FIRST. This is one deployment setting, not twelve
          per-platform ones, and it is the reason every tile below is inert —
          so it goes above the mesh rather than under it, and is not repeated
          inside twelve sheets. */}
      {serverKeyMissing && (
        <section className="flex items-start gap-2.5 rounded-[var(--ds-radius-md)] border border-[var(--ds-danger-border)] bg-[var(--ds-danger-bg)] px-3.5 py-3">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-[var(--ds-danger)]" aria-hidden="true" />
          <div className="min-w-0 text-sm leading-6 text-[var(--ds-danger)]">
            <p className="font-semibold">Connecting is switched off on this deployment</p>
            <p>
              There is no encryption key, so nothing here can be stored securely — and sending you to
              sign in and grant access we cannot keep would be worse than saying so. An admin needs to
              set{" "}
              <code className="rounded bg-[var(--ds-surface)] px-1 py-0.5 font-mono text-[0.6875rem]">
                APP_DATA_ENCRYPTION_KEY
              </code>{" "}
              to a 32-byte key and redeploy.
            </p>
          </div>
        </section>
      )}

      {/* The One Mesh — your mesh.me identity at the center, every merged
          platform threading home to it. */}
      <section className="grid gap-3 rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface)] p-4 sm:p-5">
        <OneMeshHub identity={identity} accounts={hubAccounts} justConnectedPlatform={justConnected} />
        {/* The handle lives HERE, not under the avatar inside the ring. Text
            stacked below the centre point grows down into the band the lower
            arc occupies, so at a full ring it collided with three nodes. */}
        <p className="mx-auto max-w-sm text-center text-sm leading-6 text-[var(--text-secondary)]">
          {hubAccounts.length > 0 ? (
            <>
              Every platform you merge threads back to one identity —{" "}
              <span className="font-semibold text-[var(--text-primary)]">@{identity.username}</span>.
            </>
          ) : (
            <>
              <span className="font-semibold text-[var(--text-primary)]">@{identity.username}</span> is your one
              mesh.me account. Tap a logo below and watch it thread in.
            </>
          )}
        </p>
      </section>

      <section className="grid gap-3">
        <div>
          <h2 className="text-xl font-semibold">
            {mergedCount > 0 ? `${mergedCount} merged` : "Merge your platforms"}
          </h2>
          {/* The one fact worth knowing BEFORE you have picked a platform: some
              of these need no connection at all. The per-platform reason rides
              on the tile and opens with it. */}
          {browsableCount > 0 && (
            <p className="text-sm text-[var(--text-secondary)]">
              {browsableCount} feed your Flow with nothing connected — linking is for interacting.
            </p>
          )}
        </div>

        <PlatformGrid tiles={tiles} justConnected={justConnected} onOpen={setOpenPlatformId} />
      </section>

      {personas.length > 0 && (
        <section className="grid gap-3 rounded-[var(--ds-radius-lg)] border border-[var(--accent)]/30 bg-[var(--accent-subtle)] p-5">
          <div>
            <h2 className="text-lg font-semibold">Bring your other identities home</h2>
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
                <Avatar src={persona.avatarUrl} alt={persona.displayName || persona.username} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--text-primary)]">@{persona.username}</p>
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

      <AccountMergePanel center={mergeCenter} identity={{ username: identity.username }} />

      <PlatformSheet
        platform={openPlatform}
        accounts={openPlatformId ? accountsByPlatform.get(openPlatformId) ?? [] : []}
        supplyNote={openPlatformId ? supplyNotes[openPlatformId] ?? null : null}
        serverKeyMissing={serverKeyMissing}
        busyKey={busyKey}
        onClose={() => setOpenPlatformId(null)}
        onSync={syncAccount}
        onToggleActive={toggleActive}
        onDisconnect={setDisconnecting}
      />

      <ConfirmDialog
        open={disconnecting !== null}
        onClose={() => setDisconnecting(null)}
        onConfirm={() => {
          if (disconnecting) void disconnectAccount(disconnecting);
        }}
        title={`Disconnect ${disconnecting?.platformName ?? "account"}?`}
        description="Mesh.me will remove the saved connection and local permission records. Nothing changes on the platform itself."
        confirmLabel="Disconnect"
        destructive
      />

      <Toast state={actionState} onDismiss={dismissToast} />
    </main>
  );
}
