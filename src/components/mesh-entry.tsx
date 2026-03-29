"use client";

import { useState, useTransition, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Loader2, ArrowRight, ArrowLeft, Check, Phone, Link2 } from "lucide-react";
import { signUp, signIn } from "@/lib/actions";

type AuthStep = "welcome" | "username" | "password" | "signup-name" | "signup-email" | "signup-password" | "signup-phone" | "signup-accounts" | "success";

const SOCIAL_PLATFORMS = [
  { id: "instagram", name: "Instagram", color: "#E4405F", icon: "IG" },
  { id: "youtube", name: "YouTube", color: "#FF0000", icon: "YT" },
  { id: "tiktok", name: "TikTok", color: "#69C9D0", icon: "TT" },
  { id: "twitter", name: "X / Twitter", color: "#1DA1F2", icon: "X" },
  { id: "twitch", name: "Twitch", color: "#9146FF", icon: "TW" },
  { id: "spotify", name: "Spotify", color: "#1DB954", icon: "SP" },
  { id: "soundcloud", name: "SoundCloud", color: "#FF5500", icon: "SC" },
  { id: "linkedin", name: "LinkedIn", color: "#0A66C2", icon: "LI" },
  { id: "github", name: "GitHub", color: "#8B5CF6", icon: "GH" },
  { id: "discord", name: "Discord", color: "#5865F2", icon: "DC" },
  { id: "snapchat", name: "Snapchat", color: "#FFFC00", icon: "SN" },
  { id: "pinterest", name: "Pinterest", color: "#E60023", icon: "PI" },
  { id: "reddit", name: "Reddit", color: "#FF4500", icon: "RD" },
  { id: "facebook", name: "Facebook", color: "#1877F2", icon: "FB" },
  { id: "threads", name: "Threads", color: "#ffffff", icon: "TH" },
  { id: "bluesky", name: "Bluesky", color: "#0085FF", icon: "BS" },
];

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
  const [step, setStep] = useState<AuthStep>("welcome");
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);

  // Form fields
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);

  // Track input activity for mesh background
  const [activeField, setActiveField] = useState<string | null>(null);
  const totalCharsRef = useRef(0);

  useEffect(() => {
    totalCharsRef.current = username.length + password.length + email.length + displayName.length + phone.length;
    const event = new CustomEvent("mesh-activity", {
      detail: { field: activeField, totalChars: totalCharsRef.current },
    });
    window.dispatchEvent(event);
  }, [activeField, username, password, email, displayName, phone]);

  // Auto-focus input on step change
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, [step]);

  const inputClass =
    "w-full bg-transparent border border-zinc-700/40 rounded-xl px-4 py-3.5 text-base text-zinc-100 placeholder:text-zinc-600 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/20 transition-all duration-300 text-center";

  const handleLoginUsernameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    setError("");
    setStep("password");
  };

  const handleLoginPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setError("");

    const formData = new FormData();
    formData.set("email", username.includes("@") ? username : username + "@mesh.me");
    formData.set("password", password);

    startTransition(async () => {
      const result = await signIn(formData);
      if (result?.error) {
        setError(result.error);
      }
    });
  };

  const handleSignupNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    setError("");
    setStep("signup-email");
  };

  const handleSignupEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email");
      return;
    }
    setError("");
    setStep("signup-password");
  };

  const handleSignupPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setError("");
    setStep("signup-phone");
  };

  const handleSignupPhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setStep("signup-accounts");
  };

  const handleSignupComplete = () => {
    setError("");
    setStep("success");

    const formData = new FormData();
    formData.set("email", email);
    formData.set("password", password);
    formData.set("username", username);
    formData.set("displayName", displayName);

    startTransition(async () => {
      const result = await signUp(formData);
      if (result?.error) {
        setError(result.error);
        setStep("signup-accounts");
      }
    });
  };

  const togglePlatform = (platformId: string) => {
    setConnectedPlatforms((prev) =>
      prev.includes(platformId) ? prev.filter((p) => p !== platformId) : [...prev, platformId]
    );
  };

  const goBack = () => {
    setError("");
    if (step === "password") setStep("username");
    else if (step === "signup-name") { setStep("username"); setIsLogin(false); }
    else if (step === "signup-email") setStep("signup-name");
    else if (step === "signup-password") setStep("signup-email");
    else if (step === "signup-phone") setStep("signup-password");
    else if (step === "signup-accounts") setStep("signup-phone");
    else setStep("welcome");
  };

  const startSignup = () => {
    setIsLogin(false);
    setError("");
    setStep("username");
  };

  const startLogin = () => {
    setIsLogin(true);
    setError("");
    setStep("username");
  };

  const handleUsernameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = username.trim().toLowerCase();
    if (!val) return;
    if (val.length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }
    setError("");
    if (isLogin) {
      setStep("password");
    } else {
      setStep("signup-name");
    }
  };

  // Shared motion props
  const pageMotion = {
    initial: { opacity: 0, y: 20, filter: "blur(8px)" },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
    exit: { opacity: 0, y: -20, filter: "blur(8px)" },
    transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] as const },
  };

  return (
    <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6">
      <AnimatePresence mode="wait">
        {/* Welcome */}
        {step === "welcome" && (
          <motion.div key="welcome" {...pageMotion} className="text-center max-w-lg">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-8">
              <div className="inline-flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <span className="text-white font-bold text-lg">m</span>
                </div>
                <span className="text-2xl font-bold text-zinc-100 tracking-tight">
                  mesh<span className="text-blue-400">.me</span>
                </span>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.6 }} className="relative">
              <div className="absolute inset-0 bg-blue-500/5 rounded-3xl blur-2xl" />
              <div className="relative border border-zinc-800/60 bg-zinc-950/60 backdrop-blur-xl rounded-3xl p-10">
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
                  <span className="text-zinc-100">Enter the</span>
                  <br />
                  <span className="bg-gradient-to-r from-blue-400 via-blue-300 to-cyan-400 bg-clip-text text-transparent">Mesh</span>
                </h1>
                <p className="text-zinc-500 text-sm leading-relaxed mb-8 max-w-sm mx-auto">
                  Your identity. Your people. Your space.<br />One platform for everything.
                </p>
                <div className="flex flex-col gap-3">
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={startSignup}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white px-6 py-3.5 rounded-xl text-sm font-medium shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-shadow flex items-center justify-center gap-2">
                    Create your space <ArrowRight className="h-4 w-4" />
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={startLogin}
                    className="w-full border border-zinc-800 text-zinc-400 px-6 py-3.5 rounded-xl text-sm font-medium hover:text-zinc-200 hover:border-zinc-700 hover:bg-zinc-900/50 transition-all">
                    Sign in
                  </motion.button>
                </div>
              </div>
            </motion.div>

            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="mt-8 text-xs text-zinc-700">
              Privacy-first &middot; Zero ads &middot; Community-powered
            </motion.p>
          </motion.div>
        )}

        {/* Username step (shared for login & signup) */}
        {step === "username" && (
          <motion.div key="username" {...pageMotion} className="w-full max-w-sm text-center">
            <div className="mb-8">
              <div className="inline-flex items-center gap-2 mb-6">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">m</span>
                </div>
              </div>
              <h2 className="text-2xl font-bold text-zinc-100 mb-2">
                {isLogin ? "Welcome back" : "Choose your identity"}
              </h2>
              <p className="text-sm text-zinc-500">
                {isLogin ? "Enter your username or email" : "Pick a unique username"}
              </p>
            </div>

            <div className="border border-zinc-800/50 bg-zinc-950/60 backdrop-blur-xl rounded-2xl p-6">
              <AnimatePresence mode="wait">
                {error && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                    className="mb-4 p-3 rounded-lg bg-red-500/8 border border-red-500/15 text-red-400 text-xs overflow-hidden">
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>
              <form onSubmit={handleUsernameSubmit} className="space-y-4">
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 text-sm">@</span>
                  <input
                    ref={inputRef}
                    type="text"
                    value={username}
                    placeholder={isLogin ? "username or email" : "username"}
                    autoComplete={isLogin ? "email" : "username"}
                    className={inputClass + " pl-8"}
                    onFocus={() => setActiveField("username")}
                    onBlur={() => setActiveField(null)}
                    onChange={(e) => {
                      const val = isLogin ? e.target.value : e.target.value.toLowerCase().replace(/[^a-z0-9_@.]/g, "");
                      setUsername(val);
                    }}
                  />
                </div>
                <motion.button whileTap={{ scale: 0.98 }} type="submit"
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white px-6 py-3.5 rounded-xl text-sm font-medium shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2">
                  Continue <ArrowRight className="h-4 w-4" />
                </motion.button>
              </form>
            </div>

            <div className="flex items-center justify-between mt-5">
              <button onClick={() => { setStep("welcome"); setError(""); }}
                className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors flex items-center gap-1">
                <ArrowLeft className="h-3 w-3" /> Back
              </button>
              <button onClick={() => { setIsLogin(!isLogin); setError(""); }}
                className="text-xs text-zinc-500 hover:text-blue-400 transition-colors">
                {isLogin ? "Create an account" : "Already have an account?"}
              </button>
            </div>
          </motion.div>
        )}

        {/* Password step (login) */}
        {step === "password" && (
          <motion.div key="password" {...pageMotion} className="w-full max-w-sm text-center">
            <div className="mb-8">
              <div className="inline-flex items-center gap-2 mb-6">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">m</span>
                </div>
              </div>
              <h2 className="text-2xl font-bold text-zinc-100 mb-2">Enter the Mesh</h2>
              <p className="text-sm text-zinc-500">Welcome back, <span className="text-blue-400">@{username}</span></p>
            </div>

            <div className="border border-zinc-800/50 bg-zinc-950/60 backdrop-blur-xl rounded-2xl p-6">
              <AnimatePresence mode="wait">
                {error && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                    className="mb-4 p-3 rounded-lg bg-red-500/8 border border-red-500/15 text-red-400 text-xs overflow-hidden">
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>
              <form onSubmit={handleLoginPasswordSubmit} className="space-y-4">
                <div className="relative">
                  <input
                    ref={inputRef}
                    type={showPassword ? "text" : "password"}
                    value={password}
                    placeholder="Password"
                    autoComplete="current-password"
                    className={inputClass + " pr-10"}
                    onFocus={() => setActiveField("password")}
                    onBlur={() => setActiveField(null)}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors" tabIndex={-1}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <motion.button whileTap={{ scale: 0.98 }} type="submit" disabled={isPending}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white px-6 py-3.5 rounded-xl text-sm font-medium shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2">
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><span>Sign in</span><ArrowRight className="h-4 w-4" /></>}
                </motion.button>
              </form>
            </div>

            <div className="flex items-center justify-between mt-5">
              <button onClick={goBack} className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors flex items-center gap-1">
                <ArrowLeft className="h-3 w-3" /> Back
              </button>
            </div>
          </motion.div>
        )}

        {/* Signup: Display Name */}
        {step === "signup-name" && (
          <motion.div key="signup-name" {...pageMotion} className="w-full max-w-sm text-center">
            <div className="mb-8">
              <p className="text-xs text-blue-400 mb-2">@{username}</p>
              <h2 className="text-2xl font-bold text-zinc-100 mb-2">What should we call you?</h2>
              <p className="text-sm text-zinc-500">Your display name</p>
            </div>
            <div className="border border-zinc-800/50 bg-zinc-950/60 backdrop-blur-xl rounded-2xl p-6">
              <AnimatePresence mode="wait">
                {error && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                    className="mb-4 p-3 rounded-lg bg-red-500/8 border border-red-500/15 text-red-400 text-xs overflow-hidden">{error}</motion.div>
                )}
              </AnimatePresence>
              <form onSubmit={handleSignupNameSubmit} className="space-y-4">
                <input ref={inputRef} type="text" value={displayName} placeholder="Your name"
                  autoComplete="name" className={inputClass}
                  onFocus={() => setActiveField("displayName")} onBlur={() => setActiveField(null)}
                  onChange={(e) => setDisplayName(e.target.value)} />
                <motion.button whileTap={{ scale: 0.98 }} type="submit"
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white px-6 py-3.5 rounded-xl text-sm font-medium shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2">
                  Continue <ArrowRight className="h-4 w-4" />
                </motion.button>
              </form>
            </div>
            <div className="mt-5"><button onClick={goBack} className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors flex items-center gap-1"><ArrowLeft className="h-3 w-3" /> Back</button></div>
          </motion.div>
        )}

        {/* Signup: Email */}
        {step === "signup-email" && (
          <motion.div key="signup-email" {...pageMotion} className="w-full max-w-sm text-center">
            <div className="mb-8">
              <p className="text-xs text-blue-400 mb-2">@{username} &middot; {displayName}</p>
              <h2 className="text-2xl font-bold text-zinc-100 mb-2">Your email</h2>
              <p className="text-sm text-zinc-500">We will never share it or spam you</p>
            </div>
            <div className="border border-zinc-800/50 bg-zinc-950/60 backdrop-blur-xl rounded-2xl p-6">
              <AnimatePresence mode="wait">
                {error && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                    className="mb-4 p-3 rounded-lg bg-red-500/8 border border-red-500/15 text-red-400 text-xs overflow-hidden">{error}</motion.div>
                )}
              </AnimatePresence>
              <form onSubmit={handleSignupEmailSubmit} className="space-y-4">
                <input ref={inputRef} type="email" value={email} placeholder="you@example.com"
                  autoComplete="email" className={inputClass}
                  onFocus={() => setActiveField("email")} onBlur={() => setActiveField(null)}
                  onChange={(e) => setEmail(e.target.value)} />
                <motion.button whileTap={{ scale: 0.98 }} type="submit"
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white px-6 py-3.5 rounded-xl text-sm font-medium shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2">
                  Continue <ArrowRight className="h-4 w-4" />
                </motion.button>
              </form>
            </div>
            <div className="mt-5"><button onClick={goBack} className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors flex items-center gap-1"><ArrowLeft className="h-3 w-3" /> Back</button></div>
          </motion.div>
        )}

        {/* Signup: Password */}
        {step === "signup-password" && (
          <motion.div key="signup-password" {...pageMotion} className="w-full max-w-sm text-center">
            <div className="mb-8">
              <p className="text-xs text-blue-400 mb-2">@{username} &middot; {displayName}</p>
              <h2 className="text-2xl font-bold text-zinc-100 mb-2">Secure your mesh</h2>
              <p className="text-sm text-zinc-500">Choose a strong password</p>
            </div>
            <div className="border border-zinc-800/50 bg-zinc-950/60 backdrop-blur-xl rounded-2xl p-6">
              <AnimatePresence mode="wait">
                {error && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                    className="mb-4 p-3 rounded-lg bg-red-500/8 border border-red-500/15 text-red-400 text-xs overflow-hidden">{error}</motion.div>
                )}
              </AnimatePresence>
              <form onSubmit={handleSignupPasswordSubmit} className="space-y-4">
                <div className="relative">
                  <input ref={inputRef} type={showPassword ? "text" : "password"} value={password}
                    placeholder="At least 8 characters" autoComplete="new-password"
                    className={inputClass + " pr-10"} minLength={8}
                    onFocus={() => setActiveField("password")} onBlur={() => setActiveField(null)}
                    onChange={(e) => setPassword(e.target.value)} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors" tabIndex={-1}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {password && <PasswordStrength password={password} />}
                <motion.button whileTap={{ scale: 0.98 }} type="submit"
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white px-6 py-3.5 rounded-xl text-sm font-medium shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2">
                  Continue <ArrowRight className="h-4 w-4" />
                </motion.button>
              </form>
            </div>
            <div className="mt-5"><button onClick={goBack} className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors flex items-center gap-1"><ArrowLeft className="h-3 w-3" /> Back</button></div>
          </motion.div>
        )}

        {/* Signup: Phone verification */}
        {step === "signup-phone" && (
          <motion.div key="signup-phone" {...pageMotion} className="w-full max-w-sm text-center">
            <div className="mb-8">
              <div className="h-12 w-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-4">
                <Phone className="h-6 w-6 text-blue-400" />
              </div>
              <h2 className="text-2xl font-bold text-zinc-100 mb-2">Verify your number</h2>
              <p className="text-sm text-zinc-500">For account security and recovery</p>
            </div>
            <div className="border border-zinc-800/50 bg-zinc-950/60 backdrop-blur-xl rounded-2xl p-6">
              <form onSubmit={handleSignupPhoneSubmit} className="space-y-4">
                <input ref={inputRef} type="tel" value={phone} placeholder="+1 (555) 000-0000"
                  autoComplete="tel" className={inputClass}
                  onFocus={() => setActiveField("phone")} onBlur={() => setActiveField(null)}
                  onChange={(e) => setPhone(e.target.value)} />
                <motion.button whileTap={{ scale: 0.98 }} type="submit"
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white px-6 py-3.5 rounded-xl text-sm font-medium shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2">
                  {phone ? "Verify & Continue" : "Skip for now"} <ArrowRight className="h-4 w-4" />
                </motion.button>
              </form>
              {!phone && <p className="text-[10px] text-zinc-600 mt-3">You can add this later in settings</p>}
            </div>
            <div className="mt-5"><button onClick={goBack} className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors flex items-center gap-1"><ArrowLeft className="h-3 w-3" /> Back</button></div>
          </motion.div>
        )}

        {/* Signup: Connect social accounts */}
        {step === "signup-accounts" && (
          <motion.div key="signup-accounts" {...pageMotion} className="w-full max-w-md text-center">
            <div className="mb-6">
              <div className="h-12 w-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-4">
                <Link2 className="h-6 w-6 text-blue-400" />
              </div>
              <h2 className="text-2xl font-bold text-zinc-100 mb-2">Connect your world</h2>
              <p className="text-sm text-zinc-500">Link your social accounts for the full mesh experience</p>
            </div>
            <div className="border border-zinc-800/50 bg-zinc-950/60 backdrop-blur-xl rounded-2xl p-6">
              <AnimatePresence mode="wait">
                {error && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                    className="mb-4 p-3 rounded-lg bg-red-500/8 border border-red-500/15 text-red-400 text-xs overflow-hidden">{error}</motion.div>
                )}
              </AnimatePresence>
              <div className="grid grid-cols-4 gap-2 mb-6">
                {SOCIAL_PLATFORMS.map((platform) => {
                  const isConnected = connectedPlatforms.includes(platform.id);
                  return (
                    <motion.button
                      key={platform.id}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => togglePlatform(platform.id)}
                      className={`relative flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all ${
                        isConnected
                          ? "border-blue-500/40 bg-blue-500/10"
                          : "border-zinc-800/50 bg-zinc-900/30 hover:border-zinc-700"
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                        style={{ backgroundColor: platform.color + "20", color: platform.color }}>
                        {platform.icon}
                      </div>
                      <span className="text-[9px] text-zinc-500 truncate w-full">{platform.name}</span>
                      {isConnected && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
                          <Check className="h-2.5 w-2.5 text-white" />
                        </div>
                      )}
                    </motion.button>
                  );
                })}
              </div>
              {connectedPlatforms.length > 0 && (
                <p className="text-xs text-zinc-500 mb-4">{connectedPlatforms.length} platform{connectedPlatforms.length !== 1 ? "s" : ""} selected</p>
              )}
              <motion.button whileTap={{ scale: 0.98 }} onClick={handleSignupComplete} disabled={isPending}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white px-6 py-3.5 rounded-xl text-sm font-medium shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2">
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><span>{connectedPlatforms.length > 0 ? "Enter the Mesh" : "Skip & Enter the Mesh"}</span><ArrowRight className="h-4 w-4" /></>}
              </motion.button>
              <p className="text-[10px] text-zinc-600 mt-3">You can connect accounts anytime in settings</p>
            </div>
            <div className="mt-5"><button onClick={goBack} className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors flex items-center gap-1"><ArrowLeft className="h-3 w-3" /> Back</button></div>
          </motion.div>
        )}

        {/* Success animation */}
        {step === "success" && (
          <motion.div key="success" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }} className="text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.2, 1] }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-blue-500/30"
            >
              <motion.div initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.6 }}>
                <Check className="h-10 w-10 text-white" />
              </motion.div>
            </motion.div>
            <motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}
              className="text-2xl font-bold text-zinc-100 mb-2">Welcome to the Mesh</motion.h2>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.0 }}
              className="text-sm text-zinc-500">Setting up your digital universe...</motion.p>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}
              className="mt-4"><Loader2 className="h-5 w-5 animate-spin text-blue-400 mx-auto" /></motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
