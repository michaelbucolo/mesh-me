"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Combine,
  Mail,
  PlugZap,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { cn, formatCount } from "@/lib/utils";
import { detachAccountFromPersona, foldPersonaIntoMainIdentity } from "@/lib/one-account-actions";
import type {
  MergePillarKey,
  OneAccountAccountView,
  OneAccountOverview,
} from "@/lib/one-account";

const PILLARS: { key: MergePillarKey; label: string; description: string }[] = [
  { key: "connected", label: "Connected", description: "The link to this platform is live." },
  { key: "identity", label: "Identity", description: "Your handle on this platform is part of your mesh identity." },
  { key: "content", label: "Content", description: "What you made there now lives in your mesh too." },
  { key: "unified", label: "Unified", description: "Attached to your main identity, not a separate persona." },
];

const platformBrands: Record<string, { glyph: string; bg: string; fg?: string }> = {
  github: { glyph: "GH", bg: "#24292e" },
  linkedin: { glyph: "in", bg: "#0077b5" },
  medium: { glyph: "M", bg: "#292929" },
  spotify: { glyph: "♫", bg: "#1db954" },
  twitter: { glyph: "𝕏", bg: "#0f1419" },
  x: { glyph: "𝕏", bg: "#0f1419" },
  youtube: { glyph: "▶", bg: "#ff0000" },
  tiktok: { glyph: "♪", bg: "#010101" },
  instagram: { glyph: "IG", bg: "#e4405f" },
  discord: { glyph: "DC", bg: "#5865f2" },
  twitch: { glyph: "Tw", bg: "#9146ff" },
  facebook: { glyph: "fb", bg: "#1877f2" },
  snapchat: { glyph: "S", bg: "#fffc00", fg: "#0f1419" },
  reddit: { glyph: "r/", bg: "#ff4500" },
  pinterest: { glyph: "P", bg: "#e60023" },
  soundcloud: { glyph: "☁", bg: "#ff5500" },
  bluesky: { glyph: "b", bg: "#0085ff" },
  threads: { glyph: "@", bg: "#101010" },
};

const STALE_SYNC_MS = 24 * 60 * 60 * 1000;

type PlanStepStatus = "pending" | "running" | "done" | "failed";

type PlanStep = {
  id: string;
  kind: "persona" | "resume" | "sync";
  targetId: string;
  label: string;
  status: PlanStepStatus;
  detail?: string;
};

function accountNeedsSync(account: OneAccountAccountView): boolean {
  if (account.authType !== "oauth" || !account.hasCredential) return false;
  if (account.health === "needs_reconnect") return false;
  if (!account.pillars.content || !account.lastSyncAt) return true;
  return Date.now() - new Date(account.lastSyncAt).getTime() > STALE_SYNC_MS;
}

function buildMergePlan(overview: OneAccountOverview): { steps: PlanStep[]; needsYou: string[] } {
  const steps: PlanStep[] = [];
  const needsYou: string[] = [];

  for (const persona of overview.personas) {
    steps.push({
      id: `persona:${persona.id}`,
      kind: "persona",
      targetId: persona.id,
      label: `Fold persona @${persona.username} into your main identity`,
      status: "pending",
    });
  }

  for (const account of overview.accounts) {
    const handle = account.platformUsername ? ` @${account.platformUsername}` : "";
    if (account.health === "needs_reconnect") {
      needsYou.push(`Reconnect ${account.platformName}${handle} — only you can re-approve access.`);
      continue;
    }
    if (!account.isActive) {
      steps.push({
        id: `resume:${account.id}`,
        kind: "resume",
        targetId: account.id,
        label: `Resume the ${account.platformName}${handle} connection`,
        status: "pending",
      });
    }
    if (accountNeedsSync(account)) {
      steps.push({
        id: `sync:${account.id}`,
        kind: "sync",
        targetId: account.id,
        label: `Pull your ${account.platformName}${handle} content into the mesh`,
        status: "pending",
      });
    }
  }

  return { steps, needsYou };
}

async function requestJson(path: string, init?: RequestInit) {
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
  return data;
}

