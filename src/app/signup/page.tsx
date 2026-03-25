"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signUp } from "@/lib/actions";
import { useState, useTransition, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Check, X, Loader2 } from "lucide-react";

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { score, label: "Weak", color: "bg-red-500" };
  if (score === 2) return { score, label: "Fair", color: "bg-orange-500" };
  if (score === 3) return { score, label: "Good", color: "bg-yellow-500" };
  if (score >= 4) return { score, label: "Strong", color: "bg-emerald-500" };
  return { score: 0, label: "", color: "" };
}

export default function SignupPage() {
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");

  const strength = getPasswordStrength(password);

  const isEmailValid = email === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isUsernameValid = username === "" || /^[a-zA-Z0-9_]+$/.test(username);

  const handleSubmit = useCallback((formData: FormData) => {
    setError("");
    startTransition(async () => {
      const result = await signUp(formData);
      if (result?.error) {
        setError(result.error);
      }
    });
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 mesh-bg flex items-center justify-center px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/20"
            >
              <span className="text-white font-bold text-lg">m</span>
            </motion.div>
          </Link>
          <h1 className="text-2xl font-bold text-zinc-100 mb-2">Create your space</h1>
          <p className="text-zinc-400">Join mesh.me and start building your digital identity</p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="rounded-2xl border border-zinc-800 bg-zinc-900/80 backdrop-blur-sm p-6 shadow-xl shadow-black/20"
        >
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: "auto", marginBottom: 16 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm flex items-center gap-2 overflow-hidden"
              >
                <X className="h-4 w-4 flex-shrink-0" />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <form action={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Display Name</label>
              <Input
                type="text"
                name="displayName"
                placeholder="Your name"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoComplete="name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Username</label>
              <div className="relative">
                <Input
                  type="text"
                  name="username"
                  placeholder="Choose a username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  autoComplete="username"
                  className={!isUsernameValid ? "border-red-500/50 focus:border-red-500 focus:ring-red-500" : ""}
                />
                {username && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {isUsernameValid ? (
                      <Check className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <X className="h-4 w-4 text-red-400" />
                    )}
                  </div>
                )}
              </div>
              {username && !isUsernameValid && (
                <p className="text-xs text-red-400 mt-1">Letters, numbers, and underscores only</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Email</label>
              <div className="relative">
                <Input
                  type="email"
                  name="email"
                  placeholder="you@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className={email && !isEmailValid ? "border-red-500/50 focus:border-red-500 focus:ring-red-500" : ""}
                />
                {email && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {isEmailValid ? (
                      <Check className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <X className="h-4 w-4 text-red-400" />
                    )}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Password</label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="At least 8 characters"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {password && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="mt-2 space-y-1.5"
                >
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                          i <= strength.score ? strength.color : "bg-zinc-700"
                        }`}
                      />
                    ))}
                  </div>
                  <p className={`text-xs ${
                    strength.score <= 1 ? "text-red-400" :
                    strength.score === 2 ? "text-orange-400" :
                    strength.score === 3 ? "text-yellow-400" :
                    "text-emerald-400"
                  }`}>
                    {strength.label} password
                  </p>
                </motion.div>
              )}
            </div>

            <p className="text-xs text-zinc-500">
              By creating an account, you agree to our{" "}
              <Link href="/terms" className="text-blue-400 hover:text-blue-300 transition-colors">Terms</Link> and{" "}
              <Link href="/privacy" className="text-blue-400 hover:text-blue-300 transition-colors">Privacy Policy</Link>.
            </p>

            <motion.div whileTap={{ scale: 0.98 }}>
              <Button type="submit" variant="gradient" className="w-full" size="lg" disabled={isPending}>
                {isPending ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating account...
                  </span>
                ) : (
                  "Create account"
                )}
              </Button>
            </motion.div>
          </form>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center mt-6 text-sm text-zinc-500"
        >
          Already have an account?{" "}
          <Link href="/login" className="text-blue-400 hover:text-blue-300 transition-colors">Sign in</Link>
        </motion.p>
      </motion.div>
    </div>
  );
}
