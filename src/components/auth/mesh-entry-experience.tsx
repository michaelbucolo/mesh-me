"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { requestPasswordReset, resolveEntryIdentity, signInForEntry, signUp } from "@/lib/actions";
import {
  MeshiMascot,
  type MeshiAccessory,
  type MeshiBadge,
  type MeshiColor,
  type MeshiEyeStyle,
  type MeshiHair,
  type MeshiHat,
  type MeshiMood,
  type MeshiOutfit,
} from "@/components/meshi/meshi-mascot";
import { IdentityProviderButtons } from "@/components/auth/identity-provider-buttons";
import type { IdentityProvider } from "@/lib/identity-auth";
import {
  MeshBorderConstellation,
  type ConstellationState,
  type EntryStage,
} from "@/components/auth/mesh-border-constellation";

type MeshEntryExperienceProps = {
  nextPath?: string | null;
  oauthProviders?: IdentityProvider[];
  initialError?: string | null;
};

type MeshiPreview = {
  username: string;
  displayName: string;
  meshi: {
    color: MeshiColor;
    hat: MeshiHat;
    face: MeshiMood;
    hair: MeshiHair;
    accessory: MeshiAccessory;
    eye: MeshiEyeStyle;
    badge: MeshiBadge;
    outfit: MeshiOutfit;
  };
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function detectIdentity(raw: string): { kind: "email" | "phone" | "username" | "empty" } {
  const value = raw.trim();
  if (!value) return { kind: "empty" };
  if (EMAIL_RE.test(value.toLowerCase())) return { kind: "email" };
  const digits = value.replace(/[^\d]/g, "");
  if (!value.includes("@") && digits.length >= 7) return { kind: "phone" };
  return { kind: "username" };
}

function usernameCandidate(raw: string): string | null {
  const value = raw.trim().replace(/^@+/, "").toLowerCase();
  return /^[a-z0-9_]{2,24}$/.test(value) ? value : null;
}

// A single sheen sweep across the "go" affordance the moment it becomes ready.
// Mounts with its parent's ready state, so it plays exactly once per readiness.
function GoSheen() {
  return (
    <motion.span
      aria-hidden="true"
      initial={{ x: "-130%", opacity: 0 }}
      animate={{ x: "130%", opacity: [0, 0.85, 0] }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: 999,
        background: "linear-gradient(105deg, transparent 25%, rgba(255,255,255,0.7) 50%, transparent 75%)",
        pointerEvents: "none",
      }}
    />
  );
}