function PlatformBadge({
  platform,
  name,
  merged,
  size = "md",
}: {
  platform: string;
  name: string;
  merged: boolean;
  size?: "md" | "lg";
}) {
  const brand = platformBrands[platform.toLowerCase()];
  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-full font-bold shadow-sm ring-2 ring-offset-2 ring-offset-[var(--ds-bg,transparent)]",
        size === "lg" ? "h-11 w-11 text-xs" : "h-10 w-10 text-xs",
        merged ? "ring-[var(--ds-success-border)]" : "opacity-80 ring-[var(--ds-border)]",
      )}
      style={{
        backgroundColor: brand?.bg ?? "var(--accent-subtle)",
        color: brand ? brand.fg ?? "#ffffff" : "var(--accent)",
      }}
      aria-hidden="true"
    >
      {brand?.glyph ?? (name.trim().charAt(0).toUpperCase() || "M")}
      {merged && (
        <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--ds-success)] text-white">
          <Check className="h-2.5 w-2.5" aria-hidden="true" />
        </span>
      )}
    </span>
  );
}

function ProgressRing({ percent, children }: { percent: number; children: React.ReactNode }) {
  const size = 176;
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="var(--ds-border)" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - percent / 100) }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">{children}</div>
    </div>
  );
}

function IdentityOrbit({ overview }: { overview: OneAccountOverview }) {
  const prefersReducedMotion = useReducedMotion();
  const shown = overview.accounts.slice(0, 8);
  const extra = overview.accounts.length - shown.length;
  const orbitSpin = prefersReducedMotion
    ? undefined
    : { duration: 90, repeat: Infinity, ease: "linear" as const };

  return (
    <div className="relative mx-auto h-[300px] w-[300px]" role="img" aria-label={`${overview.summary.overallPercent}% of your platforms are merged into one account`}>
      <div className="absolute inset-[13px] rounded-full border border-dashed border-[var(--ds-border)]" aria-hidden="true" />
      <motion.div
        className="absolute inset-0"
        animate={orbitSpin ? { rotate: 360 } : undefined}
        transition={orbitSpin}
        aria-hidden="true"
      >
        {shown.map((account, index) => {
          const angle = (index / shown.length) * Math.PI * 2 - Math.PI / 2;
          const left = 50 + 45.7 * Math.cos(angle);
          const top = 50 + 45.7 * Math.sin(angle);
          return (
            <span
              key={account.id}
              className="absolute"
              style={{ left: `${left}%`, top: `${top}%`, transform: "translate(-50%, -50%)" }}
            >
              <motion.span
                className="block"
                animate={orbitSpin ? { rotate: -360 } : undefined}
                transition={orbitSpin}
              >
                <PlatformBadge
                  platform={account.platform}
                  name={account.platformName}
                  merged={account.mergeScore === PILLARS.length}
                  size="lg"
                />
              </motion.span>
            </span>
          );
        })}
      </motion.div>
      <div className="absolute inset-0 flex items-center justify-center">
        <ProgressRing percent={overview.summary.overallPercent}>
          <Avatar src={overview.identity.avatarUrl} alt={overview.identity.displayName} size="xl" />
          <p className="text-sm font-bold text-[var(--text-primary)]">{overview.summary.overallPercent}% merged</p>
        </ProgressRing>
      </div>
      {extra > 0 && (
        <span className="absolute bottom-1 right-1 rounded-full border border-[var(--ds-border)] bg-[var(--ds-surface)] px-2 py-1 text-xs font-bold text-[var(--text-secondary)]">
          +{extra}
        </span>
      )}
    </div>
  );
}

function PillarChips({ account }: { account: OneAccountAccountView }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PILLARS.map((pillar) => {
        const met = account.pillars[pillar.key];
        return (
          <span
            key={pillar.key}
            title={pillar.description}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
              met
                ? "border-[var(--ds-success-border)] bg-[var(--ds-success-bg)] text-[var(--ds-success)]"
                : "border-[var(--ds-border)] bg-transparent text-[var(--text-muted)]",
            )}
          >
            {met ? <Check className="h-3 w-3" aria-hidden="true" /> : <span className="h-1.5 w-1.5 rounded-full border border-current" aria-hidden="true" />}
            {pillar.label}
          </span>
        );
      })}
    </div>
  );
}

