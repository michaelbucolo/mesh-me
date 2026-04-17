"use client";

import { useMemo, useState, useTransition } from "react";
import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { deleteAccount } from "@/lib/actions";

interface DeleteAccountTabProps {
  showError: (msg: string) => void;
}

export function DeleteAccountTab({ showError }: DeleteAccountTabProps) {
  const [confirmText, setConfirmText] = useState("");
  const [isPending, startTransition] = useTransition();

  const canDelete = useMemo(() => confirmText.trim() === "DELETE", [confirmText]);

  const handleDelete = () => {
    if (!canDelete) return;

    startTransition(async () => {
      const result = await deleteAccount();
      if (result && "error" in result) {
        showError(result.error || "Failed to delete account");
      }
    });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="rounded-2xl border border-red-500/20 bg-red-500/8 p-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-xl bg-red-500/15 p-2 text-red-400">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Delete account</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              This permanently deletes your profile, posts, comments, likes, messages, connected accounts, and settings.
            </p>
            <p className="text-sm text-[var(--text-muted)]">
              This action cannot be undone. Type <span className="font-semibold text-red-400">DELETE</span> to confirm.
            </p>
          </div>
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Confirmation</label>
        <Input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="Type DELETE to continue"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
        />
      </div>

      <Button
        type="button"
        onClick={handleDelete}
        disabled={!canDelete || isPending}
        className="bg-red-500 text-white hover:bg-red-400 disabled:opacity-50"
      >
        {isPending ? "Deleting account..." : "Delete account permanently"}
      </Button>
    </motion.div>
  );
}
