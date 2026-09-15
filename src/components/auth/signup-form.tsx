"use client";

import { useState, useTransition } from "react";
import { ArrowRight, Check, Circle, Eye, EyeOff } from "lucide-react";
import { PaperWait } from "@/components/loading/paper-wait";
import { signUp } from "@/lib/actions";
import { validatePasswordStrength } from "@/lib/security";

type Fields = { email: string; username: string; displayName: string; password: string };
type FieldName = keyof Fields;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fieldError(field: FieldName, value: string): string {
  if (!value.trim()) return "This field is required.";
  if (field === "email" && !emailPattern.test(value.trim())) return "Enter a valid email address.";
  if (field === "username" && !/^[a-zA-Z0-9_]{3,30}$/.test(value.trim())) return "Use 3–30 letters, numbers, or underscores.";
  if (field === "displayName" && value.trim().length > 50) return "Use 50 characters or fewer.";
  if (field === "password") return validatePasswordStrength(value).error || "";
  return "";
}

export function SignupForm({ prefill, onActivity, onProgress, notice }: {
  prefill?: { email: string; username: string; phone: string };
  onActivity?: () => void;
  onProgress?: (count: number) => void;
  notice?: string;
}) {
  const [values, setValues] = useState<Fields>({ email: prefill?.email || "", username: prefill?.username || "", displayName: "", password: "" });
  const [errors, setErrors] = useState<Partial<Fields>>({});
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, startTransition] = useTransition();
  const completed = (Object.keys(values) as FieldName[]).filter((field) => !fieldError(field, values[field])).length;
  const passwordRules = [
    { label: "12–128 characters", met: values.password.length >= 12 && values.password.length <= 128 },
    { label: "Upper & lowercase", met: /[a-z]/.test(values.password) && /[A-Z]/.test(values.password) },
    { label: "Number & symbol", met: /[0-9]/.test(values.password) && /[^A-Za-z0-9]/.test(values.password) },
  ];

  // Actual controls are authoritative, including password-manager autofill.
  function readFields(form: HTMLFormElement): Fields {
    const data = new FormData(form);
    return Object.fromEntries(["email", "username", "displayName", "password"].map((name) => [name, String(data.get(name) || "")])) as Fields;
  }

  function updateProgress(form: HTMLFormElement) {
    const next = readFields(form);
    setValues(next);
    onProgress?.((Object.keys(next) as FieldName[]).filter((field) => !fieldError(field, next[field])).length);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const next = readFields(form);
    const nextErrors: Partial<Fields> = {};
    for (const field of Object.keys(next) as FieldName[]) {
      const message = fieldError(field, next[field]);
      if (message) nextErrors[field] = message;
    }
    setErrors(nextErrors);
    setError("");
    updateProgress(form);
    const firstInvalid = Object.keys(nextErrors)[0];
    if (firstInvalid) {
      (form.elements.namedItem(firstInvalid) as HTMLInputElement | null)?.focus();
      return;
    }
    const data = new FormData(form);
    startTransition(async () => {
      const result = await signUp(data);
      if (result?.error) setError(result.error);
    });
  }

  const fieldProps = (name: FieldName) => ({
    id: `signup-${name}`,
    name,
    required: true,
    defaultValue: name === "password" ? undefined : values[name],
    "aria-invalid": Boolean(errors[name]),
    "aria-labelledby": `signup-${name}-label`,
    "aria-describedby": [errors[name] ? `signup-${name}-error` : "", name === "password" ? "signup-password-rules" : "", name === "username" ? "signup-username-hint" : ""].filter(Boolean).join(" ") || undefined,
    className: "mesh-gate-input mesh-gate-input-line",
    onBlur: (event: React.FocusEvent<HTMLInputElement>) => {
      const value = event.currentTarget.value;
      if (event.currentTarget.form) updateProgress(event.currentTarget.form);
      if (value) setErrors((current) => ({ ...current, [name]: fieldError(name, value) }));
    },
    suppressHydrationWarning: true,
  });
  const fieldMessage = (name: FieldName) => errors[name] ? <span id={`signup-${name}-error`} className="mesh-field-error">{errors[name]}</span> : null;

  return (
    <form onSubmit={submit} onInput={(event) => {
      updateProgress(event.currentTarget);
      const name = (event.target as HTMLInputElement).name;
      setErrors((current) => ({ ...current, [name]: "" }));
      if (error) setError("");
      onActivity?.();
    }} className="mesh-signup-fields" data-testid="entry-signup-form" aria-busy={isPending} noValidate>
      <div className="mesh-signup-progress" role="progressbar" aria-label="Account details completed" aria-valuenow={completed} aria-valuemin={0} aria-valuemax={4} aria-valuetext={`${completed} of 4 fields completed`}>
        <div aria-hidden="true" className="mesh-signup-progress-track">{[0, 1, 2, 3].map((index) => <span key={index} data-complete={index < completed} />)}</div>
        <span aria-hidden="true">{completed === 4 ? "Your details are ready" : "A few details. A world of possibilities."}</span>
      </div>
      {notice && <p className="mesh-gate-hint" role="status">{notice}</p>}
      <input type="hidden" name="phone" value={prefill?.phone || ""} />
      <label className="mesh-gate-field" htmlFor="signup-email">
        <span id="signup-email-label">Email</span>
        <input {...fieldProps("email")} type="email" autoComplete="email" placeholder="you@example.com" data-testid="entry-signup-email" />
        {fieldMessage("email")}
      </label>
      <div className="mesh-signup-name-row">
        <label className="mesh-gate-field" htmlFor="signup-displayName">
          <span id="signup-displayName-label">Display name</span>
          <input {...fieldProps("displayName")} autoComplete="name" maxLength={50} placeholder="Your name" data-testid="entry-signup-display-name" />
          {fieldMessage("displayName")}
        </label>
        <label className="mesh-gate-field" htmlFor="signup-username">
          <span id="signup-username-label">Username</span>
          <input {...fieldProps("username")} autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} minLength={3} maxLength={30} placeholder="yourname" data-testid="entry-signup-username" />
          {fieldMessage("username")}
        </label>
      </div>
      <p id="signup-username-hint" className="mesh-field-hint">Your @username uses letters, numbers, and underscores.</p>
      <div className="mesh-gate-field">
        <label id="signup-password-label" htmlFor="signup-password">Password</label>
        <div className="mesh-signup-password-wrap">
          <input {...fieldProps("password")} type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={12} maxLength={128} placeholder="Make it uniquely yours" data-testid="entry-signup-password" />
          <button type="button" className="mesh-password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}>
            {showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
          </button>
        </div>
        <ul id="signup-password-rules" className="mesh-password-rules">
          {passwordRules.map((rule) => <li key={rule.label} data-met={rule.met}>{rule.met ? <Check size={12} aria-hidden="true" /> : <Circle size={12} aria-hidden="true" />}<span>{rule.label}<span className="sr-only">{rule.met ? ": met" : ": needed"}</span></span></li>)}
        </ul>
        {fieldMessage("password")}
      </div>
      {Object.values(errors).some(Boolean) && <p className="mesh-field-error" role="alert">Check the highlighted fields to continue.</p>}
      {error && <p className="mesh-gate-msg" role="alert">{error}</p>}
      <button type="submit" className="mesh-gate-primary" disabled={isPending} data-testid="entry-create-account-button">
        {isPending ? <><PaperWait size="sm" /><span>Creating your account…</span></> : <><span>Create account</span><ArrowRight size={17} aria-hidden="true" /></>}
      </button>
      <p className="mesh-field-hint mesh-signup-reassurance">Next, make your profile yours.</p>
    </form>
  );
}