function AccountRow({
  account,
  busyKey,
  onSync,
  onResume,
  onFold,
}: {
  account: OneAccountAccountView;
  busyKey: string | null;
  onSync: (account: OneAccountAccountView) => void;
  onResume: (account: OneAccountAccountView) => void;
  onFold: (account: OneAccountAccountView) => void;
}) {
  const fullyMerged = account.mergeScore === PILLARS.length;

  let action: React.ReactNode = null;
  if (account.nextStep?.kind === "reconnect") {
    action = (
      <Link href="/connected-accounts" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
        <PlugZap className="h-3.5 w-3.5" aria-hidden="true" />
        Reconnect
      </Link>
    );
  } else if (account.nextStep?.kind === "resume") {
    action = (
      <Button type="button" variant="secondary" size="sm" loading={busyKey === `resume:${account.id}`} onClick={() => onResume(account)}>
        Resume
      </Button>
    );
  } else if (account.nextStep?.kind === "sync") {
    action = (
      <Button type="button" variant="secondary" size="sm" loading={busyKey === `sync:${account.id}`} onClick={() => onSync(account)}>
        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        Sync now
      </Button>
    );
  } else if (account.nextStep?.kind === "fold") {
    action = (
      <Button type="button" variant="secondary" size="sm" loading={busyKey === `fold:${account.id}`} onClick={() => onFold(account)}>
        <Combine className="h-3.5 w-3.5" aria-hidden="true" />
        Fold in
      </Button>
    );
  } else if (fullyMerged) {
    action = (
      <Badge variant="success">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
        Merged
      </Badge>
    );
  }

  return (
    <div className="grid gap-3 rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface)] p-4">
      <div className="flex items-center gap-3">
        <PlatformBadge platform={account.platform} name={account.platformName} merged={fullyMerged} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-[var(--text-primary)]">{account.platformName}</p>
          <p className="truncate text-xs text-[var(--text-muted)]">
            {account.platformUsername ? `@${account.platformUsername}` : account.accountLabel ?? account.healthLabel}
            {account.persona && ` · persona @${account.persona.username}`}
          </p>
        </div>
        <div className="shrink-0">{action}</div>
      </div>
      <PillarChips account={account} />
      {account.nextStep && (
        <p className="text-xs text-[var(--text-secondary)]">{account.nextStep.label}</p>
      )}
    </div>
  );
}

