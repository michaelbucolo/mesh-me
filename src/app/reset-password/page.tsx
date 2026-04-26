"use client";

import { useState, useTransition, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Check, Eye, EyeOff, Loader2 } from "lucide-react";
import { resetPassword } from "@/lib/actions";
import { AuthShell } from "@/components/auth/auth-shell";
import { MeshiMascot } from "@/components/meshi/meshi-mascot";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setError("");
    startTransition(async () => {
      const result = await resetPassword(token, password);
      if (result?.error) {
        setError(result.error);
      } else {
        setSuccess(true);
      }
    });
  };

  if (!token) {
    return (
      <div className="w-full max-w-sm mx-auto text-center">
        <MeshiMascot size={64} mood="thinking" animate />
        <h1 className="mt-4 text-2xl font-bold text-[var(--text-primary)]">Invalid reset link</h1>
        <p className="mt-2 text-sm text-[var(--text-tertiary)]">This reset link is missing or expired.</p>
        <Link href="/login" className="brand-button mt-6 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white">
          Back to login <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="w-full max-w-sm mx-auto text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15">
          <Check className="h-8 w-8 text-emerald-500" />
        </div>
        <h1 className="mt-4 text-2xl font-bold text-[var(--text-primary)]">Password updated</h1>
        <p className="mt-2 text-sm text-[var(--text-tertiary)]">Your password has been reset. Sign in with the new one.</p>
        <Link href="/login" className="brand-button mt-6 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white">
          Sign in <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm mx-auto text-center">
      <div className="mb-8">
        <MeshiMascot size={56} mood="happy" animate />
        <h1 className="mt-4 text-2xl font-bold text-[var(--text-primary)]">Set a new password</h1>
        <p className="mt-2 text-sm text-[var(--text-tertiary)]">Choose a strong password with at least 8 characters.</p>
      </div>
      <div className="rounded-3xl p-6 space-y-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)" }}>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-4 py-2 rounded-xl text-xs text-red-400 bg-red-500/10 border border-red-500/20"
          >
            {error}
          </motion.div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              placeholder="New password"
              autoComplete="new-password"
              className="w-full px-4 py-3.5 rounded-xl bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)] pr-10 text-center"
              style={{ border: "1px solid var(--border-primary)", color: "var(--text-primary)" }}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: "var(--text-muted)" }}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <input
            type={showPassword ? "text" : "password"}
            value={confirmPassword}
            placeholder="Confirm new password"
            autoComplete="new-password"
            className="w-full px-4 py-3.5 rounded-xl bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)] text-center"
            style={{ border: "1px solid var(--border-primary)", color: "var(--text-primary)" }}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
          <motion.button
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={isPending}
            className="brand-button w-full text-white px-6 py-3.5 rounded-xl text-sm font-semibold shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><span>Reset password</span><ArrowRight className="h-4 w-4" /></>}
          </motion.button>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      description="Password recovery now lives in the same account entry system as login and signup, so users are not dropped into an isolated screen."
    >
      <Suspense
        fallback={
          <div className="text-center">
            <MeshiMascot size={56} mood="thinking" animate />
            <p className="mt-4 text-sm text-[var(--text-muted)]">Loading...</p>
          </div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
