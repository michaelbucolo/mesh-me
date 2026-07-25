"use client";

import { useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { PaperWait } from "@/components/loading/paper-wait";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type Status = { type: "success" | "error"; message: string } | null;

export function AnalyticsControls() {
  const [status, setStatus] = useState<Status>(null);
  const [busyAction, setBusyAction] = useState<"export" | "delete-synced" | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function exportData() {
    setBusyAction("export");
    setStatus(null);
    try {
      const res = await fetch("/api/data-controls?action=export");
      const data = await res.json().catch(() => ({ error: "Export failed" }));
      if (!res.ok) throw new Error(data.error || "Export failed");

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "meshme-data-export.json";
      a.click();
      URL.revokeObjectURL(url);
      setStatus({ type: "success", message: "Data export prepared." });
    } catch (err) {
      setStatus({ type: "error", message: err instanceof Error ? err.message : "Export failed" });
    } finally {
      setBusyAction(null);
    }
  }

  async function deleteSyncedData() {
    setBusyAction("delete-synced");
    setStatus(null);
    try {
      const res = await fetch("/api/data-controls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete-synced-data" }),
      });
      const data = await res.json().catch(() => ({ error: "Delete failed" }));
      if (!res.ok) throw new Error(data.error || "Delete failed");
      setStatus({ type: "success", message: `Deleted ${data.deleted.total} synced records.` });
    } catch (err) {
      setStatus({ type: "error", message: err instanceof Error ? err.message : "Delete failed" });
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="space-y-3">
      {status && (
        <p className={status.type === "success" ? "text-xs text-emerald-400" : "text-xs text-red-400"}>
          {status.message}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          onClick={exportData}
          disabled={busyAction !== null}
          className="rounded-xl border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-4 text-left transition hover:border-[var(--accent-muted)] disabled:opacity-60"
        >
          <Download className="mb-3 h-5 w-5 text-[var(--accent)]" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Export your Mesh data</h3>
          <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
            Download a JSON copy of your profile, posts, messages, privacy settings, connected-account metadata, and synced platform data.
          </p>
          <span className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-[var(--accent)]">
            {busyAction === "export" && <PaperWait size="sm" />}
            Export
          </span>
        </button>

        <button
          onClick={() => setConfirmingDelete(true)}
          disabled={busyAction !== null}
          className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-left transition hover:border-red-500/35 disabled:opacity-60"
        >
          <Trash2 className="mb-3 h-5 w-5 text-red-400" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Delete synced platform data</h3>
          <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
            Remove imported platform content and sync history while keeping your connected-account links intact.
          </p>
          <span className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-red-400">
            {busyAction === "delete-synced" && <PaperWait size="sm" />}
            Delete synced data
          </span>
        </button>
      </div>
      <ConfirmDialog
        open={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        onConfirm={() => void deleteSyncedData()}
        title="Delete synced platform data?"
        description="Imported platform posts, comments, followers, media, analytics, and sync history will be removed. Connected accounts stay linked."
        confirmLabel="Delete synced data"
        destructive
      />
    </div>
  );
}
