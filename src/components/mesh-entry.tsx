"use client";

import { useState, useTransition, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Loader2, ArrowRight, ArrowLeft } from "lucide-react";
import { signUp, signIn } from "@/lib/actions";

type Mode = "landing" | "login" | "signup";

function PasswordStrength({ password }: { password: string }) {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const labels = ["", "Weak", "Fair", "Good", "Strong", "Strong"];
  const colors = ["", "bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-emerald-500", "bg-emerald-500"];

  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`h-0.5 flex-1 rounded-full transition-all duration-500 ${
              i <= score ? colors[score] : "bg-zinc-800"
            }`}
          />
        ))}
      </div>
      {score > 0 && <p className="text-[11px] text-zinc-500">{labels[score]} password</p>}
    </div>
  );
}

export function MeshEntry() {
  const [mode, setMode] = useState<Mode>("landing");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  // Track focused input for mesh interaction
  const [activeField, setActiveField] = useState<string | null>(null);
  const [inputValues, setInputValues] = useState({ email: "", username: "", displayName: "", password: "" });

  // Emit custom event for mesh background to react to
  useEffect(() => {
    const event = new CustomEvent("mesh-activity", {
      detail: { field: activeField, totalChars: Object.values(inputValues).join("").length },
    });
    window.dispatchEvent(event);
  }, [activeField, inputValues]);

  const handleSignIn = useCallback(
    (formData: FormData) => {
      setError("");
      startTransition(async () => {
        const result = await signIn(formData);
        if (result?.error) setError(result.error);
      });
    },
    []
  );

  const handleSignUp = useCallback(
    (formData: FormData) => {
      setError("");
      startTransition(async () => {
        const result = await signUp(formData);
        if (result?.error) setError(result.error);
      });
    },
    []
  );

  const inputClass =
    "w-full bg-transparent border border-zinc-700/40 rounded-lg px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/20 transition-all duration-300";

  return (
    <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6">
      <AnimatePresence mode="wait">
        {mode === "landing" && (
          <motion.div
            key="landing"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, filter: "blur(8px)" }}
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
            className="text-center max-w-lg"
          >
            {/* Logo */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mb-8"
            >
              <div className="inline-flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <span className="text-white font-bold text-lg">m</span>
                </div>
                <span className="text-2xl font-bold text-zinc-100 tracking-tight">
                  mesh<span className="text-blue-400">.me</span>
                </span>
              </div>
            </motion.div>

            {/* Central bubble */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="relative"
            >
              <div className="absolute inset-0 bg-blue-500/5 rounded-3xl blur-2xl" />
              <div className="relative border border-zinc-800/60 bg-zinc-950/60 backdrop-blur-xl rounded-3xl p-10">
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
                  <span className="text-zinc-100">Enter the</span>
                  <br />
                  <span className="bg-gradient-to-r from-blue-400 via-blue-300 to-cyan-400 bg-clip-text text-transparent">
                    Mesh
                  </span>
                </h1>
                <p className="text-zinc-500 text-sm leading-relaxed mb-8 max-w-sm mx-auto">
                  Your identity. Your people. Your space.
                  <br />
                  One platform for everything.
                </p>
                <div className="flex flex-col gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setMode("signup")}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white px-6 py-3.5 rounded-xl text-sm font-medium shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-shadow flex items-center justify-center gap-2"
                  >
                    Create your space
                    <ArrowRight className="h-4 w-4" />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setMode("login")}
                    className="w-full border border-zinc-800 text-zinc-400 px-6 py-3.5 rounded-xl text-sm font-medium hover:text-zinc-200 hover:border-zinc-700 hover:bg-zinc-900/50 transition-all"
                  >
                    Sign in
                  </motion.button>
                </div>
              </div>
            </motion.div>

            {/* Bottom tagline */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="mt-8 text-xs text-zinc-700"
            >
              Identity-first &middot; Creator-friendly &middot; Community-powered
            </motion.p>
          </motion.div>
        )}

        {mode === "login" && (
          <motion.div
            key="login"
            initial={{ opacity: 0, scale: 0.95, filter: "blur(8px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.9, filter: "blur(8px)" }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            className="w-full max-w-sm"
          >
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">m</span>
                </div>
              </div>
              <h2 className="text-xl font-bold text-zinc-100">Welcome back</h2>
              <p className="text-sm text-zinc-500 mt-1">Sign in to your mesh</p>
            </div>

            <div className="border border-zinc-800/50 bg-zinc-950/60 backdrop-blur-xl rounded-2xl p-6">
              <AnimatePresence mode="wait">
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4 p-3 rounded-lg bg-red-500/8 border border-red-500/15 text-red-400 text-xs overflow-hidden"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <form ref={formRef} action={handleSignIn} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5 uppercase tracking-wider">Email</label>
                  <input
                    type="email"
                    name="email"
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                    className={inputClass}
                    onFocus={() => setActiveField("email")}
                    onBlur={() => setActiveField(null)}
                    onChange={(e) => setInputValues((v) => ({ ...v, email: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5 uppercase tracking-wider">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      placeholder="Enter your password"
                      required
                      autoComplete="current-password"
                      className={`${inputClass} pr-10`}
                      onFocus={() => setActiveField("password")}
                      onBlur={() => setActiveField(null)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={isPending}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white px-6 py-3 rounded-xl text-sm font-medium shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
                </motion.button>
              </form>
            </div>

            <div className="flex items-center justify-between mt-5">
              <button
                onClick={() => { setMode("landing"); setError(""); }}
                className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors flex items-center gap-1"
              >
                <ArrowLeft className="h-3 w-3" /> Back
              </button>
              <button
                onClick={() => { setMode("signup"); setError(""); }}
                className="text-xs text-zinc-500 hover:text-blue-400 transition-colors"
              >
                Create an account
              </button>
            </div>
          </motion.div>
        )}

        {mode === "signup" && (
          <motion.div
            key="signup"
            initial={{ opacity: 0, scale: 0.95, filter: "blur(8px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.9, filter: "blur(8px)" }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            className="w-full max-w-sm"
          >
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">m</span>
                </div>
              </div>
              <h2 className="text-xl font-bold text-zinc-100">Create your space</h2>
              <p className="text-sm text-zinc-500 mt-1">Join the mesh</p>
            </div>

            <div className="border border-zinc-800/50 bg-zinc-950/60 backdrop-blur-xl rounded-2xl p-6">
              <AnimatePresence mode="wait">
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4 p-3 rounded-lg bg-red-500/8 border border-red-500/15 text-red-400 text-xs overflow-hidden"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <form action={handleSignUp} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5 uppercase tracking-wider">Display Name</label>
                  <input
                    type="text"
                    name="displayName"
                    placeholder="Your name"
                    required
                    autoComplete="name"
                    className={inputClass}
                    onFocus={() => setActiveField("displayName")}
                    onBlur={() => setActiveField(null)}
                    onChange={(e) => setInputValues((v) => ({ ...v, displayName: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5 uppercase tracking-wider">Username</label>
                  <input
                    type="text"
                    name="username"
                    placeholder="Choose a username"
                    required
                    autoComplete="username"
                    className={inputClass}
                    onFocus={() => setActiveField("username")}
                    onBlur={() => setActiveField(null)}
                    onChange={(e) => {
                      const val = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "");
                      e.target.value = val;
                      setInputValues((v) => ({ ...v, username: val }));
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5 uppercase tracking-wider">Email</label>
                  <input
                    type="email"
                    name="email"
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                    className={inputClass}
                    onFocus={() => setActiveField("email")}
                    onBlur={() => setActiveField(null)}
                    onChange={(e) => setInputValues((v) => ({ ...v, email: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5 uppercase tracking-wider">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      placeholder="At least 8 characters"
                      required
                      minLength={8}
                      autoComplete="new-password"
                      className={`${inputClass} pr-10`}
                      value={password}
                      onFocus={() => setActiveField("password")}
                      onBlur={() => setActiveField(null)}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setInputValues((v) => ({ ...v, password: e.target.value }));
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {password && <PasswordStrength password={password} />}
                </div>
                <p className="text-[10px] text-zinc-600 leading-relaxed">
                  By creating an account, you agree to our Terms and Privacy Policy.
                </p>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={isPending}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white px-6 py-3 rounded-xl text-sm font-medium shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
                </motion.button>
              </form>
            </div>

            <div className="flex items-center justify-between mt-5">
              <button
                onClick={() => { setMode("landing"); setError(""); setPassword(""); }}
                className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors flex items-center gap-1"
              >
                <ArrowLeft className="h-3 w-3" /> Back
              </button>
              <button
                onClick={() => { setMode("login"); setError(""); setPassword(""); }}
                className="text-xs text-zinc-500 hover:text-blue-400 transition-colors"
              >
                Already have an account?
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