function MergeEverythingModal({
  open,
  onClose,
  overview,
  onFinished,
}: {
  open: boolean;
  onClose: () => void;
  overview: OneAccountOverview;
  onFinished: (completed: number, failed: number) => void;
}) {
  const plan = useMemo(() => buildMergePlan(overview), [overview]);
  const [steps, setSteps] = useState<PlanStep[] | null>(null);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);

  const visibleSteps = steps ?? plan.steps;

  function updateStep(id: string, patch: Partial<PlanStep>) {
    setSteps((current) => (current ?? plan.steps).map((step) => (step.id === id ? { ...step, ...patch } : step)));
  }

  async function runStep(step: PlanStep) {
    if (step.kind === "persona") {
      const result = await foldPersonaIntoMainIdentity(step.targetId);
      if ("error" in result && result.error) throw new Error(result.error);
      return;
    }
    if (step.kind === "resume") {
      await requestJson(`/api/connected-accounts/${step.targetId}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: true }),
      });
      return;
    }
    await requestJson(`/api/connected-accounts/${step.targetId}/sync`, {
      method: "POST",
      body: JSON.stringify({ syncType: "full" }),
    });
  }

  async function runMerge() {
    setRunning(true);
    setSteps(plan.steps.map((step) => ({ ...step })));
    let completed = 0;
    let failed = 0;
    for (const step of plan.steps) {
      updateStep(step.id, { status: "running" });
      try {
        await runStep(step);
        updateStep(step.id, { status: "done" });
        completed += 1;
      } catch (error) {
        updateStep(step.id, { status: "failed", detail: error instanceof Error ? error.message : "Something went wrong" });
        failed += 1;
      }
    }
    setRunning(false);
    setFinished(true);
    onFinished(completed, failed);
  }

  function handleClose() {
    if (running) return;
    setSteps(null);
    setFinished(false);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Merge everything into one account"
      description="Every step below runs with the permissions you already granted — nothing new is shared."
    >
      <div className="grid gap-4">
        {visibleSteps.length === 0 ? (
          <p className="rounded-[var(--ds-radius-md,0.75rem)] border border-[var(--ds-success-border)] bg-[var(--ds-success-bg)] p-3 text-sm text-[var(--ds-success)]">
            Everything that can merge automatically is already merged. Nice.
          </p>
        ) : (
          <ol className="grid gap-2">
            {visibleSteps.map((step) => (
              <li
                key={step.id}
                className="flex items-start gap-2.5 rounded-[var(--ds-radius-md,0.75rem)] border border-[var(--ds-border)] bg-[var(--ds-surface)] px-3 py-2.5 text-sm"
              >
                <span className="mt-0.5 shrink-0">
                  {step.status === "done" ? (
                    <CheckCircle2 className="h-4 w-4 text-[var(--ds-success)]" aria-hidden="true" />
                  ) : step.status === "failed" ? (
                    <AlertCircle className="h-4 w-4 text-[var(--ds-danger)]" aria-hidden="true" />
                  ) : step.status === "running" ? (
                    <RefreshCw className="h-4 w-4 animate-spin text-[var(--accent)]" aria-hidden="true" />
                  ) : (
                    <span className="block h-4 w-4 rounded-full border border-[var(--ds-border)]" aria-hidden="true" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block text-[var(--text-primary)]">{step.label}</span>
                  {step.detail && <span className="block text-xs text-[var(--ds-danger)]">{step.detail}</span>}
                </span>
              </li>
            ))}
          </ol>
        )}

        {plan.needsYou.length > 0 && (
          <div className="grid gap-1.5 rounded-[var(--ds-radius-md,0.75rem)] border border-[var(--ds-warning-border)] bg-[var(--ds-warning-bg)] p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--ds-warning)]">Needs you</p>
            {plan.needsYou.map((item) => (
              <p key={item} className="text-sm text-[var(--text-secondary)]">{item}</p>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2">
          {finished ? (
            <Button type="button" onClick={handleClose}>Done</Button>
          ) : (
            <>
              <Button type="button" variant="ghost" onClick={handleClose} disabled={running}>
                Cancel
              </Button>
              <Button type="button" onClick={runMerge} loading={running} disabled={visibleSteps.length === 0}>
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Merge everything
              </Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

function MeshAccountMergeSection({
  overview,
  onChanged,
}: {
  overview: OneAccountOverview;
  onChanged: (message: string, type: "success" | "error" | "info") => void;
}) {
  const [email, setEmail] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);

  async function submitMergeRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setBusyKey("create");
    try {
      await requestJson("/api/account/merge", {
        method: "POST",
        body: JSON.stringify({ secondaryEmail: trimmed }),
      });
      setEmail("");
      onChanged(`Merge request sent. The owner of ${trimmed} confirms it from their account.`, "success");
    } catch (error) {
      onChanged(error instanceof Error ? error.message : "Could not create the merge request", "error");
    } finally {
      setBusyKey(null);
    }
  }

  async function cancelMergeRequest(id: string) {
    setBusyKey(`cancel:${id}`);
    try {
      await requestJson("/api/account/merge", {
        method: "PUT",
        body: JSON.stringify({ mergeRequestId: id, action: "cancel" }),
      });
      onChanged("Merge request cancelled", "info");
    } catch (error) {
      onChanged(error instanceof Error ? error.message : "Could not cancel the merge request", "error");
    } finally {
      setBusyKey(null);
    }
  }

  function statusBadge(status: string) {
    if (status === "completed") return <Badge variant="success">Merged</Badge>;
    if (status === "pending") return <Badge variant="warning">Waiting for confirmation</Badge>;
    if (status === "verified") return <Badge variant="accent">Verified</Badge>;
    return <Badge variant="secondary">Cancelled</Badge>;
  }

  return (
    <section className="grid gap-4 rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface)] p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/15 text-[var(--accent)]">
          <Users className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-lg font-bold">Merge another mesh.me account</h2>
          <p className="text-sm leading-6 text-[var(--text-secondary)]">
            Started over at some point? Fold an old mesh.me account into this one. Its owner confirms by email,
            its identity becomes a persona here, and nothing is deleted.
          </p>
        </div>
      </div>

      <form onSubmit={submitMergeRequest} className="flex flex-col gap-2 sm:flex-row">
        <div className="flex-1">
          <Input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="email of the account to merge"
            leftAddon={<Mail className="h-4 w-4" aria-hidden="true" />}
            aria-label="Email of the mesh.me account to merge"
          />
        </div>
        <Button type="submit" variant="secondary" loading={busyKey === "create"}>
          Request merge
        </Button>
      </form>

      {overview.mergeRequests.length > 0 && (
        <ul className="grid gap-2">
          {overview.mergeRequests.map((request) => (
            <li
              key={request.id}
              className="flex flex-wrap items-center gap-2 rounded-[var(--ds-radius-md,0.75rem)] border border-[var(--ds-border)] bg-[var(--ds-surface-muted,var(--ds-surface))] px-3 py-2.5"
            >
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--text-primary)]">
                {request.secondaryEmail}
              </span>
              {statusBadge(request.status)}
              {request.status === "pending" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  loading={busyKey === `cancel:${request.id}`}
                  onClick={() => cancelMergeRequest(request.id)}
                >
                  Cancel
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function OneAccountClient({ overview }: { overview: OneAccountOverview }) {
  const router = useRouter();
  const { addToast } = useToast();
  const [mergeOpen, setMergeOpen] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const hasAccounts = overview.accounts.length > 0;

  async function withBusy(key: string, work: () => Promise<void>, successMessage: string) {
    setBusyKey(key);
    try {
      await work();
      addToast(successMessage, "success");
      router.refresh();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Something went wrong", "error");
    } finally {
      setBusyKey(null);
    }
  }

  function syncAccount(account: OneAccountAccountView) {
    void withBusy(
      `sync:${account.id}`,
      async () => {
        await requestJson(`/api/connected-accounts/${account.id}/sync`, {
          method: "POST",
          body: JSON.stringify({ syncType: "full" }),
        });
      },
      `${account.platformName} content is merging into your mesh`,
    );
  }

  function resumeAccount(account: OneAccountAccountView) {
    void withBusy(
      `resume:${account.id}`,
      async () => {
        await requestJson(`/api/connected-accounts/${account.id}`, {
          method: "PATCH",
          body: JSON.stringify({ isActive: true }),
        });
      },
      `${account.platformName} connection resumed`,
    );
  }

  function foldAccount(account: OneAccountAccountView) {
    void withBusy(
      `fold:${account.id}`,
      async () => {
        const result = await detachAccountFromPersona(account.id);
        if ("error" in result && result.error) throw new Error(result.error);
      },
      `${account.platformName} now belongs to your main identity`,
    );
  }

  function foldPersona(personaId: string, personaUsername: string) {
    void withBusy(
      `persona:${personaId}`,
      async () => {
        const result = await foldPersonaIntoMainIdentity(personaId);
        if ("error" in result && result.error) throw new Error(result.error);
      },
      `@${personaUsername} folded into your main identity`,
    );
  }

  function onMergeFinished(completed: number, failed: number) {
    router.refresh();
    if (failed === 0) {
      addToast(
        completed > 0 ? "Merge complete — your world is one account now" : "Everything was already merged",
        "success",
      );
    } else {
      addToast(`Merge finished: ${completed} done, ${failed} need${failed === 1 ? "s" : ""} attention`, "info");
    }
  }

  return (
    <main data-testid="one-account-center" className="ds-page-shell animate-page-enter grid gap-6">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-bold tracking-[0] sm:text-4xl">One account</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)] sm:text-base">
            Every platform, every profile, every post — merged into the one account that is actually yours.
          </p>
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)]">
            <ShieldCheck className="h-4 w-4 text-[var(--accent)]" aria-hidden="true" />
            Merging uses only permissions you already granted · undo anytime
          </p>
        </div>
        <Button type="button" onClick={() => setMergeOpen(true)} disabled={!hasAccounts && overview.personas.length === 0}>
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          Merge everything
        </Button>
      </header>

      <section className="grid items-center gap-6 rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface)] p-6 lg:grid-cols-[320px,1fr]">
        <IdentityOrbit overview={overview} />
        <div className="grid gap-4">
          <div>
            <h2 className="text-2xl font-bold">
              {overview.identity.displayName} <span className="text-[var(--text-muted)]">@{overview.identity.username}</span>
            </h2>
            <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
              {hasAccounts
                ? `${overview.summary.platforms} platform${overview.summary.platforms === 1 ? "" : "s"} orbit this identity. ${overview.summary.fullyMerged} of ${overview.summary.totalAccounts} account${overview.summary.totalAccounts === 1 ? " is" : "s are"} fully merged.`
                : "No platforms are connected yet — connect your first one and watch it fold into your mesh."}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-[var(--ds-radius-md,0.75rem)] border border-[var(--ds-border)] bg-[var(--ds-surface-muted,var(--ds-surface))] p-3">
              <p className="text-xl font-bold text-[var(--text-primary)]">{overview.summary.fullyMerged}/{overview.summary.totalAccounts}</p>
              <p className="text-xs font-semibold text-[var(--text-muted)]">accounts fully merged</p>
            </div>
            <div className="rounded-[var(--ds-radius-md,0.75rem)] border border-[var(--ds-border)] bg-[var(--ds-surface-muted,var(--ds-surface))] p-3">
              <p className="text-xl font-bold text-[var(--text-primary)]">{formatCount(overview.summary.contentItems)}</p>
              <p className="text-xs font-semibold text-[var(--text-muted)]">posts, comments &amp; followers merged</p>
            </div>
            <div className="rounded-[var(--ds-radius-md,0.75rem)] border border-[var(--ds-border)] bg-[var(--ds-surface-muted,var(--ds-surface))] p-3">
              <p className="text-xl font-bold text-[var(--text-primary)]">{overview.personas.length}</p>
              <p className="text-xs font-semibold text-[var(--text-muted)]">separate personas left</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/connected-accounts" className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
              <PlugZap className="h-3.5 w-3.5" aria-hidden="true" />
              Connect more platforms
            </Link>
            <Link href={`/profile/${overview.identity.username}`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
              See your unified profile
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {hasAccounts && (
        <section className="grid gap-3">
          <div>
            <h2 className="text-xl font-bold">Your accounts, one by one</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Four steps make an account fully merged: connected, identity claimed, content in, unified with your main self.
            </p>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {overview.accounts.map((account, index) => (
              <motion.div
                key={account.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.32, delay: Math.min(index * 0.06, 0.4), ease: [0.16, 1, 0.3, 1] }}
              >
                <AccountRow
                  account={account}
                  busyKey={busyKey}
                  onSync={syncAccount}
                  onResume={resumeAccount}
                  onFold={foldAccount}
                />
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {overview.personas.length > 0 && (
        <section className="grid gap-3">
          <div>
            <h2 className="text-xl font-bold">Personas</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Personas keep parts of your world separate on purpose. Fold one in whenever you want everything under one name.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {overview.personas.map((persona) => (
              <div key={persona.id} className="flex items-center gap-3 rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface)] p-4">
                <Avatar src={persona.avatarUrl} alt={persona.displayName} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-[var(--text-primary)]">{persona.displayName}</p>
                  <p className="truncate text-xs text-[var(--text-muted)]">
                    @{persona.username} · {persona.accountCount} linked account{persona.accountCount === 1 ? "" : "s"}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  loading={busyKey === `persona:${persona.id}`}
                  onClick={() => foldPersona(persona.id, persona.username)}
                >
                  <Combine className="h-3.5 w-3.5" aria-hidden="true" />
                  Fold in
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      <MeshAccountMergeSection
        overview={overview}
        onChanged={(message, type) => {
          addToast(message, type);
          router.refresh();
        }}
      />

      <MergeEverythingModal
        open={mergeOpen}
        onClose={() => setMergeOpen(false)}
        overview={overview}
        onFinished={onMergeFinished}
      />
    </main>
  );
}