export function MeshEntryExperience({ nextPath, oauthProviders = [], initialError = null }: MeshEntryExperienceProps) {
  const router = useRouter();

  const [stage, setStage] = useState<EntryStage>("identity");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState(initialError ?? "");
  const [preview, setPreview] = useState<MeshiPreview | null>(null);
  const [signupDraft, setSignupDraft] = useState({ email: "", username: "", phone: "" });
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  // How much of the signup form is filled — Meshi warms up as it comes alive.
  const [signupFilled, setSignupFilled] = useState<Record<string, boolean>>({});
  const [shaking, setShaking] = useState(false);
  const [isPending, startTransition] = useTransition();

  const markFilled = useCallback((field: string, value: string) => {
    setSignupFilled((current) =>
      current[field] === Boolean(value.trim()) ? current : { ...current, [field]: Boolean(value.trim()) },
    );
  }, []);

  const shake = useCallback(() => {
    setShaking(true);
    window.setTimeout(() => setShaking(false), 450);
  }, []);

  const reduceMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  const fx = useRef<ConstellationState>({ energy: 0, stage: "identity", phase: "idle", sparks: 0 });
  const anchorRef = useRef<HTMLDivElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // This flag intentionally gates browser-only identity interactions after hydration.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setHydrated(true), []);
  useEffect(() => {
    fx.current.stage = stage;
  }, [stage]);

  const spark = useCallback(() => {
    fx.current.energy = 1;
    // Bump the keystroke counter so the constellation flings a caret spark.
    fx.current.sparks = (fx.current.sparks ?? 0) + 1;
  }, []);

  // How many signup fields are filled — used to warm the halo as Meshi comes alive.
  const signupFilledCount = useMemo(
    () => Object.values(signupFilled).filter(Boolean).length,
    [signupFilled],
  );

  const identity = useMemo(() => detectIdentity(identifier), [identifier]);

  const loadPreview = useCallback(async (username: string): Promise<MeshiPreview | null> => {
    try {
      const res = await fetch(`/api/auth/meshi-preview?username=${encodeURIComponent(username)}`, {
        headers: { Accept: "application/json" },
      });
      const data = await res.json().catch(() => null);
      if (!data?.found) return null;
      return {
        username: data.username,
        displayName: data.displayName,
        meshi: {
          color: data.meshi.color,
          hat: data.meshi.hat,
          face: data.meshi.face,
          hair: data.meshi.hair,
          accessory: data.meshi.accessory,
          eye: data.meshi.eye,
          badge: data.meshi.badge,
          outfit: data.meshi.outfit,
        },
      };
    } catch {
      return null;
    }
  }, []);

  // ── Step 1: resolve who they are ───────────────────────────────────────
  const submitIdentity = (event?: React.FormEvent) => {
    event?.preventDefault();
    const value = identifier.trim();
    if (!value) {
      setMessage("Enter your username, email, or phone number.");
      return;
    }
    setMessage("");
    spark();
    startTransition(async () => {
      const result = await resolveEntryIdentity(value);
      if (result && "error" in result && result.error) {
        setMessage(result.error);
        return;
      }
      if (result?.mode === "sign-up") {
        setPreview(null);
        setSignupDraft(result.prefill ?? { email: "", username: "", phone: "" });
        setStage("signup");
        return;
      }
      // Valid account → the field morphs into their Meshi, who asks for the password.
      const candidate = usernameCandidate(value);
      const loaded = candidate ? await loadPreview(candidate) : null;
      setPreview(loaded);
      // Reel the mesh inward: the field collapses and re-forms as Meshi.
      fx.current.phase = "forming";
      setLeaving(true);
      window.setTimeout(() => {
        setStage("password");
        setPassword("");
        setLeaving(false);
        window.setTimeout(() => passwordRef.current?.focus(), 180);
        window.setTimeout(() => {
          fx.current.phase = "idle";
        }, 640);
      }, reduceMotion ? 0 : 430);
    });
  };

  // ── Step 2: password ───────────────────────────────────────────────────
  const submitPassword = (event: React.FormEvent) => {
    event.preventDefault();
    if (!password) {
      setMessage("Enter your password.");
      return;
    }
    setMessage("");
    startTransition(async () => {
      const form = new FormData();
      form.set("email", identifier.trim());
      form.set("password", password);
      if (nextPath) form.set("next", nextPath);
      const result = await signInForEntry(form);
      if (result && "error" in result && result.error) {
        setMessage(result.error === "Invalid email or password" ? "That password didn't work. Try again." : result.error);
        shake();
        window.setTimeout(() => passwordRef.current?.focus(), 80);
        return;
      }
      // Success: Meshi pulls the whole mesh together, then we glide into the app.
      setSuccess(true);
      fx.current.phase = "success";
      const destination = (result && "redirectTo" in result && result.redirectTo) || "/mesh";
      window.setTimeout(() => {
        router.refresh();
        router.push(destination);
        window.setTimeout(() => {
          if (window.location.pathname.startsWith("/login") || window.location.pathname === "/") {
            window.location.assign(destination);
          }
        }, 1400);
      }, reduceMotion ? 200 : 900);
    });
  };

  // ── Sign up ─────────────────────────────────────────────────────────────
  const submitSignup = (formData: FormData) => {
    setMessage("");
    startTransition(async () => {
      const result = await signUp(formData);
      if (result?.error) setMessage(result.error);
    });
  };

  // ── Reset ────────────────────────────────────────────────────────────────
  const submitReset = (event: React.FormEvent) => {
    event.preventDefault();
    const email = resetEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      setMessage("Enter the email connected to your Mesh.");
      return;
    }
    setMessage("");
    startTransition(async () => {
      const result = await requestPasswordReset(email);
      if (result && "error" in result && result.error) {
        setMessage(result.error);
        return;
      }
      setResetSent(true);
    });
  };

  const backToIdentity = () => {
    setStage("identity");
    setMessage("");
    setPreview(null);
    setPassword("");
    setResetSent(false);
    fx.current.phase = "idle";
  };

  const displayName = preview?.displayName?.trim() || preview?.username || "there";

  // The halo warms — periwinkle deepens, a magenta undertone rises — as the
  // signup fields fill and Meshi comes to life.
  const haloStyle: React.CSSProperties | undefined =
    stage === "signup"
      ? {
          background: `radial-gradient(46% 40% at 50% 46%, rgba(110,139,255,${(0.1 + signupFilledCount * 0.045).toFixed(3)}), rgba(236,72,153,${(signupFilledCount * 0.024).toFixed(3)}) 42%, transparent 74%)`,
          transition: "background 520ms cubic-bezier(0.16,1,0.3,1)",
        }
      : undefined;

  return (
    <div
      className={`mesh-gate${success ? " mesh-gate-done" : ""}`}
      data-entry-ready={hydrated ? "true" : undefined}
      data-stage={stage}
    >
      <MeshBorderConstellation state={fx} anchorRef={anchorRef} reducedMotion={Boolean(reduceMotion)} />
      <div className="mesh-gate-halo" aria-hidden="true" style={haloStyle} />

      {/* Success handoff: a radial aurora bloom (periwinkle → cyan → magenta)
          holds for a beat of anticipation, then expands to cover as we glide
          into /mesh. Skipped entirely under reduced motion. */}
      {success && !reduceMotion && (
        <motion.div
          aria-hidden="true"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 0.16, 8], opacity: [0, 0.95, 1] }}
          transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1], times: [0, 0.2, 1] }}
          style={{
            position: "fixed",
            left: "50%",
            top: "50%",
            width: "30vmax",
            height: "30vmax",
            marginLeft: "-15vmax",
            marginTop: "-15vmax",
            borderRadius: "50%",
            zIndex: 3,
            pointerEvents: "none",
            mixBlendMode: "screen",
            background:
              "radial-gradient(circle, rgba(110,139,255,0.95) 0%, rgba(52,228,234,0.85) 40%, rgba(236,72,153,0.9) 72%, rgba(236,72,153,0) 100%)",
          }}
        />
      )}

      <motion.main
        className="mesh-gate-core"
        animate={
          success && !reduceMotion
            ? { scale: [1, 0.955, 1.04], opacity: [1, 1, 0.72] }
            : undefined
        }
        transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1], times: [0, 0.2, 1] }}
      >
        {/* IDENTITY — a blank page and a single question */}
        {stage === "identity" && (
          <form
            key="identity"
            onSubmit={submitIdentity}
            className={`mesh-gate-focus${leaving ? " mesh-gate-leaving" : ""}`}
            noValidate
          >
            <h1 className="mesh-gate-q">Who are you?</h1>
            <div ref={anchorRef} className="mesh-gate-inputwrap">
              <input
                autoFocus
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value);
                  if (message) setMessage("");
                  spark();
                }}
                placeholder="username, email, or phone"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                inputMode={identity.kind === "email" ? "email" : identity.kind === "phone" ? "tel" : "text"}
                maxLength={96}
                className="mesh-gate-input"
                aria-label="Username, email, or phone number"
                data-testid="entry-identity-input"
                suppressHydrationWarning
              />
              <button
                type="submit"
                className={`mesh-gate-go overflow-hidden${identifier.trim() ? " is-ready" : ""}`}
                disabled={isPending || !hydrated}
                aria-label="Continue"
                data-testid="entry-continue-button"
              >
                {identifier.trim() && !reduceMotion && <GoSheen />}
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              </button>
            </div>
            {message ? (
              <p className="mesh-gate-msg" role="alert">{message}</p>
            ) : (
              <p className="mesh-gate-hint">Enter your Mesh</p>
            )}
            <button
              type="button"
              onClick={() => {
                const looksEmail = EMAIL_RE.test(identifier.trim().toLowerCase());
                setSignupDraft({
                  email: looksEmail ? identifier.trim().toLowerCase() : "",
                  username: usernameCandidate(identifier) ?? "",
                  phone: "",
                });
                setStage("signup");
                setMessage("");
              }}
              className="mesh-gate-textlink"
              data-testid="entry-open-signup-button"
            >
              New here? Create your Mesh
            </button>
            {oauthProviders.length > 0 && (
              <div className="mesh-gate-providers">
                <IdentityProviderButtons providers={oauthProviders} next={nextPath} />
              </div>
            )}
          </form>
        )}

        {/* PASSWORD — the field has become the user's Meshi */}
        {stage === "password" && (
          <form key="password" onSubmit={submitPassword} className="mesh-gate-focus" data-testid="entry-password-form" noValidate>
            <div ref={anchorRef} className={`mesh-gate-meshi${success ? " is-success" : ""}`}>
              <MeshiMascot
                size={96}
                color={preview?.meshi.color}
                // Meshi keeps its eyes shut while you type your password —
                // and visibly peeks the moment you hit "show password".
                mood={
                  success
                    ? "celebrating"
                    : message
                      ? "surprised"
                      : password && showPassword
                        ? "wink"
                        : password
                          ? "sleepy"
                          : "excited"
                }
                hat={preview?.meshi.hat}
                hair={preview?.meshi.hair}
                accessory={preview?.meshi.accessory}
                eyeStyle={preview?.meshi.eye}
                badge={preview?.meshi.badge}
                outfit={preview?.meshi.outfit}
                showGlow
                animate
                bouncy
              />
            </div>
            <p className="mesh-gate-bubble">
              {success
                ? "Pulling your world together…"
                : message
                  ? "Hmm, that's not it — try again."
                  : password && !showPassword
                    ? "Eyes closed. Promise."
                    : password && showPassword
                      ? "Peeking, since you asked."
                      : preview
                        ? `You're ${displayName}. What's your password?`
                        : "Welcome back. What's your password?"}
            </p>
            <div className={`mesh-gate-inputwrap${shaking ? " mesh-gate-shake" : ""}`}>
              <input
                ref={passwordRef}
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (message) setMessage("");
                  spark();
                }}
                placeholder="password"
                autoComplete="current-password"
                className="mesh-gate-input"
                aria-label="Password"
                data-testid="entry-password-input"
                disabled={success}
                suppressHydrationWarning
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="mesh-gate-peek focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7d9bff]"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              <button
                type="submit"
                className={`mesh-gate-go overflow-hidden${password ? " is-ready" : ""}`}
                disabled={isPending || success}
                aria-label="Enter my world"
                data-testid="entry-submit-button"
              >
                {password && !success && !reduceMotion && <GoSheen />}
                {isPending || success ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              </button>
            </div>
            {message && <p className="mesh-gate-msg" role="alert">{message}</p>}
            <div className="mesh-gate-inline">
              <button type="button" onClick={backToIdentity} className="mesh-gate-textlink">Not you?</button>
              <button
                type="button"
                onClick={() => {
                  setResetEmail(identity.kind === "email" ? identifier.trim().toLowerCase() : "");
                  setResetSent(false);
                  setMessage("");
                  setStage("reset");
                }}
                className="mesh-gate-textlink"
              >
                Forgot password?
              </button>
            </div>
          </form>
        )}

        {/* SIGN UP */}
        {stage === "signup" && (() => {
          const filledCount = Object.values(signupFilled).filter(Boolean).length;
          const signupMood: MeshiMood =
            filledCount >= 4 ? "celebrating" : filledCount === 3 ? "love" : filledCount === 2 ? "excited" : "happy";
          return (
          <form key="signup" action={submitSignup} className="mesh-gate-form" data-testid="entry-signup-form" noValidate>
            {/* A brand-new Meshi warms up as the form comes alive — it's THEIR
                Meshi being born, one field at a time. */}
            <div className="mesh-gate-signup-meshi" style={{ transform: `scale(${1 + filledCount * 0.05})` }} aria-hidden="true">
              <MeshiMascot size={72} mood={signupMood} animate bouncy={filledCount >= 4} showGlow={filledCount >= 3} />
            </div>
            <h1 className="mesh-gate-q mesh-gate-q-sm">Create your Mesh</h1>
            <p className="mesh-gate-hint">
              {filledCount >= 4
                ? "Your Meshi is ready to meet you."
                : "Your world, your way — private by default."}
            </p>
            <input type="hidden" name="phone" value={signupDraft.phone} />
            <label className="mesh-gate-field">
              <span>Email</span>
              <input
                name="email"
                type="email"
                defaultValue={signupDraft.email}
                onChange={(e) => { spark(); markFilled("email", e.target.value); }}
                placeholder="you@example.com"
                autoComplete="email"
                required
                className="mesh-gate-input mesh-gate-input-line"
                data-testid="entry-signup-email"
                suppressHydrationWarning
              />
            </label>
            <label className="mesh-gate-field">
              <span>Username</span>
              <input
                name="username"
                defaultValue={signupDraft.username}
                onChange={(e) => { spark(); markFilled("username", e.target.value); }}
                placeholder="yourname"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                minLength={3}
                maxLength={24}
                className="mesh-gate-input mesh-gate-input-line"
                data-testid="entry-signup-username"
                suppressHydrationWarning
              />
            </label>
            <label className="mesh-gate-field">
              <span>Display name</span>
              <input
                name="displayName"
                onChange={(e) => { spark(); markFilled("displayName", e.target.value); }}
                placeholder="Your name"
                required
                maxLength={48}
                className="mesh-gate-input mesh-gate-input-line"
                data-testid="entry-signup-display-name"
                suppressHydrationWarning
              />
            </label>
            <label className="mesh-gate-field">
              <span>Password</span>
              <input
                name="password"
                type="password"
                onChange={(e) => { spark(); markFilled("password", e.target.value); }}
                placeholder="12+ chars with a number & symbol"
                autoComplete="new-password"
                required
                minLength={12}
                className="mesh-gate-input mesh-gate-input-line"
                data-testid="entry-signup-password"
                suppressHydrationWarning
              />
            </label>
            {message && <p className="mesh-gate-msg" role="alert">{message}</p>}
            <button type="submit" className="mesh-gate-primary" disabled={isPending} data-testid="entry-create-account-button">
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create your Mesh"}
            </button>
            <button type="button" onClick={backToIdentity} className="mesh-gate-textlink">
              I already have an account
            </button>
          </form>
          );
        })()}

        {/* RESET */}
        {stage === "reset" && (
          <form key="reset" onSubmit={submitReset} className="mesh-gate-form" noValidate>
            <h1 className="mesh-gate-q mesh-gate-q-sm">Reset password</h1>
            {resetSent ? (
              <p className="mesh-gate-hint">If that email is connected to a Mesh, a reset link is on its way.</p>
            ) : (
              <>
                <p className="mesh-gate-hint">We&apos;ll send a secure reset link.</p>
                <label className="mesh-gate-field">
                  <span>Email</span>
                  <input
                    value={resetEmail}
                    onChange={(e) => {
                      setResetEmail(e.target.value);
                      if (message) setMessage("");
                      spark();
                    }}
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="mesh-gate-input mesh-gate-input-line"
                    aria-label="Email"
                    suppressHydrationWarning
                  />
                </label>
                {message && <p className="mesh-gate-msg" role="alert">{message}</p>}
                <button type="submit" className="mesh-gate-primary" disabled={isPending}>
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send reset link"}
                </button>
              </>
            )}
            <button type="button" onClick={backToIdentity} className="mesh-gate-textlink">
              Back to sign in
            </button>
          </form>
        )}
      </motion.main>

      <footer className="mesh-gate-foot">
        <div className="mesh-gate-shield">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Private by default · No ads · No data selling · No tracking</span>
        </div>
        <nav className="mesh-gate-links">
          <button type="button" onClick={() => { setStage("signup"); setMessage(""); }}>Create account</button>
          <button type="button" onClick={() => { setStage("reset"); setResetSent(false); setMessage(""); }}>Forgot password</button>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </nav>
      </footer>
    </div>
  );
}
