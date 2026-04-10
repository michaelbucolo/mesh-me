"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Loader2, ArrowRight, ArrowLeft, Check, Phone, Link2, Shield, Lock, Database, Fingerprint } from "lucide-react";
import { signUp, signIn } from "@/lib/actions";
import { MeshiMascot } from "@/components/meshi/meshi-mascot";

type AuthStep =
  | "welcome"
  | "username"
  | "password"
  | "signup-name"
  | "signup-email"
  | "signup-privacy"
  | "signup-password"
  | "signup-phone"
  | "signup-accounts"
  | "success";

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

const DATA_TRANSPARENCY = [
  {
    icon: Fingerprint,
    title: "What we store",
    items: [
      "Your username, display name & email (to identify your account)",
      "Your password (encrypted with bcrypt — we can never see it)",
      "Your bio, interests & avatar (so others can find you)",
      "Posts, messages & interactions you create on mesh.me",
    ],
  },
  {
    icon: Shield,
    title: "What we never do",
    items: [
      "Sell your data to advertisers — ever",
      "Show you ads — mesh.me is 100% ad-free",
      "Share your information with third parties",
      "Track you across other websites",
    ],
  },
  {
    icon: Lock,
    title: "How we protect you",
    items: [
      "End-to-end encryption for messages",
      "Passwords hashed with bcrypt (industry standard)",
      "Rate limiting & account lockout against brute force",
      "You can delete your account & all data at any time",
    ],
  },
  {
    icon: Database,
    title: "Connected accounts",
    items: [
      "We only store platform connection tokens (not passwords)",
      "You control which platforms are linked",
      "Revoke access to any platform instantly",
      "Cross-platform data stays on those platforms",
    ],
  },
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
              i <= score ? colors[score] : "bg-[var(--bg-tertiary)]"
            }`}
          />
        ))}
      </div>
      {score > 0 && <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{labels[score]} password</p>}
    </div>
  );
}

export function MeshEntry() {
  const [step, setStep] = useState<AuthStep>("welcome");
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const meshiRef = useRef<HTMLDivElement>(null);
  const [activeField, setActiveField] = useState<string | null>(null);
  const totalCharsRef = useRef(0);
  const [meshiMood, setMeshiMood] = useState<"happy" | "excited" | "thinking" | "love" | "wink" | "sleepy">("happy");
  const [meshiSpeech, setMeshiSpeech] = useState("");
  const meshiSpeechTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Meshi reacts to what the user is doing
  const showMeshiSpeech = (text: string, mood: typeof meshiMood = "happy", duration = 3000) => {
    setMeshiSpeech(text);
    setMeshiMood(mood);
    if (meshiSpeechTimer.current) clearTimeout(meshiSpeechTimer.current);
    meshiSpeechTimer.current = setTimeout(() => setMeshiSpeech(""), duration);
  };

  useEffect(() => { return () => { if (meshiSpeechTimer.current) clearTimeout(meshiSpeechTimer.current); }; }, []);

  useEffect(() => {
    totalCharsRef.current = username.length + password.length + email.length + displayName.length + phone.length;
    // Get Meshi logo position so the canvas can draw connections to it
    let meshiPos: { x: number; y: number } | null = null;
    if (meshiRef.current) {
      const rect = meshiRef.current.getBoundingClientRect();
      meshiPos = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
    const event = new CustomEvent("mesh-activity", {
      detail: { field: activeField, totalChars: totalCharsRef.current, meshiPos },
    });
    window.dispatchEvent(event);
  }, [activeField, username, password, email, displayName, phone, step]);

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, [step]);

  const inputClass =
    "w-full bg-transparent rounded-xl px-4 py-3.5 text-base placeholder:opacity-40 focus:outline-none focus:ring-1 focus:ring-[var(--accent-muted)] transition-all duration-300 text-center";

  const cardClass = "rounded-2xl p-6 md:p-8 backdrop-blur-xl";

  const handleLoginPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setError("");
    showMeshiSpeech("Verifying your identity...", "thinking", 10000);
    const formData = new FormData();
    formData.set("email", username);
    formData.set("password", password);
    startTransition(async () => {
      // Fire converge animation — stars collapse toward Meshi
      window.dispatchEvent(new CustomEvent("mesh-converge"));
      const result = await signIn(formData);
      if (result?.error) {
        setError(result.error);
        showMeshiSpeech("Hmm, that doesn't seem right. Try again?", "thinking", 4000);
      }
      // On success, signIn redirects — the converge animation plays during the redirect
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
    setStep("signup-privacy");
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
    else if (step === "signup-privacy") setStep("signup-email");
    else if (step === "signup-password") setStep("signup-privacy");
    else if (step === "signup-phone") setStep("signup-password");
    else if (step === "signup-accounts") setStep("signup-phone");
    else setStep("welcome");
  };

  const startSignup = () => { setIsLogin(false); setError(""); setStep("username"); showMeshiSpeech("Let's get you set up!", "excited"); };
  const startLogin = () => { setIsLogin(true); setError(""); setStep("username"); showMeshiSpeech("Welcome back! Enter your username.", "happy"); };

  const handleUsernameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = username.trim().toLowerCase();
    if (!val) return;
    if (val.length < 3) { setError("Username must be at least 3 characters"); return; }
    setError("");
    if (isLogin) {
      showMeshiSpeech(`Hey @${val}! Enter your password to unlock your mesh.`, "wink", 5000);
      setStep("password");
    } else {
      showMeshiSpeech(`Nice choice, @${val}!`, "love");
      setStep("signup-name");
    }
  };

  const signupSteps: AuthStep[] = ["username", "signup-name", "signup-email", "signup-privacy", "signup-password", "signup-phone", "signup-accounts"];
  const currentStepIndex = signupSteps.indexOf(step);
  const progress = !isLogin && currentStepIndex >= 0 ? ((currentStepIndex + 1) / signupSteps.length) * 100 : 0;

  const pageMotion = {
    initial: { opacity: 0, y: 20, filter: "blur(8px)" },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
    exit: { opacity: 0, y: -20, filter: "blur(8px)" },
    transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] as const },
  };

  const errorBanner = error ? (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
      className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs overflow-hidden">
      {error}
    </motion.div>
  ) : null;

  const renderBackButton = (onClick?: () => void) => (
    <button onClick={onClick || goBack}
      className="text-xs hover:opacity-80 transition-opacity flex items-center gap-1"
      style={{ color: "var(--text-muted)" }}>
      <ArrowLeft className="h-3 w-3" /> Back
    </button>
  );

  return (
    <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 sm:px-6">
      {/* Signup progress bar */}
      {!isLogin && currentStepIndex >= 0 && step !== "success" && (
        <div className="fixed top-0 left-0 right-0 z-30 h-1" style={{ background: "var(--bg-tertiary)" }}>
          <motion.div className="h-full" style={{ background: "var(--brand-gradient)" }}
            initial={{ width: 0 }} animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }} />
        </div>
      )}

      <AnimatePresence mode="wait">
        {/* Welcome */}
        {step === "welcome" && (
          <motion.div key="welcome" {...pageMotion} className="text-center max-w-lg w-full">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-10">
              <div className="inline-flex flex-col items-center gap-3">
                <div ref={meshiRef}>
                  <MeshiMascot size={64} mood={meshiMood} color="blue" interactive animate speaking={!!meshiSpeech} />
                </div>
                <span className="brand-wordmark text-2xl" style={{ color: "var(--text-primary)" }}>
                  mesh<span className="brand-wordmark-accent">.me</span>
                </span>
                {meshiSpeech && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="px-4 py-2 rounded-2xl text-xs max-w-[260px] text-center shadow-lg"
                    style={{ background: "var(--bg-elevated)", color: "var(--text-primary)", border: "1px solid var(--border-primary)" }}
                  >
                    {meshiSpeech}
                  </motion.div>
                )}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.6 }} className="relative">
              <div className="absolute inset-0 rounded-3xl blur-2xl" style={{ background: "var(--accent-subtle)" }} />
              <div className={cardClass} style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)" }}>
                <h1 className="font-display text-4xl md:text-5xl font-extrabold tracking-tight mb-4" style={{ letterSpacing: "-0.035em" }}>
                  <span style={{ color: "var(--text-primary)" }}>Enter the</span>
                  <br />
                  <span className="gradient-text">Mesh</span>
                </h1>
                <p className="text-sm leading-relaxed mb-4 max-w-xs mx-auto" style={{ color: "var(--text-tertiary)" }}>
                  One internet. One you.
                </p>
                <div className="flex items-center justify-center gap-5 mb-8 text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
                  <span className="flex items-center gap-1.5"><Shield className="h-3 w-3" style={{ color: "var(--accent)" }} /> Private by design</span>
                  <span className="flex items-center gap-1.5"><Lock className="h-3 w-3" style={{ color: "var(--accent)" }} /> Forever ad-free</span>
                  <span className="flex items-center gap-1.5"><Database className="h-3 w-3" style={{ color: "var(--accent)" }} /> Your data, always</span>
                </div>
                <div className="flex flex-col gap-3">
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={startSignup}
                    className="brand-button w-full text-white px-6 py-3.5 rounded-xl text-sm font-semibold shadow-lg flex items-center justify-center gap-2">
                    Join the Mesh <ArrowRight className="h-4 w-4" />
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={startLogin}
                    className="w-full px-6 py-3.5 rounded-xl text-sm font-medium transition-all flex items-center justify-center"
                    style={{ border: "1px solid var(--border-primary)", color: "var(--text-secondary)" }}>
                    Sign in
                  </motion.button>
                </div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
              className="mt-6 flex items-center justify-center gap-4 text-xs" style={{ color: "var(--text-muted)" }}>
              <a href="/terms" className="hover:opacity-80 transition-opacity">Terms</a>
              <span>·</span>
              <a href="/privacy" className="hover:opacity-80 transition-opacity">Privacy</a>
              <span>·</span>
              <span>Built for humans</span>
            </motion.div>
          </motion.div>
        )}

        {/* Username */}
        {step === "username" && (
          <motion.div key="username" {...pageMotion} className="w-full max-w-sm text-center">
            <div className="mb-8">
              <div ref={meshiRef} className="inline-flex flex-col items-center gap-2 mb-4">
                <MeshiMascot size={48} mood={meshiMood} color="blue" interactive animate speaking={!!meshiSpeech} />
                {meshiSpeech && (
                  <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                    className="px-3 py-1.5 rounded-xl text-[11px] max-w-[220px] text-center shadow-md"
                    style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border-primary)" }}>
                    {meshiSpeech}
                  </motion.div>
                )}
              </div>
              <h2 className="font-display text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
                {isLogin ? "Welcome back" : "Claim your identity"}
              </h2>
              <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
                {isLogin ? "Enter your username or email" : "This is you on the mesh — make it yours"}
              </p>
            </div>
            <div className={cardClass} style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)" }}>
              <AnimatePresence mode="wait">{errorBanner}</AnimatePresence>
              <form onSubmit={handleUsernameSubmit} className="space-y-4">
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm" style={{ color: "var(--text-muted)" }}>@</span>
                  <input ref={inputRef} type="text" value={username}
                    placeholder={isLogin ? "username or email" : "username"}
                    autoComplete={isLogin ? "email" : "username"}
                    minLength={3}
                    maxLength={30}
                    className={inputClass + " pl-8"}
                    style={{ border: "1px solid var(--border-primary)", color: "var(--text-primary)" }}
                    onFocus={() => setActiveField("username")} onBlur={() => setActiveField(null)}
                    onChange={(e) => {
                      const val = isLogin ? e.target.value : e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "");
                      setUsername(val);
                    }} />
                </div>
                {!isLogin && username.length > 0 && username.length < 3 && (
                  <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>At least 3 characters required</p>
                )}
                <motion.button whileTap={{ scale: 0.98 }} type="submit"
                  className="brand-button w-full text-white px-6 py-3.5 rounded-xl text-sm font-semibold shadow-lg flex items-center justify-center gap-2">
                  Continue <ArrowRight className="h-4 w-4" />
                </motion.button>
              </form>
            </div>
            <div className="flex items-center justify-between mt-5 px-1">
              {renderBackButton(() => { setStep("welcome"); setError(""); })}
              <button onClick={() => { setIsLogin(!isLogin); setError(""); }}
                className="text-xs transition-colors" style={{ color: "var(--text-tertiary)" }}>
                {isLogin ? "Create an account" : "Already have an account?"}
              </button>
            </div>
          </motion.div>
        )}

        {/* Password (login) */}
        {step === "password" && (
          <motion.div key="password" {...pageMotion} className="w-full max-w-sm text-center">
            <div className="mb-8">
              <div ref={meshiRef} className="inline-flex flex-col items-center gap-2 mb-4">
                <MeshiMascot size={56} mood={meshiMood} color="blue" interactive animate speaking={!!meshiSpeech} />
                {meshiSpeech && (
                  <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                    className="px-3 py-1.5 rounded-xl text-[11px] max-w-[220px] text-center shadow-md"
                    style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border-primary)" }}>
                    {meshiSpeech}
                  </motion.div>
                )}
              </div>
              <h2 className="font-display text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Enter the Mesh</h2>
              <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>Welcome back, <span style={{ color: "var(--accent)" }}>@{username}</span></p>
            </div>
            <div className={cardClass} style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)" }}>
              <AnimatePresence mode="wait">{errorBanner}</AnimatePresence>
              <form onSubmit={handleLoginPasswordSubmit} className="space-y-4">
                <div className="relative">
                  <input ref={inputRef} type={showPassword ? "text" : "password"} value={password}
                    placeholder="Password" autoComplete="current-password"
                    className={inputClass + " pr-10"}
                    style={{ border: "1px solid var(--border-primary)", color: "var(--text-primary)" }}
                    onFocus={() => setActiveField("password")} onBlur={() => setActiveField(null)}
                    onChange={(e) => setPassword(e.target.value)} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors" tabIndex={-1}
                    style={{ color: "var(--text-muted)" }}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <motion.button whileTap={{ scale: 0.98 }} type="submit" disabled={isPending}
                  className="brand-button w-full text-white px-6 py-3.5 rounded-xl text-sm font-semibold shadow-lg disabled:opacity-50 flex items-center justify-center gap-2">
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><span>Sign in</span><ArrowRight className="h-4 w-4" /></>}
                </motion.button>
              </form>
            </div>
            <div className="mt-5 px-1">{renderBackButton()}</div>
          </motion.div>
        )}

        {/* Signup: Name */}
        {step === "signup-name" && (
          <motion.div key="signup-name" {...pageMotion} className="w-full max-w-sm text-center">
            <div className="mb-8">
              <p className="text-xs mb-2" style={{ color: "var(--accent)" }}>@{username}</p>
              <h2 className="font-display text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>What should we call you?</h2>
              <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>The name people will see — you can change it anytime</p>
            </div>
            <div className={cardClass} style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)" }}>
              <AnimatePresence mode="wait">{errorBanner}</AnimatePresence>
              <form onSubmit={handleSignupNameSubmit} className="space-y-4">
                <input ref={inputRef} type="text" value={displayName} placeholder="Your name"
                  autoComplete="name" className={inputClass}
                  style={{ border: "1px solid var(--border-primary)", color: "var(--text-primary)" }}
                  onFocus={() => setActiveField("displayName")} onBlur={() => setActiveField(null)}
                  onChange={(e) => setDisplayName(e.target.value)} />
                <motion.button whileTap={{ scale: 0.98 }} type="submit"
                  className="brand-button w-full text-white px-6 py-3.5 rounded-xl text-sm font-semibold shadow-lg flex items-center justify-center gap-2">
                  Continue <ArrowRight className="h-4 w-4" />
                </motion.button>
              </form>
            </div>
            <div className="mt-5 px-1">{renderBackButton()}</div>
          </motion.div>
        )}

        {/* Signup: Email */}
        {step === "signup-email" && (
          <motion.div key="signup-email" {...pageMotion} className="w-full max-w-sm text-center">
            <div className="mb-8">
              <p className="text-xs mb-2" style={{ color: "var(--accent)" }}>@{username} · {displayName}</p>
              <h2 className="font-display text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Your email</h2>
              <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>For account recovery only — we will never spam you</p>
            </div>
            <div className={cardClass} style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)" }}>
              <AnimatePresence mode="wait">{errorBanner}</AnimatePresence>
              <form onSubmit={handleSignupEmailSubmit} className="space-y-4">
                <input ref={inputRef} type="email" value={email} placeholder="you@example.com"
                  autoComplete="email" className={inputClass}
                  style={{ border: "1px solid var(--border-primary)", color: "var(--text-primary)" }}
                  onFocus={() => setActiveField("email")} onBlur={() => setActiveField(null)}
                  onChange={(e) => setEmail(e.target.value)} />
                <motion.button whileTap={{ scale: 0.98 }} type="submit"
                  className="brand-button w-full text-white px-6 py-3.5 rounded-xl text-sm font-semibold shadow-lg flex items-center justify-center gap-2">
                  Continue <ArrowRight className="h-4 w-4" />
                </motion.button>
              </form>
            </div>
            <div className="mt-5 px-1">{renderBackButton()}</div>
          </motion.div>
        )}

        {/* Signup: Privacy & Transparency */}
        {step === "signup-privacy" && (
          <motion.div key="signup-privacy" {...pageMotion} className="w-full max-w-md text-center">
            <div className="mb-6">
              <div className="h-12 w-12 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "var(--accent-muted)", border: "1px solid var(--border-focus)" }}>
                <Shield className="h-6 w-6" style={{ color: "var(--accent)" }} />
              </div>
              <h2 className="font-display text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Transparency first</h2>
              <p className="text-sm max-w-sm mx-auto" style={{ color: "var(--text-tertiary)" }}>
                Here is exactly what we store and why. No fine print, no surprises.
              </p>
            </div>

            <div className={cardClass + " text-left"} style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)" }}>
              <div className="space-y-5 mb-6">
                {DATA_TRANSPARENCY.map((section, idx) => (
                  <motion.div key={section.title}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 * idx }}>
                    <div className="flex items-center gap-2 mb-2">
                      <section.icon className="h-4 w-4 flex-shrink-0" style={{ color: "var(--accent)" }} />
                      <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{section.title}</h3>
                    </div>
                    <ul className="space-y-1.5 pl-6">
                      {section.items.map((item) => (
                        <li key={item} className="text-xs leading-relaxed flex items-start gap-2" style={{ color: "var(--text-secondary)" }}>
                          <span className="mt-0.5 flex-shrink-0" style={{ color: "var(--accent)" }}>•</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                ))}
              </div>

              <div className="p-3 rounded-xl mb-4 text-xs leading-relaxed" style={{ background: "var(--accent-subtle)", color: "var(--text-secondary)", border: "1px solid var(--border-focus)" }}>
                <strong style={{ color: "var(--accent)" }}>mesh.me promise:</strong> We will never sell your data, never show you ads, and you can delete everything at any time. Read our full{" "}
                <a href="/privacy" style={{ color: "var(--accent)" }} className="underline hover:no-underline">Privacy Policy</a> and{" "}
                <a href="/terms" style={{ color: "var(--accent)" }} className="underline hover:no-underline">Terms of Service</a>.
              </div>

              <motion.button whileTap={{ scale: 0.98 }} onClick={() => setStep("signup-password")}
                className="brand-button w-full text-white px-6 py-3.5 rounded-xl text-sm font-semibold shadow-lg flex items-center justify-center gap-2">
                I understand, continue <ArrowRight className="h-4 w-4" />
              </motion.button>
            </div>
            <div className="mt-5 px-1">{renderBackButton()}</div>
          </motion.div>
        )}

        {/* Signup: Password */}
        {step === "signup-password" && (
          <motion.div key="signup-password" {...pageMotion} className="w-full max-w-sm text-center">
            <div className="mb-8">
              <p className="text-xs mb-2" style={{ color: "var(--accent)" }}>@{username} · {displayName}</p>
              <h2 className="font-display text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Lock it down</h2>
              <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>Choose a strong password — encrypted end-to-end, invisible to us</p>
            </div>
            <div className={cardClass} style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)" }}>
              <AnimatePresence mode="wait">{errorBanner}</AnimatePresence>
              <form onSubmit={handleSignupPasswordSubmit} className="space-y-4">
                <div className="relative">
                  <input ref={inputRef} type={showPassword ? "text" : "password"} value={password}
                    placeholder="At least 8 characters" autoComplete="new-password"
                    className={inputClass + " pr-10"} minLength={8}
                    style={{ border: "1px solid var(--border-primary)", color: "var(--text-primary)" }}
                    onFocus={() => setActiveField("password")} onBlur={() => setActiveField(null)}
                    onChange={(e) => setPassword(e.target.value)} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors" tabIndex={-1}
                    style={{ color: "var(--text-muted)" }}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {password && <PasswordStrength password={password} />}
                <motion.button whileTap={{ scale: 0.98 }} type="submit"
                  className="brand-button w-full text-white px-6 py-3.5 rounded-xl text-sm font-semibold shadow-lg flex items-center justify-center gap-2">
                  Continue <ArrowRight className="h-4 w-4" />
                </motion.button>
              </form>
            </div>
            <div className="mt-5 px-1">{renderBackButton()}</div>
          </motion.div>
        )}

        {/* Signup: Phone */}
        {step === "signup-phone" && (
          <motion.div key="signup-phone" {...pageMotion} className="w-full max-w-sm text-center">
            <div className="mb-8">
              <div className="h-12 w-12 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "var(--accent-muted)", border: "1px solid var(--border-focus)" }}>
                <Phone className="h-6 w-6" style={{ color: "var(--accent)" }} />
              </div>
              <h2 className="font-display text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Add a safety net</h2>
              <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>For account recovery — never shared, never sold</p>
            </div>
            <div className={cardClass} style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)" }}>
              <form onSubmit={handleSignupPhoneSubmit} className="space-y-4">
                <input ref={inputRef} type="tel" value={phone} placeholder="+1 (555) 000-0000"
                  autoComplete="tel" className={inputClass}
                  style={{ border: "1px solid var(--border-primary)", color: "var(--text-primary)" }}
                  onFocus={() => setActiveField("phone")} onBlur={() => setActiveField(null)}
                  onChange={(e) => setPhone(e.target.value)} />
                <motion.button whileTap={{ scale: 0.98 }} type="submit"
                  className="brand-button w-full text-white px-6 py-3.5 rounded-xl text-sm font-semibold shadow-lg flex items-center justify-center gap-2">
                  {phone ? "Verify & Continue" : "Skip for now"} <ArrowRight className="h-4 w-4" />
                </motion.button>
              </form>
              {!phone && <p className="text-[10px] mt-3" style={{ color: "var(--text-muted)" }}>You can add this later in settings</p>}
            </div>
            <div className="mt-5 px-1">{renderBackButton()}</div>
          </motion.div>
        )}

        {/* Signup: Connect Accounts */}
        {step === "signup-accounts" && (
          <motion.div key="signup-accounts" {...pageMotion} className="w-full max-w-md text-center">
            <div className="mb-6">
              <div className="h-12 w-12 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "var(--accent-muted)", border: "1px solid var(--border-focus)" }}>
                <Link2 className="h-6 w-6" style={{ color: "var(--accent)" }} />
              </div>
              <h2 className="font-display text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Bring your world in</h2>
              <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>Link your platforms — one mesh to rule them all</p>
            </div>
            <div className={cardClass} style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)" }}>
              <AnimatePresence mode="wait">{errorBanner}</AnimatePresence>
              <div className="grid grid-cols-4 gap-2 mb-6">
                {SOCIAL_PLATFORMS.map((platform) => {
                  const isConnected = connectedPlatforms.includes(platform.id);
                  return (
                    <motion.button key={platform.id} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                      onClick={() => togglePlatform(platform.id)}
                      className="relative flex flex-col items-center gap-1 p-2.5 rounded-xl transition-all"
                      style={{
                        border: isConnected ? "1px solid var(--border-focus)" : "1px solid var(--border-secondary)",
                        background: isConnected ? "var(--accent-muted)" : "var(--bg-hover)",
                      }}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                        style={{ backgroundColor: platform.color + "20", color: platform.color }}>
                        {platform.icon}
                      </div>
                      <span className="text-[9px] truncate w-full" style={{ color: "var(--text-tertiary)" }}>{platform.name}</span>
                      {isConnected && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: "var(--accent)" }}>
                          <Check className="h-2.5 w-2.5 text-white" />
                        </div>
                      )}
                    </motion.button>
                  );
                })}
              </div>

              <div className="p-3 rounded-lg mb-4 text-xs text-left" style={{ background: "var(--accent-subtle)", color: "var(--text-secondary)" }}>
                <Shield className="h-3.5 w-3.5 inline mr-1" style={{ color: "var(--accent)" }} />
                We only store connection tokens — never your passwords. You can disconnect any platform at any time.
              </div>

              {connectedPlatforms.length > 0 && (
                <p className="text-xs mb-4" style={{ color: "var(--text-tertiary)" }}>{connectedPlatforms.length} platform{connectedPlatforms.length !== 1 ? "s" : ""} selected</p>
              )}
              <motion.button whileTap={{ scale: 0.98 }} onClick={handleSignupComplete} disabled={isPending}
                className="brand-button w-full text-white px-6 py-3.5 rounded-xl text-sm font-semibold shadow-lg disabled:opacity-50 flex items-center justify-center gap-2">
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><span>{connectedPlatforms.length > 0 ? "Enter the Mesh" : "Skip & Enter the Mesh"}</span><ArrowRight className="h-4 w-4" /></>}
              </motion.button>
              <p className="text-[10px] mt-3" style={{ color: "var(--text-muted)" }}>You can connect accounts anytime in settings</p>
            </div>
            <div className="mt-5 px-1">{renderBackButton()}</div>
          </motion.div>
        )}

        {/* Success */}
        {step === "success" && (
          <motion.div key="success" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }} className="text-center">
            <motion.div initial={{ scale: 0 }} animate={{ scale: [0, 1.2, 1] }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl" style={{ background: "var(--brand-gradient)" }}>
              <motion.div initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.6 }}>
                <Check className="h-10 w-10 text-white" />
              </motion.div>
            </motion.div>
            <motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}
              className="font-display text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>You&apos;re in.</motion.h2>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.0 }}
              className="text-sm" style={{ color: "var(--text-tertiary)" }}>Building your mesh...</motion.p>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}
              className="mt-4"><Loader2 className="h-5 w-5 animate-spin mx-auto" style={{ color: "var(--accent)" }} /></motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
