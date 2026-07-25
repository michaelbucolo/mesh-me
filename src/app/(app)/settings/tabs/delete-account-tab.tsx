"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Eye, EyeOff } from "lucide-react";
import { PaperWait } from "@/components/loading/paper-wait";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { deleteAccount } from "@/lib/actions";

interface DeleteAccountTabProps {
  showError?: (msg: string) => void;
  /** False for accounts created through Google or Apple, which have no password
   *  to re-enter. Defaults true so an omission fails CLOSED (still asks for a
   *  password) rather than opening the control to accounts that do have one. */
  hasPassword?: boolean;
}

export function DeleteAccountTab({ showError, hasPassword = true }: DeleteAccountTabProps) {
  const confirmationId = useId();
  const passwordId = useId();
  const [confirmText, setConfirmText] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState("");
  const [isPending, startTransition] = useTransition();

  // A federated account cannot type a password it was never given. Requiring
  // one here left the button disabled forever — the UI half of an account that
  // could not be deleted at all.
  const canDelete = useMemo(
    () => confirmText.trim() === "DELETE" && (!hasPassword || currentPassword.length > 0),
    [confirmText, currentPassword, hasPassword],
  );

  const handleDelete = () => {
    if (!canDelete) return;

    startTransition(async () => {
      setLocalError("");
      const formData = new FormData();
      formData.set("confirmation", confirmText);
      formData.set("currentPassword", currentPassword);
      const result = await deleteAccount(formData);
      if (result && "error" in result) {
        const message = result.error || "Failed to delete account";
        setLocalError(message);
        showError?.(message);
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
              This action cannot be undone. Type <span className="font-semibold text-red-400">DELETE</span> and enter your current password to confirm.
            </p>
          </div>
        </div>
      </div>

      <div>
        <label htmlFor={confirmationId} className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Confirmation</label>
        <Input
          id={confirmationId}
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="Type DELETE to continue"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
        />
      </div>

      {hasPassword ? (
        <div>
          <label htmlFor={passwordId} className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Current password</label>
          <span className="relative block">
            <Input
              id={passwordId}
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              type={showPassword ? "text" : "password"}
              placeholder="Enter your current password"
              autoComplete="current-password"
              className="pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
            </button>
          </span>
        </div>
      ) : (
        <p className="rounded-xl border border-[var(--rule)] bg-[var(--paper-2)] px-3 py-2 text-sm text-[var(--text-secondary)]">
          You signed in with Google or Apple, so there is no password to re-enter. Typing DELETE above is the confirmation.
        </p>
      )}

      {localError ? (
        <p className="rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-100" role="alert">
          {localError}
        </p>
      ) : null}

      <Button
        type="button"
        onClick={handleDelete}
        disabled={!canDelete || isPending}
        variant="danger"
        className="disabled:opacity-50"
      >
        {isPending ? <PaperWait size="sm" /> : null}
        {isPending ? "Deleting account..." : "Delete account permanently"}
      </Button>
    </motion.div>
  );
}
