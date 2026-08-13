"use client";

import { useState, useTransition, Suspense, type CSSProperties } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { PaperWait } from "@/components/loading/paper-wait";
import { resetPassword } from "@/lib/actions";
import { AuthShell } from "@/components/auth/auth-shell";
import { MeshiMascot } from "@/components/meshi/meshi-mascot";
import { EASE_OUT } from "@/lib/motion";


// Brand-tinted sparkle particles flung outward when the reset succeeds.
// Uses the shared `.mesh-burst-particle` primitive (self-guarded for reduced
// motion) — each needs an --angle, --dist, and a background color.
const SPARKLES = [
  { angle: "0deg", dist: "34px", color: "#34e4ea" },
  { angle: "45deg", dist: "28px", color: "#6e8bff" },
  { angle: "90deg", dist: "32px", color: "#8b5cf6" },
  { angle: "135deg", dist: "26px", color: "#ec4899" },
  { angle: "180deg", dist: "34px", color: "#34e4ea" },
  { angle: "225deg", dist: "28px", color: "#6e8bff" },
  { angle: "270deg", dist: "30px", color: "#10b981" },
  { angle: "315deg", dist: "26px", color: "#ec4899" },
];

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();
  const reduce = useReducedMotion();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 12) {
      setError("Password must be at least 12 characters");
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
        <h1 className="mt-4 text-2xl font-semibold text-[var(--text-primary)]">Invalid reset link</h1>
        <p className="mt-2 text-sm text-[var(--text-tertiary)]">This reset link is missing or expired.</p>
        <Link href="/login" className="brand-button mt-6 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold">
          Back to login <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <motion.div
        className="w-full max-w-sm mx-auto text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {/* Happy Meshi reaction bounding in to celebrate. */}
        <motion.div
          initial={reduce ? false : { scale: 0, y: 8 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.05 }}
        >
          <MeshiMascot size={72} mood="celebrating" animate />
        </motion.div>

        {/* The green Check springs/draws in, with an expanding ring and a
            brand sparkle burst. */}
        <div className="relative mx-auto mt-3 flex h-16 w-16 items-center justify-center">
          <motion.span
            aria-hidden="true"
            className="absolute inset-0 rounded-full bg-emerald-500/15"
            initial={reduce ? false : { scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.12 }}
          />
          {!reduce && (
            <motion.span
              aria-hidden="true"
              className="absolute inset-0 rounded-full border-2 border-emerald-400"
              initial={{ opacity: 0.8, scale: 0.4 }}
              animate={{ opacity: 0, scale: 1.9 }}
              transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.2 }}
            />
          )}
          {!reduce && SPARKLES.map((sparkle, index) => (
            <span
              key={index}
              aria-hidden="true"
              className="mesh-burst-particle"
              style={{ "--angle": sparkle.angle, "--dist": sparkle.dist, background: sparkle.color } as CSSProperties}
            />
          ))}
          <motion.svg
            viewBox="0 0 24 24"
            className="relative h-8 w-8"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: "rgb(16,185,129)" }}
            aria-hidden="true"
          >
            <motion.path
              d="M5 13l4 4L19 7"
              initial={reduce ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.45, ease: EASE_OUT, delay: 0.22 }}
            />
          </motion.svg>
        </div>
        <h1 className="mt-4 text-2xl font-semibold text-[var(--text-primary)]">Password updated</h1>
        <p className="mt-2 text-sm text-[var(--text-tertiary)]">Your password has been reset. Sign in with the new one.</p>
        <Link href="/login" className="brand-button mt-6 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold">
          Sign in <ArrowRight className="h-4 w-4" />
        </Link>
      </motion.div>
    );
  }

  return (
    <div className="w-full max-w-sm mx-auto text-center">
      <div className="mb-8">
        <MeshiMascot size={56} mood="happy" animate />
        <h1 className="mt-4 text-2xl font-semibold text-[var(--text-primary)]">Set a new password</h1>
        <p className="mt-2 text-sm text-[var(--text-tertiary)]">Choose a strong password with at least 12 characters.</p>
      </div>
      <div className="rounded-2xl p-6 space-y-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)" }}>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-4 py-2 rounded-xl text-xs text-[var(--danger)] bg-red-500/10 border border-red-500/20"
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
            className="brand-button w-full px-6 py-3.5 rounded-xl text-sm font-semibold shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isPending ? <PaperWait size="sm" /> : <><span>Reset password</span><ArrowRight className="h-4 w-4" /></>}
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
      description="Choose a new password and you'll be back in your Mesh in seconds."
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
