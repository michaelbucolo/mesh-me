"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signIn } from "@/lib/actions";
import { useState, useTransition, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, X, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = useCallback((formData: FormData) => {
    setError("");
    startTransition(async () => {
      const result = await signIn(formData);
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
          <h1 className="text-2xl font-bold text-zinc-100 mb-2">Welcome back</h1>
          <p className="text-zinc-400">Sign in to your mesh.me account</p>
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
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Email</label>
              <Input
                type="email"
                name="email"
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Password</label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
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
            </div>
            <motion.div whileTap={{ scale: 0.98 }}>
              <Button type="submit" variant="gradient" className="w-full" size="lg" disabled={isPending}>
                {isPending ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in...
                  </span>
                ) : (
                  "Sign in"
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
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-blue-400 hover:text-blue-300 transition-colors">Create one</Link>
        </motion.p>
      </motion.div>
    </div>
  );
}
