"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowRight, Eye, EyeOff, Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
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
import { MeshiBrandMark } from "@/components/brand/meshi-brand-mark";
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

function detectIdentity(raw: string): { kind: "email" | "phone" | "username" | "empty"; label: string } {
  const value = raw.trim();
  if (!value) return { kind: "empty", label: "" };
  if (EMAIL_RE.test(value.toLowerCase())) return { kind: "email", label: "Email" };
  const digits = value.replace(/[^\d]/g, "");
  if (!value.includes("@") && digits.length >= 7) return { kind: "phone", label: "Phone" };
  return { kind: "username", label: "Username" };
}

function usernameCandidate(raw: string): string | null {
  const value = raw.trim().replace(/^@+/, "").toLowerCase();
  return /^[a-z0-9_]{2,24}$/.test(value) ? value : null;
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
  const [success, setSuccess] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [isPending, startTransition] = useTransition();

  const reduceMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  const fx = useRef<ConstellationState>({ energy: 0, stage: "identity", phase: "idle" });
  const anchorRef = useRef<HTMLDivElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => setHydrated(true), []);
  useEffect(() => {
    fx.current.stage = stage;
  }, [stage]);

  const spark = useCallback(() => {
    fx.current.energy = 1;
  }, []);

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
      // Valid account → reveal their Meshi, then ask for the password.
      const candidate = usernameCandidate(value);
      const loaded = candidate ? await loadPreview(candidate) : null;
      setPreview(loaded);
      setStage("password");
      setPassword("");
      setTimeout(() => passwordRef.current?.focus(), 420);
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
        setTimeout(() => passwordRef.current?.focus(), 80);
        return;
      }
      // Success: pull the whole mesh together, then land in the app.
      setSuccess(true);
      fx.current.phase = "success";
      const destination = (result && "redirectTo" in result && result.redirectTo) || "/mesh";
      setTimeout(() => {
        router.refresh();
        router.push(destination);
        setTimeout(() => {
          if (window.location.pathname.startsWith("/login") || window.location.pathname === "/") {
            window.location.assign(destination);
          }
        }, 1400);
      }, reduceMotion ? 200 : 720);
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
  };

  const displayName = preview?.displayName?.trim() || preview?.username || "you";

  return (
    <div className={`mesh-signin${success ? " mesh-signin-success" : ""}`} data-entry-ready={hydrated ? "true" : undefined}>
      <MeshBorderConstellation state={fx} anchorRef={anchorRef} reducedMotion={Boolean(reduceMotion)} />
      <div className="mesh-signin-vignette" aria-hidden="true" />

      <span className="mesh-signin-badge">
        <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
        Privacy first. Always.
      </span>

      <main className="mesh-signin-stage">
        <Link href="/" className="mesh-signin-brand" aria-label="mesh.me home">
          <MeshiBrandMark size={40} />
          <span className="mesh-signin-wordmark brand-wordmark">
            mesh<span className="brand-wordmark-accent">.me</span>
          </span>
          <span className="mesh-signin-tagline">Your World, Your Way</span>
        </Link>

        <div ref={anchorRef} className="mesh-signin-slot">
          {/* IDENTITY */}
          {stage === "identity" && (
            <form key="identity" onSubmit={submitIdentity} className="mesh-signin-card" noValidate>
              <h1 className="mesh-signin-title">Who are you?</h1>
              <p className="mesh-signin-sub">Username, email, or phone number</p>
              <div className="mesh-signin-field">
                <input
                  autoFocus
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    if (message) setMessage("");
                    spark();
                  }}
                  placeholder="Enter your username, email, or phone"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  inputMode={identity.kind === "email" ? "email" : identity.kind === "phone" ? "tel" : "text"}
                  maxLength={96}
                  className="mesh-signin-input"
                  aria-label="Username, email, or phone number"
                  data-testid="entry-identity-input"
                />
                <button
                  type="submit"
                  className="mesh-signin-go"
                  disabled={isPending || !hydrated}
                  aria-label="Continue"
                  data-testid="entry-continue-button"
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                </button>
              </div>
              {message && <p className="mesh-signin-message" role="alert">{message}</p>}
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
                className="mesh-signin-secondary"
                data-testid="entry-open-signup-button"
              >
                New here? Create your Mesh
              </button>
              {oauthProviders.length > 0 && <IdentityProviderButtons providers={oauthProviders} next={nextPath} />}
            </form>
          )}

          {/* PASSWORD — the user's own Meshi greets them */}
          {stage === "password" && (
            <form key="password" onSubmit={submitPassword} className="mesh-signin-card" data-testid="entry-password-form" noValidate>
              <div className="mesh-signin-meshi">
                <MeshiMascot
                  size={78}
                  color={preview?.meshi.color}
                  mood={success ? "celebrating" : "excited"}
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
                <span className="mesh-signin-bubble">
                  {preview ? `Hi ${displayName}. I've missed you.` : "Welcome back."}
                </span>
              </div>
              <h1 className="mesh-signin-title mesh-signin-title-sm">Welcome back</h1>
              <p className="mesh-signin-sub">Enter your password{preview ? `, @${preview.username}` : ""}</p>
              <div className="mesh-signin-field">
                <input
                  ref={passwordRef}
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (message) setMessage("");
                    spark();
                  }}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="mesh-signin-input"
                  aria-label="Password"
                  data-testid="entry-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="mesh-signin-peek"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {message && <p className="mesh-signin-message" role="alert">{message}</p>}
              <button type="submit" className="mesh-signin-primary" disabled={isPending || success} data-testid="entry-submit-button">
                {isPending || success ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enter my world"}
              </button>
              <div className="mesh-signin-row">
                <button type="button" onClick={backToIdentity} className="mesh-signin-link">
                  Not you?
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setResetEmail(identity.kind === "email" ? identifier.trim().toLowerCase() : "");
                    setResetSent(false);
                    setMessage("");
                    setStage("reset");
                  }}
                  className="mesh-signin-link"
                >
                  Forgot password?
                </button>
              </div>
            </form>
          )}

          {/* SIGN UP */}
          {stage === "signup" && (
            <form key="signup" action={submitSignup} className="mesh-signin-card" data-testid="entry-signup-form" noValidate>
              <h1 className="mesh-signin-title mesh-signin-title-sm">Create your Mesh</h1>
              <p className="mesh-signin-sub">Your world, your way — private by default.</p>
              <input type="hidden" name="phone" value={signupDraft.phone} />
              <label className="mesh-signin-label">
                <span>Email</span>
                <input
                  name="email"
                  type="email"
                  defaultValue={signupDraft.email}
                  onChange={spark}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  className="mesh-signin-input mesh-signin-input-plain"
                  data-testid="entry-signup-email"
                />
              </label>
              <label className="mesh-signin-label">
                <span>Username</span>
                <input
                  name="username"
                  defaultValue={signupDraft.username}
                  onChange={spark}
                  placeholder="yourname"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                  minLength={2}
                  maxLength={24}
                  className="mesh-signin-input mesh-signin-input-plain"
                  data-testid="entry-signup-username"
                />
              </label>
              <label className="mesh-signin-label">
                <span>Display name</span>
                <input
                  name="displayName"
                  onChange={spark}
                  placeholder="Your name"
                  required
                  maxLength={48}
                  className="mesh-signin-input mesh-signin-input-plain"
                  data-testid="entry-signup-display-name"
                />
              </label>
              <label className="mesh-signin-label">
                <span>Password</span>
                <input
                  name="password"
                  type="password"
                  onChange={spark}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  className="mesh-signin-input mesh-signin-input-plain"
                  data-testid="entry-signup-password"
                />
              </label>
              {message && <p className="mesh-signin-message" role="alert">{message}</p>}
              <button type="submit" className="mesh-signin-primary" disabled={isPending} data-testid="entry-create-account-button">
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create your Mesh"}
              </button>
              <button type="button" onClick={backToIdentity} className="mesh-signin-secondary">
                I already have an account
              </button>
            </form>
          )}

          {/* RESET */}
          {stage === "reset" && (
            <form key="reset" onSubmit={submitReset} className="mesh-signin-card" noValidate>
              <h1 className="mesh-signin-title mesh-signin-title-sm">Reset password</h1>
              {resetSent ? (
                <p className="mesh-signin-sub">If that email is connected to a Mesh, a reset link is on its way.</p>
              ) : (
                <>
                  <p className="mesh-signin-sub">We&apos;ll send a secure reset link.</p>
                  <div className="mesh-signin-field">
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
                      className="mesh-signin-input"
                      aria-label="Email"
                    />
                  </div>
                  {message && <p className="mesh-signin-message" role="alert">{message}</p>}
                  <button type="submit" className="mesh-signin-primary" disabled={isPending}>
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send reset link"}
                  </button>
                </>
              )}
              <button type="button" onClick={backToIdentity} className="mesh-signin-secondary">
                Back to sign in
              </button>
            </form>
          )}
        </div>
      </main>

      <footer className="mesh-signin-footer">
        <div className="mesh-signin-privacy">
          <ShieldCheck className="h-4 w-4 text-[var(--mesh-blue)]" aria-hidden="true" />
          <span>
            <strong>Your data. Your identity. Your choice.</strong>
            <span className="mesh-signin-privacy-sub">Private by default — no ads, no data selling, no tracking.</span>
          </span>
        </div>
        <nav className="mesh-signin-links">
          <button type="button" onClick={() => setStage("signup")}>Create account</button>
          <button type="button" onClick={() => { setStage("reset"); setResetSent(false); }}>Forgot password?</button>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/support">Help</Link>
        </nav>
      </footer>
    </div>
  );
}
