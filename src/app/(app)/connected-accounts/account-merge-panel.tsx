"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Combine,
  KeyRound,
  ShieldAlert,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Avatar } from "@/components/ui/avatar";
import type {
  AccountMergeCenter,
  AccountMergeSummary,
  IncomingMergeRequestView,
  OutgoingMergeRequestView,
} from "@/lib/account-merge";
import {
  approveIncomingMergeRequest,
  cancelAccountMergeRequest,
  declineIncomingMergeRequest,
  finalizeAccountMerge,
  requestAccountMerge,
} from "@/lib/account-merge-actions";

type Notice = { type: "success" | "error"; message: string } | null;

function formatDay(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}

function NoticeLine({ notice, onDismiss }: { notice: Notice; onDismiss: () => void }) {
  if (!notice) return null;
  return (
    <div
      role="status"
      className={
        notice.type === "error"
          ? "flex items-start gap-2 rounded-[var(--ds-radius-md)] border border-[var(--ds-danger-border)] bg-[var(--ds-danger-bg)] px-3 py-2 text-sm text-[var(--ds-danger)]"
          : "flex items-start gap-2 rounded-[var(--ds-radius-md)] border border-[var(--ds-success-border)] bg-[var(--ds-success-bg)] px-3 py-2 text-sm text-[var(--ds-success)]"
      }
    >
      {notice.type === "error" ? (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      ) : (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      )}
      <span className="min-w-0 flex-1 leading-5">{notice.message}</span>
      <button type="button" onClick={onDismiss} className="shrink-0 opacity-70 transition-opacity hover:opacity-100" aria-label="Dismiss">
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export function AccountMergePanel({
  center,
  identity,
}: {
  center: AccountMergeCenter;
  identity: { username: string };
}) {
  const router = useRouter();
  const [outgoing, setOutgoing] = useState<OutgoingMergeRequestView[]>(center.outgoing);
  const [incoming, setIncoming] = useState<IncomingMergeRequestView[]>(center.incoming);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [targetPassword, setTargetPassword] = useState("");

  const [approving, setApproving] = useState<IncomingMergeRequestView | null>(null);
  const [finalizing, setFinalizing] = useState<OutgoingMergeRequestView | null>(null);
  const [ownPassword, setOwnPassword] = useState("");
  const [summary, setSummary] = useState<AccountMergeSummary | null>(null);

  async function submitRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("request");
    setNotice(null);
    try {
      const result = await requestAccountMerge({
        identifier,
        targetPassword: targetPassword || undefined,
      });
      if ("error" in result && result.error) throw new Error(result.error);
      if ("request" in result && result.request) {
        const request = result.request;
        setOutgoing((current) => [request, ...current.filter((entry) => entry.id !== request.id)]);
        setNotice({ type: "success", message: result.message });
        setIdentifier("");
        setTargetPassword("");
        setFormOpen(false);
      }
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Could not create the merge request." });
    } finally {
      setBusy(null);
    }
  }

  async function cancelRequest(request: OutgoingMergeRequestView) {
    setBusy(`cancel-${request.id}`);
    setNotice(null);
    try {
      const result = await cancelAccountMergeRequest(request.id);
      if ("error" in result && result.error) throw new Error(result.error);
      setOutgoing((current) => current.filter((entry) => entry.id !== request.id));
      setNotice({ type: "success", message: "Merge request cancelled." });
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Could not cancel the request." });
    } finally {
      setBusy(null);
    }
  }

  async function approveRequest(request: IncomingMergeRequestView) {
    setBusy(`approve-${request.id}`);
    setNotice(null);
    try {
      const result = await approveIncomingMergeRequest(request.id);
      if ("error" in result && result.error) throw new Error(result.error);
      setIncoming((current) =>
        current.map((entry) => (entry.id === request.id ? { ...entry, status: "verified" as const } : entry)),
      );
      setNotice({
        type: "success",
        message: `Approved. @${request.requester.username} can now finalize the merge — you can still decline before they do.`,
      });
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Could not approve the request." });
    } finally {
      setBusy(null);
    }
  }

  async function declineRequest(request: IncomingMergeRequestView) {
    setBusy(`decline-${request.id}`);
    setNotice(null);
    try {
      const result = await declineIncomingMergeRequest(request.id);
      if ("error" in result && result.error) throw new Error(result.error);
      setIncoming((current) => current.filter((entry) => entry.id !== request.id));
      setNotice({ type: "success", message: "Merge request declined." });
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Could not decline the request." });
    } finally {
      setBusy(null);
    }
  }

  async function finalize() {
    if (!finalizing) return;
    setBusy(`finalize-${finalizing.id}`);
    setNotice(null);
    try {
      const result = await finalizeAccountMerge(finalizing.id, ownPassword);
      if ("error" in result && result.error) throw new Error(result.error);
      if ("summary" in result && result.summary) {
        setSummary(result.summary);
        setOutgoing((current) => current.filter((entry) => entry.id !== finalizing.id));
        setFinalizing(null);
        setOwnPassword("");
        router.refresh();
      }
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Could not finalize the merge." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="grid gap-3 rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h2 className="inline-flex items-center gap-2 text-lg font-bold">
            <Combine className="h-5 w-5 text-[var(--accent)]" aria-hidden="true" />
            Merge another mesh.me account
          </h2>
          <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
            Fold a second mesh.me account into this one. Its posts, follows, and connected platforms move here,
            and the other account is permanently deactivated. Both sides must prove it&apos;s really them.
          </p>
        </div>
        {!formOpen && (
          <Button type="button" variant="secondary" size="sm" onClick={() => { setFormOpen(true); setSummary(null); }}>
            <Combine className="h-4 w-4" aria-hidden="true" />
            Start a merge
          </Button>
        )}
      </div>

      <NoticeLine notice={notice} onDismiss={() => setNotice(null)} />

      {incoming.length > 0 && (
        <div className="grid gap-2">
          {incoming.map((request) => (
            <div
              key={request.id}
              className="grid gap-3 rounded-[var(--ds-radius-md)] border border-[var(--ds-warning-border)] bg-[var(--ds-warning-bg)] p-4"
            >
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-[var(--ds-warning)]" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[var(--text-primary)]">
                    @{request.requester.username} wants to merge this account into theirs
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                    {request.status === "verified"
                      ? "This request is already approved — your password was used to verify it, or you approved it earlier. You can still decline before it’s finalized."
                      : "If you approve and they finalize, everything here moves to their account and this account is deactivated. This can’t be undone."}
                  </p>
                  <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                    Expires {formatDay(request.expiresAt)}
                  </p>
                </div>
                <Avatar
                  src={request.requester.avatarUrl}
                  alt={request.requester.displayName || request.requester.username}
                  size="sm"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {request.status === "pending" && (
                  <Button
                    type="button"
                    size="sm"
                    loading={busy === `approve-${request.id}`}
                    disabled={busy !== null}
                    onClick={() => setApproving(request)}
                  >
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    Approve merge
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  loading={busy === `decline-${request.id}`}
                  disabled={busy !== null}
                  onClick={() => declineRequest(request)}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                  Decline
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {summary && (
        <div className="grid gap-2 rounded-[var(--ds-radius-md)] border border-[var(--ds-success-border)] bg-[var(--ds-success-bg)] p-4">
          <p className="inline-flex items-center gap-2 text-sm font-bold text-[var(--ds-success)]">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            @{summary.mergedUsername} is now part of @{identity.username}
          </p>
          <ul className="grid gap-1 text-sm leading-6 text-[var(--text-secondary)] sm:grid-cols-2">
            <li>{summary.postsMoved} post{summary.postsMoved === 1 ? "" : "s"} moved</li>
            <li>{summary.followersAdded} follower{summary.followersAdded === 1 ? "" : "s"} added</li>
            <li>{summary.followingAdded} follow{summary.followingAdded === 1 ? "" : "s"} carried over</li>
            <li>
              {summary.accountsMoved} connected account{summary.accountsMoved === 1 ? "" : "s"} moved
              {summary.accountsSkipped > 0 ? ` (${summary.accountsSkipped} duplicate kept on the old account)` : ""}
            </li>
            <li>{summary.emailsLinked} email{summary.emailsLinked === 1 ? "" : "s"} linked</li>
            {summary.personaCreated && <li>@{summary.mergedUsername} saved as a persona</li>}
          </ul>
          <p className="text-xs leading-5 text-[var(--text-muted)]">
            The old account is deactivated and points here. Comments, messages, and community memberships stay archived with it.
          </p>
        </div>
      )}

      {formOpen && (
        <form onSubmit={submitRequest} className="grid gap-3 rounded-[var(--ds-radius-md)] border border-[var(--ds-border)] bg-[var(--bg-primary)]/55 p-4">
          <div className="flex items-start gap-2 rounded-[var(--ds-radius-sm)] border border-[var(--ds-warning-border)] bg-[var(--ds-warning-bg)] px-3 py-2 text-xs leading-5 text-[var(--ds-warning)]">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              Merging is permanent. The other account&apos;s posts, follows, and connections move into
              @{identity.username}, and that account is deactivated. Conflicting profile details keep this
              account&apos;s version. Subscriptions are not transferred.
            </span>
          </div>
          <Input
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder="Email or username of the other account"
            autoComplete="off"
            aria-label="Email or username of the account to merge"
            required
          />
          <Input
            type="password"
            value={targetPassword}
            onChange={(event) => setTargetPassword(event.target.value)}
            placeholder="That account’s password (optional)"
            autoComplete="off"
            aria-label="Password of the account to merge (optional)"
          />
          <p className="text-xs leading-5 text-[var(--text-muted)]">
            Enter that account&apos;s password to verify ownership instantly — or leave it blank and the
            account&apos;s owner can approve the request from their own One Account page. Requests expire after 7 days.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" loading={busy === "request"} disabled={!identifier.trim() || busy !== null}>
              <Combine className="h-4 w-4" aria-hidden="true" />
              Request merge
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {outgoing.length > 0 && (
        <div className="grid gap-2">
          {outgoing.map((request) => (
            <div
              key={request.id}
              className="flex flex-wrap items-center gap-3 rounded-[var(--ds-radius-md)] border border-[var(--ds-border)] bg-[var(--bg-primary)]/55 p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-[var(--text-primary)]">{request.target}</p>
                <p className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  Requested {formatDay(request.createdAt)} · expires {formatDay(request.expiresAt)}
                </p>
              </div>
              <Badge variant={request.status === "verified" ? "success" : "warning"}>
                {request.status === "verified" ? "Ready to finalize" : "Awaiting approval"}
              </Badge>
              {request.status === "verified" && (
                <Button
                  type="button"
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => { setFinalizing(request); setOwnPassword(""); }}
                >
                  <KeyRound className="h-4 w-4" aria-hidden="true" />
                  Finalize
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                loading={busy === `cancel-${request.id}`}
                disabled={busy !== null}
                onClick={() => cancelRequest(request)}
              >
                Cancel
              </Button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={approving !== null}
        onClose={() => setApproving(null)}
        onConfirm={() => {
          if (approving) void approveRequest(approving);
        }}
        title={`Let @${approving?.requester.username ?? "them"} absorb this account?`}
        description="Once they finalize, your posts, follows, and connected platforms move to their account and this account is permanently deactivated. This can’t be undone."
        confirmLabel="Approve merge"
        destructive
      />

      <Modal
        open={finalizing !== null}
        onClose={() => { setFinalizing(null); setOwnPassword(""); }}
        title="Finalize the merge"
        description={`"${finalizing?.target ?? ""}" will be folded into @${identity.username} and deactivated. This can’t be undone.`}
        className="max-w-md"
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void finalize();
          }}
          className="grid gap-3"
        >
          <ul className="grid gap-1 text-sm leading-6 text-[var(--text-secondary)]">
            <li>· Posts, follows, and connected platforms move here (duplicates are skipped)</li>
            <li>· Profile blanks fill in from the other account — conflicts keep this account&apos;s version</li>
            <li>· The other account is deactivated and all of its sessions are signed out</li>
          </ul>
          <Input
            type="password"
            value={ownPassword}
            onChange={(event) => setOwnPassword(event.target.value)}
            placeholder="Your password"
            autoComplete="current-password"
            aria-label="Confirm your own password"
            required
            autoFocus
          />
          <p className="text-xs leading-5 text-[var(--text-muted)]">
            Re-enter <span className="font-semibold">your own</span> password to confirm — a signed-in session alone isn&apos;t enough for an irreversible merge.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => { setFinalizing(null); setOwnPassword(""); }}>
              Keep both accounts
            </Button>
            <Button
              type="submit"
              variant="danger"
              loading={busy === `finalize-${finalizing?.id ?? ""}`}
              disabled={!ownPassword || busy !== null}
            >
              Merge permanently
            </Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
