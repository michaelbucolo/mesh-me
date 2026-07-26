"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ImagePlus, LifeBuoy, Send, X } from "lucide-react";
import { supportCategories, supportPriorities } from "@/lib/support-ticket-options";

type SubmissionState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; ticketNumber: string }
  | { status: "error"; message: string };

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SupportTicketForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [browserInfo, setBrowserInfo] = useState("");
  const [screenshotLabel, setScreenshotLabel] = useState("");
  const [messageLength, setMessageLength] = useState(0);
  const [submission, setSubmission] = useState<SubmissionState>({ status: "idle" });

  useEffect(() => {
    const resolved = Intl.DateTimeFormat().resolvedOptions();
    setBrowserInfo(
      JSON.stringify({
        url: window.location.href,
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        timezone: resolved.timeZone,
      }),
    );
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmission({ status: "submitting" });

    const formData = new FormData(event.currentTarget);
    formData.set("browserInfo", browserInfo);

    try {
      const response = await fetch("/api/support-tickets", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; ticketNumber?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Support ticket could not be submitted.");
      }

      setSubmission({ status: "success", ticketNumber: payload.ticketNumber || "received" });
      formRef.current?.reset();
      setScreenshotLabel("");
      setMessageLength(0);
    } catch (error) {
      setSubmission({
        status: "error",
        message: error instanceof Error ? error.message : "Support ticket could not be submitted.",
      });
    }
  }

  function clearScreenshot() {
    if (fileInputRef.current) fileInputRef.current.value = "";
    setScreenshotLabel("");
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="rounded-3xl border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-4 shadow-[var(--shadow-sm)] sm:p-5">
      <div className="mb-5 flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--accent)] text-[var(--accent-contrast)] shadow-[var(--shadow-sm)]">
          <LifeBuoy className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">Submit a support ticket</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
            Include the account email and what happened. Browser details are attached automatically.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-[var(--text-primary)]">
          Account email
          <input
            name="accountEmail"
            type="email"
            autoComplete="email"
            required
            className="min-h-12 rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-primary)] px-4 text-sm font-semibold text-[var(--text-primary)] outline-none transition focus:border-[var(--accent)]"
            placeholder="you@example.com"
          />
        </label>

        <label className="grid gap-2 text-sm font-semibold text-[var(--text-primary)]">
          Priority
          <select
            name="priority"
            defaultValue="normal"
            className="min-h-12 rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-primary)] px-4 text-sm font-semibold text-[var(--text-primary)] outline-none transition focus:border-[var(--accent)]"
          >
            {supportPriorities.map((priority) => (
              <option key={priority.value} value={priority.value}>
                {priority.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-4 grid gap-2 text-sm font-semibold text-[var(--text-primary)]">
        Category
        <select
          name="category"
          defaultValue="accounts"
          className="min-h-12 rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-primary)] px-4 text-sm font-semibold text-[var(--text-primary)] outline-none transition focus:border-[var(--accent)]"
        >
          {supportCategories.map((category) => (
            <option key={category.value} value={category.value}>
              {category.label}
            </option>
          ))}
        </select>
      </label>

      <label className="mt-4 grid gap-2 text-sm font-semibold text-[var(--text-primary)]">
        Message
        <textarea
          name="message"
          required
          minLength={10}
          maxLength={4000}
          rows={7}
          onChange={(event) => setMessageLength(event.currentTarget.value.length)}
          className="min-h-40 resize-none rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-primary)] px-4 py-3 text-sm font-semibold leading-6 text-[var(--text-primary)] outline-none transition focus:border-[var(--accent)]"
          placeholder="Tell us what happened, what page you were on, and what you expected."
        />
        <span className="justify-self-end text-xs font-semibold text-[var(--text-muted)]">{messageLength}/4000</span>
      </label>

      <div className="mt-4 rounded-2xl border border-dashed border-[var(--border-primary)] bg-[var(--bg-primary)]/60 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Optional screenshot</p>
            <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">PNG, JPG, WebP, or GIF. Max 2 MB. Avoid sharing passwords or private tokens.</p>
          </div>
          <label className="mesh-action mesh-action-secondary cursor-pointer px-4 text-sm">
            <ImagePlus className="h-4 w-4" aria-hidden="true" />
            Attach
            <input
              ref={fileInputRef}
              name="screenshot"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="sr-only"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                setScreenshotLabel(file ? `${file.name} (${formatBytes(file.size)})` : "");
              }}
            />
          </label>
        </div>
        {screenshotLabel && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-3 py-2 text-sm font-semibold text-[var(--text-secondary)]">
            <span className="truncate">{screenshotLabel}</span>
            <button type="button" onClick={clearScreenshot} className="rounded-full p-1 text-[var(--text-muted)] transition hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)]" aria-label="Remove screenshot">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      <input type="hidden" name="browserInfo" value={browserInfo} readOnly />

      <div className="mt-4 rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-primary)]/60 p-3 text-xs leading-5 text-[var(--text-muted)]">
        Browser info is included so support can reproduce the issue. Mesh.me does not ask for passwords, payment numbers, or government ID in this form.
      </div>

      {submission.status === "error" && (
        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm font-semibold text-[var(--danger)]" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {submission.message}
        </div>
      )}

      {submission.status === "success" && (
        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm font-semibold text-[var(--success)]" role="status">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Ticket {submission.ticketNumber} was submitted.
        </div>
      )}

      <button type="submit" disabled={submission.status === "submitting"} className="mesh-action mesh-action-primary mt-5 w-full justify-center px-5">
        <Send className="h-4 w-4" aria-hidden="true" />
        {submission.status === "submitting" ? "Submitting..." : "Submit ticket"}
      </button>
    </form>
  );
}
