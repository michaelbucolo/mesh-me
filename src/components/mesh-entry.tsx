"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Loader2, ArrowRight, ArrowLeft, Check, Phone, Link2, Shield, Lock, Fingerprint } from "lucide-react";
import { signUp, signIn } from "@/lib/actions";
import { MeshiMascot, type MeshiMood } from "@/components/meshi/meshi-mascot";

// Simple 4-step signup: username+password → email → phone → connect platforms
// Login: username → password → done
type AuthStep =
  | "welcome"
  | "credentials" // username + password combined (signup) or username (login)
  | "login-password"
  | "email"
  | "phone"
  | "connect"
  | "creating";

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

function MeshiWithSpeech({ size = 56, meshiRef, meshiMood, meshiSpeech }: {
  size?: number;
  meshiRef: React.RefObject<HTMLDivElement | null>;
  meshiMood: MeshiMood;
  meshiSpeech: string;
}) {
  return (
    <div ref={meshiRef} className="inline-flex flex-col items-center gap-2 mb-4">
      <MeshiMascot size={size} mood={meshiMood} color="blue" interactive animate speaking={!!meshiSpeech} bouncy />
      <AnimatePresence>
        {meshiSpeech && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.95 }}
            className="px-4 py-2 rounded-2xl text-xs max-w-[260px] text-center shadow-lg"
            style={{ background: "var(--bg-elevated)", color: "var(--text-primary)", border: "1px solid var(--border-primary)" }}
          >
            {meshiSpeech}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="text-xs hover:opacity-80 transition-opacity flex items-center gap-1"
      style={{ color: "var(--text-muted)" }}>
      <ArrowLeft className="h-3 w-3" /> Back
    </button>
  );
}

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
          <div key={i} className={`h-0.5 flex-1 rounded-full transition-all duration-500 ${i <= score ? colors[score] : "bg-[var(--bg-tertiary)]"}`} />
        ))}
      </div>
      {score > 0 && <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{labels[score]} password</p>}
    </div>
  );
}

