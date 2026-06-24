"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { changePassword } from "@/lib/actions";
import { SettingsCard, SettingsCardHeader } from "./settings-primitives";
import { AlertTriangle, Loader2, Mail, Phone, ShieldCheck, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { motion } from "framer-motion";

interface SecurityTabProps {
  showSuccess: (msg: string) => void;
  showError: (msg: string) => void;
}

export function SecurityTab({ showSuccess, showError }: SecurityTabProps) {
  const [isPending, startTransition] = useTransition();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryPhone, setRecoveryPhone] = useState("");
  const [emails, setEmails] = useState<Array<{ id: string; email: string; isVerified: boolean }>>([]);
  const [phones, setPhones] = useState<Array<{ id: string; phone: string; isVerified: boolean }>>([]);
  const [twoFactorMethods, setTwoFactorMethods] = useState<Array<{ id: string; method: string; label: string; isEnabled: boolean }>>([]);
  const [isLoadingMethods, setIsLoadingMethods] = useState(true);
  const [isSavingRecoveryEmail, setIsSavingRecoveryEmail] = useState(false);
  const [isSavingRecoveryPhone, setIsSavingRecoveryPhone] = useState(false);
  const [isSavingTwoFactor, setIsSavingTwoFactor] = useState(false);
  const [isDeletingMethodId, setIsDeletingMethodId] = useState<string | null>(null);
  const [twoFactorEnrollmentBlockedReason, setTwoFactorEnrollmentBlockedReason] = useState<string | null>(null);
  const [activeTwoFactorMethod, setActiveTwoFactorMethod] = useState<"email" | "sms" | "totp" | "passkey" | null>(null);

  const hasVerifiedRecoveryMethod = useMemo(
    () => emails.some((item) => item.isVerified) || phones.some((item) => item.isVerified),
    [emails, phones],
  );
  const normalizedEmail = recoveryEmail.trim().toLowerCase();
  const normalizedPhone = recoveryPhone.trim();
  const canAddRecoveryEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
  const canAddRecoveryPhone = normalizedPhone.replace(/[^\d]/g, "").length >= 7;
  const configuredTwoFactorMethods = useMemo(() => new Set(twoFactorMethods.map((item) => item.method)), [twoFactorMethods]);

  const loadSecurityMethods = useCallback(async (options?: { keepLoading?: boolean; signal?: AbortSignal }) => {
    if (!options?.keepLoading) {
      setIsLoadingMethods(true);
    }
    try {
      const [emailsRes, phonesRes, twoFactorRes] = await Promise.all([
        fetch("/api/account/emails", { cache: "no-store", signal: options?.signal }),
        fetch("/api/account/phones", { cache: "no-store", signal: options?.signal }),
        fetch("/api/account/two-factor", { cache: "no-store", signal: options?.signal }),
      ]);

      if (!emailsRes.ok || !phonesRes.ok || !twoFactorRes.ok) {
        showError("Could not load account security methods");
        return;
      }

      const emailsPayload = await emailsRes.json().catch(() => ({}));
      const phonesPayload = await phonesRes.json().catch(() => ({}));
      const twoFactorPayload = await twoFactorRes.json().catch(() => ({}));
      setEmails(emailsPayload.emails ?? []);
      setPhones(phonesPayload.phones ?? []);
      setTwoFactorMethods(twoFactorPayload.methods ?? []);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      showError("Could not load account security methods");
    } finally {
      setIsLoadingMethods(false);
    }
  }, [showError]);

  useEffect(() => {
    const controller = new AbortController();
    const run = async () => {
      await loadSecurityMethods({ keepLoading: true, signal: controller.signal });
    };
    void run();
    return () => {
      controller.abort();
    };
  }, [loadSecurityMethods]);

  const getErrorMessage = async (res: Response, fallback: string) => {
    try {
      const payload = await res.json();
      return payload?.error || fallback;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return fallback;
      }
      return fallback;
    }
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.set("currentPassword", currentPassword);
    formData.set("newPassword", newPassword);
    formData.set("confirmPassword", confirmPassword);
    startTransition(async () => {
      const result = await changePassword(formData);
      if (result && "error" in result) {
        showError(result.error || "Failed to change password");
      } else {
        showSuccess("Password changed successfully");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    });
  };

  const handleAddRecoveryEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAddRecoveryEmail) return;
    setIsSavingRecoveryEmail(true);
    try {
      const res = await fetch("/api/account/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: recoveryEmail.trim() }),
      });
      if (!res.ok) {
        showError(await getErrorMessage(res, "Could not add recovery email"));
        return;
      }
      showSuccess("Recovery email added");
      setRecoveryEmail("");
      await loadSecurityMethods();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      showError("Could not add recovery email");
    } finally {
      setIsSavingRecoveryEmail(false);
    }
  };

  const handleAddRecoveryPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAddRecoveryPhone) return;
    setIsSavingRecoveryPhone(true);
    try {
      const res = await fetch("/api/account/phones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: recoveryPhone.trim() }),
      });
      if (!res.ok) {
        showError(await getErrorMessage(res, "Could not add recovery phone"));
        return;
      }
      showSuccess("Recovery phone added");
      setRecoveryPhone("");
      await loadSecurityMethods();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      showError("Could not add recovery phone");
    } finally {
      setIsSavingRecoveryPhone(false);
    }
  };

  const handleDeleteMethod = async (endpoint: "/api/account/emails" | "/api/account/phones" | "/api/account/two-factor", key: string, value: string) => {
    setIsDeletingMethodId(value);
    try {
      const res = await fetch(endpoint, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      if (!res.ok) {
        showError(await getErrorMessage(res, "Could not remove method"));
        return;
      }
      showSuccess("Method removed");
      await loadSecurityMethods();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      showError("Could not remove method");
    } finally {
      setIsDeletingMethodId(null);
    }
  };

  const handleEnrollMethod = async (method: "email" | "sms" | "totp" | "passkey") => {
    if (twoFactorEnrollmentBlockedReason || configuredTwoFactorMethods.has(method)) return;
    setIsSavingTwoFactor(true);
    setActiveTwoFactorMethod(method);
    try {
      const res = await fetch("/api/account/two-factor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method }),
      });
      if (!res.ok) {
        const message = await getErrorMessage(res, "Could not add 2FA method");
        if (res.status === 501) {
          setTwoFactorEnrollmentBlockedReason(message);
        }
        showError(message);
        return;
      }
      setTwoFactorEnrollmentBlockedReason(null);
      showSuccess("2FA method added");
      await loadSecurityMethods();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      showError("Could not add 2FA method");
    } finally {
      setIsSavingTwoFactor(false);
      setActiveTwoFactorMethod(null);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <SettingsCard>
        <SettingsCardHeader title="Change password" description="Choose a strong password with at least 12 characters, a number, and a symbol." />
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Current password</label>
            <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Enter current password" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">New password</label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Enter new password" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Confirm new password</label>
            <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm new password" />
          </div>
          <Button type="submit" variant="gradient" disabled={isPending}>
            {isPending ? "Changing..." : "Change password"}
          </Button>
        </form>
      </SettingsCard>

      <SettingsCard>
        <SettingsCardHeader
          title="Recovery methods"
          icon={<ShieldCheck className="h-4 w-4 text-[var(--accent)]" />}
          description="Add at least one verified email or phone so you can recover your account if you get locked out."
        />
        <div className="mb-4 flex justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={() => void loadSecurityMethods()} disabled={isLoadingMethods}>
            {isLoadingMethods ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh methods"}
          </Button>
        </div>

        {!hasVerifiedRecoveryMethod && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
            <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5" />
            <p className="text-xs text-amber-200">
              You do not have a verified recovery method yet. Add one now to avoid account lockout risk.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <form onSubmit={handleAddRecoveryEmail} className="space-y-2">
            <label className="text-xs font-medium text-[var(--text-secondary)]">Add recovery email</label>
            <div className="flex gap-2">
              <Input value={recoveryEmail} onChange={(e) => setRecoveryEmail(e.target.value)} placeholder="you@example.com" />
              <Button type="submit" variant="secondary" disabled={isSavingRecoveryEmail || !canAddRecoveryEmail}>
                {isSavingRecoveryEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
              </Button>
            </div>
            {normalizedEmail.length > 0 && !canAddRecoveryEmail && (
              <p className="text-xs text-amber-300">Enter a valid email address.</p>
            )}
          </form>
          <form onSubmit={handleAddRecoveryPhone} className="space-y-2">
            <label className="text-xs font-medium text-[var(--text-secondary)]">Add recovery phone</label>
            <div className="flex gap-2">
              <Input value={recoveryPhone} onChange={(e) => setRecoveryPhone(e.target.value)} placeholder="+1 555 000 0000" />
              <Button type="submit" variant="secondary" disabled={isSavingRecoveryPhone || !canAddRecoveryPhone}>
                {isSavingRecoveryPhone ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
              </Button>
            </div>
            {normalizedPhone.length > 0 && !canAddRecoveryPhone && (
              <p className="text-xs text-amber-300">Phone number should contain at least 7 digits.</p>
            )}
          </form>
        </div>

        <div className="mt-4 space-y-2">
          {emails.map((item) => (
            <div key={item.id} className="glass-surface rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Mail className="h-4 w-4 text-[var(--text-muted)]" />
                <span className="text-sm text-[var(--text-primary)] truncate">{item.email}</span>
                <span className="text-xs text-[var(--text-muted)]">({item.isVerified ? "Verified" : "Unverified"})</span>
              </div>
              <Button type="button" variant="ghost" size="icon" disabled={isDeletingMethodId === item.id} onClick={() => void handleDeleteMethod("/api/account/emails", "emailId", item.id)} aria-label="Remove email">
                <Trash2 className="h-4 w-4 text-[var(--text-muted)]" />
              </Button>
            </div>
          ))}
          {phones.map((item) => (
            <div key={item.id} className="glass-surface rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Phone className="h-4 w-4 text-[var(--text-muted)]" />
                <span className="text-sm text-[var(--text-primary)] truncate">{item.phone}</span>
                <span className="text-xs text-[var(--text-muted)]">({item.isVerified ? "Verified" : "Unverified"})</span>
              </div>
              <Button type="button" variant="ghost" size="icon" disabled={isDeletingMethodId === item.id} onClick={() => void handleDeleteMethod("/api/account/phones", "phoneId", item.id)} aria-label="Remove phone">
                <Trash2 className="h-4 w-4 text-[var(--text-muted)]" />
              </Button>
            </div>
          ))}
          {!emails.length && !phones.length && !isLoadingMethods && <p className="text-xs text-[var(--text-muted)]">No recovery methods added yet.</p>}
        </div>
      </SettingsCard>

      <SettingsCard>
        <SettingsCardHeader
          title="Two-factor authentication"
          icon={<ShieldCheck className="h-4 w-4 text-[var(--accent)]" />}
          description="Enroll one or more methods and remove methods you no longer use."
        />
        {twoFactorEnrollmentBlockedReason && (
          <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
            <p className="text-xs text-amber-200">{twoFactorEnrollmentBlockedReason}</p>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="mt-2"
              onClick={() => setTwoFactorEnrollmentBlockedReason(null)}
            >
              Retry enrollment
            </Button>
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { method: "email", label: "Email OTP" },
            { method: "sms", label: "SMS OTP" },
            { method: "totp", label: "Authenticator" },
            { method: "passkey", label: "Passkey" },
          ].map((option) => (
            <Button
              key={option.method}
              type="button"
              variant="secondary"
              disabled={isSavingTwoFactor || !!twoFactorEnrollmentBlockedReason || configuredTwoFactorMethods.has(option.method)}
              onClick={() => void handleEnrollMethod(option.method as "email" | "sms" | "totp" | "passkey")}
            >
              {isSavingTwoFactor && activeTwoFactorMethod === option.method ? <Loader2 className="h-4 w-4 animate-spin" /> : configuredTwoFactorMethods.has(option.method) ? `${option.label} added` : `Add ${option.label}`}
            </Button>
          ))}
        </div>
        <div className="mt-4 space-y-2">
          {twoFactorMethods.map((item) => (
            <div key={item.id} className="glass-surface rounded-xl p-3 flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-sm text-[var(--text-primary)] truncate">{item.label}</p>
                <p className="text-xs text-[var(--text-muted)]">{item.method.toUpperCase()} · {item.isEnabled ? "Enabled" : "Pending verification"}</p>
              </div>
              <Button type="button" variant="ghost" size="icon" disabled={isDeletingMethodId === item.id} onClick={() => void handleDeleteMethod("/api/account/two-factor", "methodId", item.id)} aria-label="Remove 2FA method">
                <Trash2 className="h-4 w-4 text-[var(--text-muted)]" />
              </Button>
            </div>
          ))}
          {!twoFactorMethods.length && !isLoadingMethods && <p className="text-xs text-[var(--text-muted)]">No 2FA methods configured.</p>}
        </div>
      </SettingsCard>
    </motion.div>
  );
}