export function MeshEntry() {
  const [step, setStep] = useState<AuthStep>("welcome");
  const [isLogin, setIsLogin] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [phoneSent, setPhoneSent] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const meshiRef = useRef<HTMLDivElement>(null);
  const [meshiMood, setMeshiMood] = useState<"happy" | "excited" | "thinking" | "love" | "wink" | "sleepy">("happy");
  const [meshiSpeech, setMeshiSpeech] = useState("");
  const meshiSpeechTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showMeshiSpeech = (text: string, mood: typeof meshiMood = "happy", duration = 3000) => {
    setMeshiSpeech(text);
    setMeshiMood(mood);
    if (meshiSpeechTimer.current) clearTimeout(meshiSpeechTimer.current);
    meshiSpeechTimer.current = setTimeout(() => setMeshiSpeech(""), duration);
  };

  useEffect(() => { return () => { if (meshiSpeechTimer.current) clearTimeout(meshiSpeechTimer.current); }; }, []);

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, [step]);

  // Dispatch mesh activity for constellation animation
  useEffect(() => {
    let meshiPos: { x: number; y: number } | null = null;
    if (meshiRef.current) {
      const rect = meshiRef.current.getBoundingClientRect();
      meshiPos = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
    window.dispatchEvent(new CustomEvent("mesh-activity", {
      detail: { totalChars: username.length + password.length + email.length + phone.length, meshiPos },
    }));
  }, [username, password, email, phone, step]);

  const pageMotion = {
    initial: { opacity: 0, y: 24, filter: "blur(10px)" },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
    exit: { opacity: 0, y: -16, filter: "blur(8px)" },
    transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] as const },
  };

  const inputClass = "w-full bg-transparent rounded-xl px-4 py-3.5 text-base placeholder:opacity-40 focus:outline-none focus:ring-1 focus:ring-[var(--accent-muted)] transition-all duration-300";
  const cardClass = "rounded-2xl p-6 md:p-8 backdrop-blur-xl";

  const errorBanner = error ? (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
      className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs overflow-hidden">
      {error}
    </motion.div>
  ) : null;

  // --- Handlers ---

  const startSignup = () => { setIsLogin(false); setError(""); setStep("credentials"); showMeshiSpeech("Let\u2019s set you up!", "excited"); };
  const startLogin = () => { setIsLogin(true); setError(""); setStep("credentials"); showMeshiSpeech("Welcome back!", "happy"); };

  // Signup: username + password on same page → email
  const handleCredentialsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = username.trim().toLowerCase();
    if (!val || val.length < 3) { setError("Username must be at least 3 characters"); return; }
    if (isLogin) {
      setError("");
      showMeshiSpeech(`Hey @${val}! Enter your password.`, "wink", 5000);
      setStep("login-password");
    } else {
      if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
      setError("");
      showMeshiSpeech(`Nice, @${val}! Now your email.`, "love");
      setStep("email");
    }
  };

  // Login: password → sign in
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setError("");
    showMeshiSpeech("Verifying...", "thinking", 10000);
    const formData = new FormData();
    formData.set("email", username);
    formData.set("password", password);
    startTransition(async () => {
      window.dispatchEvent(new CustomEvent("mesh-converge"));
      const result = await signIn(formData);
      if (result?.error) {
        setError(result.error);
        showMeshiSpeech("Hmm, that doesn\u2019t seem right.", "thinking", 4000);
      }
    });
  };

  // Signup: email → phone
  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email");
      return;
    }
    setError("");
    showMeshiSpeech("Great! Let\u2019s secure your account.", "happy");
    setStep("phone");
  };

  // Phone verification (simulated)
  const handleSendCode = () => {
    if (phone.length >= 10) { setPhoneSent(true); showMeshiSpeech("Code sent!", "excited"); }
  };
  const handleVerifyCode = () => {
    if (phoneCode.length === 6) { setPhoneVerified(true); showMeshiSpeech("Verified!", "love"); }
  };

  // Phone → connect platforms
  const handlePhoneContinue = () => {
    setError("");
    showMeshiSpeech("Almost there! Connect your world.", "excited");
    setStep("connect");
  };

  // Final: create account
  const handleCreateAccount = () => {
    setError("");
    setStep("creating");
    showMeshiSpeech("Building your mesh...", "thinking", 10000);
    const formData = new FormData();
    formData.set("email", email);
    formData.set("password", password);
    formData.set("username", username.trim().toLowerCase());
    formData.set("displayName", username.trim());
    startTransition(async () => {
      window.dispatchEvent(new CustomEvent("mesh-converge"));
      const result = await signUp(formData);
      if (result?.error) {
        setError(result.error);
        showMeshiSpeech("Something went wrong.", "thinking", 4000);
        setStep("connect");
      }
    });
  };

  const togglePlatform = (id: string) => {
    setConnectedPlatforms((prev) => prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]);
  };

  const goBack = () => {
    setError("");
    if (step === "credentials") setStep("welcome");
    else if (step === "login-password") setStep("credentials");
    else if (step === "email") setStep("credentials");
    else if (step === "phone") setStep("email");
    else if (step === "connect") setStep("phone");
    else setStep("welcome");
  };

  // Signup steps for progress bar
  const signupSteps: AuthStep[] = ["credentials", "email", "phone", "connect"];
  const currentStepIndex = signupSteps.indexOf(step);
  const progress = !isLogin && currentStepIndex >= 0 ? ((currentStepIndex + 1) / signupSteps.length) * 100 : 0;

  return (
    <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 sm:px-6">
      {/* Signup progress bar */}
      {!isLogin && currentStepIndex >= 0 && step !== "creating" && (
        <div className="fixed top-0 left-0 right-0 z-30 h-1" style={{ background: "var(--bg-tertiary)" }}>
          <motion.div className="h-full" style={{ background: "var(--brand-gradient)" }}
            initial={{ width: 0 }} animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }} />
        </div>
      )}

      <AnimatePresence mode="wait">
        {/* ============ WELCOME ============ */}
        {step === "welcome" && (
          <motion.div key="welcome" {...pageMotion} className="text-center max-w-lg w-full">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-10">
              <div className="inline-flex flex-col items-center gap-3">
                <MeshiWithSpeech size={72} meshiRef={meshiRef} meshiMood={meshiMood} meshiSpeech={meshiSpeech} />
                <span className="brand-wordmark text-2xl" style={{ color: "var(--text-primary)" }}>
                  mesh<span className="brand-wordmark-accent">.me</span>
                </span>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.6 }} className="relative">
              <div className="absolute inset-0 rounded-3xl blur-2xl" style={{ background: "var(--accent-subtle)" }} />
              <div className={cardClass} style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)" }}>
                <h1 className="font-display text-4xl md:text-5xl font-extrabold tracking-tight mb-4" style={{ letterSpacing: "-0.035em" }}>
                  <span style={{ color: "var(--text-primary)" }}>Enter the</span><br />
                  <span className="gradient-text">Mesh</span>
                </h1>
                <p className="text-sm leading-relaxed mb-4 max-w-xs mx-auto" style={{ color: "var(--text-tertiary)" }}>
                  One internet. One you.
                </p>
                <div className="flex items-center justify-center gap-5 mb-8 text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
                  <span className="flex items-center gap-1.5"><Shield className="h-3 w-3" style={{ color: "var(--accent)" }} /> Private</span>
                  <span className="flex items-center gap-1.5"><Lock className="h-3 w-3" style={{ color: "var(--accent)" }} /> Ad-free</span>
                  <span className="flex items-center gap-1.5"><Fingerprint className="h-3 w-3" style={{ color: "var(--accent)" }} /> Your data</span>
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
              <span>&middot;</span>
              <a href="/privacy" className="hover:opacity-80 transition-opacity">Privacy</a>
              <span>&middot;</span>
              <span>Built for humans</span>
            </motion.div>
          </motion.div>
        )}

        {/* ============ CREDENTIALS (signup: username + password | login: username) ============ */}
        {step === "credentials" && (
          <motion.div key="credentials" {...pageMotion} className="w-full max-w-sm text-center">
            <div className="mb-8">
              <MeshiWithSpeech size={56} meshiRef={meshiRef} meshiMood={meshiMood} meshiSpeech={meshiSpeech} />
              <h2 className="font-display text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
                {isLogin ? "Welcome back" : "Claim your identity"}
              </h2>
              <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
                {isLogin ? "Enter your username or email" : "Pick a username and password"}
              </p>
            </div>
            <div className={cardClass} style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)" }}>
              <AnimatePresence mode="wait">{errorBanner}</AnimatePresence>
              <form onSubmit={handleCredentialsSubmit} className="space-y-3">
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm" style={{ color: "var(--text-muted)" }}>@</span>
                  <input ref={inputRef} type="text" value={username}
                    placeholder={isLogin ? "username or email" : "username"}
                    autoComplete={isLogin ? "email" : "username"}
                    minLength={3} maxLength={30}
                    className={inputClass + " pl-8 text-center"}
                    style={{ border: "1px solid var(--border-primary)", color: "var(--text-primary)" }}
                    onChange={(e) => {
                      const val = isLogin ? e.target.value : e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "");
                      setUsername(val);
                    }} />
                </div>
                {!isLogin && (
                  <>
                    <div className="relative">
                      <input type={showPassword ? "text" : "password"} value={password}
                        placeholder="Password (8+ characters)" autoComplete="new-password"
                        className={inputClass + " pr-10 text-center"} minLength={8}
                        style={{ border: "1px solid var(--border-primary)", color: "var(--text-primary)" }}
                        onChange={(e) => setPassword(e.target.value)} />
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors" tabIndex={-1}
                        style={{ color: "var(--text-muted)" }}>
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {password && <PasswordStrength password={password} />}
                  </>
                )}
                <motion.button whileTap={{ scale: 0.98 }} type="submit"
                  className="brand-button w-full text-white px-6 py-3.5 rounded-xl text-sm font-semibold shadow-lg flex items-center justify-center gap-2">
                  Continue <ArrowRight className="h-4 w-4" />
                </motion.button>
              </form>
            </div>
            <div className="flex items-center justify-between mt-5 px-1">
              <BackButton onClick={() => { setStep("welcome"); setError(""); }} />
              <button onClick={() => { setIsLogin(!isLogin); setError(""); setPassword(""); }}
                className="text-xs transition-colors" style={{ color: "var(--text-tertiary)" }}>
                {isLogin ? "Create an account" : "Already have an account?"}
              </button>
            </div>
          </motion.div>
        )}

        {/* ============ LOGIN PASSWORD ============ */}
        {step === "login-password" && (
          <motion.div key="login-password" {...pageMotion} className="w-full max-w-sm text-center">
            <div className="mb-8">
              <MeshiWithSpeech meshiRef={meshiRef} meshiMood={meshiMood} meshiSpeech={meshiSpeech} />
              <h2 className="font-display text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Enter the Mesh</h2>
              <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>Welcome back, <span style={{ color: "var(--accent)" }}>@{username}</span></p>
            </div>
            <div className={cardClass} style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)" }}>
              <AnimatePresence mode="wait">{errorBanner}</AnimatePresence>
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div className="relative">
                  <input ref={inputRef} type={showPassword ? "text" : "password"} value={password}
                    placeholder="Password" autoComplete="current-password"
                    className={inputClass + " pr-10 text-center"}
                    style={{ border: "1px solid var(--border-primary)", color: "var(--text-primary)" }}
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
            <div className="mt-5 px-1"><BackButton onClick={goBack} /></div>
          </motion.div>
        )}

        {/* ============ EMAIL (signup step 2) ============ */}
        {step === "email" && (
          <motion.div key="email" {...pageMotion} className="w-full max-w-sm text-center">
            <div className="mb-8">
              <MeshiWithSpeech meshiRef={meshiRef} meshiMood={meshiMood} meshiSpeech={meshiSpeech} />
              <p className="text-xs mb-2" style={{ color: "var(--accent)" }}>@{username}</p>
              <h2 className="font-display text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Your email</h2>
              <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>For account recovery &mdash; never shared, never spam</p>
            </div>
            <div className={cardClass} style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)" }}>
              <AnimatePresence mode="wait">{errorBanner}</AnimatePresence>
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <input ref={inputRef} type="email" value={email} placeholder="you@example.com"
                  autoComplete="email" className={inputClass + " text-center"}
                  style={{ border: "1px solid var(--border-primary)", color: "var(--text-primary)" }}
                  onChange={(e) => setEmail(e.target.value)} />
                <motion.button whileTap={{ scale: 0.98 }} type="submit"
                  className="brand-button w-full text-white px-6 py-3.5 rounded-xl text-sm font-semibold shadow-lg flex items-center justify-center gap-2">
                  Continue <ArrowRight className="h-4 w-4" />
                </motion.button>
              </form>
            </div>
            <div className="mt-5 px-1"><BackButton onClick={goBack} /></div>
          </motion.div>
        )}

        {/* ============ PHONE (signup step 3) ============ */}
        {step === "phone" && (
          <motion.div key="phone" {...pageMotion} className="w-full max-w-sm text-center">
            <div className="mb-8">
              <div className="h-12 w-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: "var(--accent-subtle)", border: "1px solid var(--accent-muted)" }}>
                <Phone className="h-6 w-6" style={{ color: "var(--accent)" }} />
              </div>
              <h2 className="font-display text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Verify your phone</h2>
              <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>Keeps your account secure &amp; recoverable</p>
            </div>
            <div className={cardClass} style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)" }}>
              {phoneVerified ? (
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-3 text-center py-2">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-500/15">
                    <Check className="h-6 w-6 text-green-500" />
                  </div>
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Phone verified</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{phone}</p>
                </motion.div>
              ) : !phoneSent ? (
                <div className="space-y-4">
                  <input ref={inputRef} type="tel" value={phone} placeholder="+1 (555) 000-0000"
                    autoComplete="tel" className={inputClass + " text-center"}
                    style={{ border: "1px solid var(--border-primary)", color: "var(--text-primary)" }}
                    onChange={(e) => setPhone(e.target.value)} />
                  <motion.button whileTap={{ scale: 0.98 }} onClick={handleSendCode} disabled={phone.length < 10}
                    className="brand-button w-full text-white px-6 py-3.5 rounded-xl text-sm font-semibold shadow-lg disabled:opacity-50 flex items-center justify-center gap-2">
                    Send code <ArrowRight className="h-4 w-4" />
                  </motion.button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-center" style={{ color: "var(--text-tertiary)" }}>
                    Code sent to <span style={{ color: "var(--text-primary)" }} className="font-medium">{phone}</span>
                  </p>
                  <input ref={inputRef} value={phoneCode} placeholder="000000"
                    className={inputClass + " text-center text-lg tracking-[0.3em] font-mono"} maxLength={6}
                    style={{ border: "1px solid var(--border-primary)", color: "var(--text-primary)" }}
                    onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
                  <motion.button whileTap={{ scale: 0.98 }} onClick={handleVerifyCode} disabled={phoneCode.length !== 6}
                    className="brand-button w-full text-white px-6 py-3.5 rounded-xl text-sm font-semibold shadow-lg disabled:opacity-50">
                    Verify
                  </motion.button>
                  <button onClick={() => { setPhoneSent(false); setPhoneCode(""); }}
                    className="w-full text-center text-xs hover:opacity-80 transition-opacity" style={{ color: "var(--text-muted)" }}>
                    Use a different number
                  </button>
                </div>
              )}

              <div className="flex gap-3 justify-between mt-6">
                <BackButton onClick={goBack} />
                <motion.button whileTap={{ scale: 0.98 }} onClick={handlePhoneContinue}
                  className="text-sm font-medium flex items-center gap-1 transition-colors"
                  style={{ color: phoneVerified ? "var(--accent)" : "var(--text-muted)" }}>
                  {phoneVerified ? "Next" : "Skip for now"} <ArrowRight className="h-3.5 w-3.5" />
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ============ CONNECT PLATFORMS (signup step 4) ============ */}
        {step === "connect" && (
          <motion.div key="connect" {...pageMotion} className="w-full max-w-md text-center">
            <div className="mb-6">
              <div className="h-12 w-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: "var(--accent-subtle)", border: "1px solid var(--accent-muted)" }}>
                <Link2 className="h-6 w-6" style={{ color: "var(--accent)" }} />
              </div>
              <h2 className="font-display text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Bring your world in</h2>
              <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>Connect your platforms to build your mesh</p>
            </div>
            <div className={cardClass} style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)" }}>
              <AnimatePresence mode="wait">{errorBanner}</AnimatePresence>
              <div className="grid grid-cols-4 gap-2 mb-5">
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
                We only store connection tokens. Never your passwords. Disconnect anytime.
              </div>

              {connectedPlatforms.length > 0 && (
                <p className="text-xs mb-3" style={{ color: "var(--text-tertiary)" }}>{connectedPlatforms.length} platform{connectedPlatforms.length !== 1 ? "s" : ""} selected</p>
              )}

              <motion.button whileTap={{ scale: 0.98 }} onClick={handleCreateAccount} disabled={isPending}
                className="brand-button w-full text-white px-6 py-3.5 rounded-xl text-sm font-semibold shadow-lg disabled:opacity-50 flex items-center justify-center gap-2">
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <>{connectedPlatforms.length > 0 ? "Enter the Mesh" : "Skip & Enter the Mesh"}<ArrowRight className="h-4 w-4" /></>}
              </motion.button>
              <p className="text-[10px] mt-3" style={{ color: "var(--text-muted)" }}>You can connect accounts anytime in settings</p>
            </div>
            <div className="mt-5 px-1"><BackButton onClick={goBack} /></div>
          </motion.div>
        )}

        {/* ============ CREATING (success animation) ============ */}
        {step === "creating" && (
          <motion.div key="creating" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }} className="text-center">
            <motion.div initial={{ scale: 0 }} animate={{ scale: [0, 1.2, 1] }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl" style={{ background: "var(--brand-gradient)" }}>
              <motion.div initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.6 }}>
                <MeshiMascot size={48} mood="celebrating" color="blue" animate bouncy />
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
