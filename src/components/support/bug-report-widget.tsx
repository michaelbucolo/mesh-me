"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Bug, CheckCircle2, Send, X } from "lucide-react";
import { meshAppVersion } from "@/lib/app-info";

type Diagnostics = {
  pageUrl: string;
  deviceType: string;
  browser: string;
  screenSize: string;
  appVersion: string;
  userAgent: string;
};

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; reportNumber: string }
  | { status: "error"; message: string };

const BUG_REPORT_EVENT = "mesh:open-bug-report";

function detectBrowser(userAgent: string) {
  if (/Edg\//.test(userAgent)) return "Microsoft Edge";
  if (/OPR\//.test(userAgent) || /Opera/.test(userAgent)) return "Opera";
  if (/Firefox\//.test(userAgent)) return "Firefox";
  if (/SamsungBrowser\//.test(userAgent)) return "Samsung Internet";
  if (/Chrome\//.test(userAgent) || /CriOS\//.test(userAgent)) return "Chrome";
  if (/Safari\//.test(userAgent)) return "Safari";
  return "Unknown browser";
}

function detectDeviceType(userAgent: string) {
  const width = window.innerWidth;
  const hasTouch = navigator.maxTouchPoints > 0;

  if (/Quest|VR|XR/i.test(userAgent)) return "XR headset";
  if (/iPad|Tablet|Android(?!.*Mobile)/i.test(userAgent)) return "Tablet";
  if (/Mobi|iPhone|Android/i.test(userAgent)) return "Mobile";
  if (hasTouch && width >= 768 && width <= 1366) return "Tablet";
  return "Desktop";
}

function collectDiagnostics(): Diagnostics {
  const userAgent = navigator.userAgent;
  return {
    pageUrl: window.location.href,
    deviceType: detectDeviceType(userAgent),
    browser: detectBrowser(userAgent),
    screenSize: `${window.screen.width}x${window.screen.height} screen, ${window.innerWidth}x${window.innerHeight} viewport, ${window.devicePixelRatio || 1}x DPR`,
    appVersion: meshAppVersion,
    userAgent,
  };
}

export function BugReportWidget() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>({ status: "idle" });

  const openWidget = useCallback(() => {
    setDiagnostics(collectDiagnostics());
    setSubmitState({ status: "idle" });
    setOpen(true);
  }, []);

  useEffect(() => {
    window.addEventListener(BUG_REPORT_EVENT, openWidget);
    return () => window.removeEventListener(BUG_REPORT_EVENT, openWidget);
  }, [openWidget]);

  async function submitBugReport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const currentDiagnostics = collectDiagnostics();
    setDiagnostics(currentDiagnostics);
    setSubmitState({ status: "submitting" });

    try {
      const response = await fetch("/api/bug-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          message,
          contactEmail,
          ...currentDiagnostics,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; reportNumber?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Bug report could not be submitted.");
      }

      setSubmitState({ status: "success", reportNumber: payload.reportNumber || "received" });
      setMessage("");
    } catch (error) {
      setSubmitState({
        status: "error",
        message: error instanceof Error ? error.message : "Bug report could not be submitted.",
      });
    }
  }

  const details = diagnostics ?? (typeof window !== "undefined" ? collectDiagnostics() : null);

  return (
    <div className="bug-report-widget pointer-events-none fixed z-[90] flex flex-col items-end gap-3">
      {open && (
        <section className="pointer-events-auto w-[min(24rem,calc(100vw-1.5rem))] rounded-3xl border border-[var(--glass-card-border)] bg-[var(--bg-secondary)]/96 p-4 text-[var(--text-primary)] shadow-[var(--shadow-md)] backdrop-blur-xl" aria-label="Report a bug">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-2xl bg-[var(--accent)] text-white">
                <Bug className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-base font-black">Report a bug</h2>
                <p className="text-xs text-[var(--text-muted)]">Diagnostics are attached automatically.</p>
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-full p-2 text-[var(--text-muted)] transition hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)]" aria-label="Close bug report">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <form onSubmit={submitBugReport} className="mt-4 space-y-3">
            <label className="grid gap-2 text-sm font-black">
              What happened?
              <textarea
                value={message}
                onChange={(event) => setMessage(event.currentTarget.value)}
                required
                minLength={8}
                maxLength={2000}
                rows={4}
                className="resize-none rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-primary)] px-3 py-2 text-sm font-semibold leading-6 outline-none transition focus:border-[var(--accent)]"
                placeholder="Briefly describe the broken behavior."
              />
            </label>

            <label className="grid gap-2 text-sm font-black">
              Email, optional
              <input
                value={contactEmail}
                onChange={(event) => setContactEmail(event.currentTarget.value)}
                type="email"
                autoComplete="email"
                className="min-h-11 rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-primary)] px-3 text-sm font-semibold outline-none transition focus:border-[var(--accent)]"
                placeholder="you@example.com"
              />
            </label>

            {details && (
              <dl className="grid gap-1 rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-primary)]/62 p-3 text-xs leading-5 text-[var(--text-secondary)]">
                <div className="flex justify-between gap-3">
                  <dt className="font-black text-[var(--text-primary)]">Page</dt>
                  <dd className="truncate text-right">{details.pageUrl}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="font-black text-[var(--text-primary)]">Device</dt>
                  <dd>{details.deviceType}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="font-black text-[var(--text-primary)]">Browser</dt>
                  <dd>{details.browser}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="font-black text-[var(--text-primary)]">Screen</dt>
                  <dd className="text-right">{details.screenSize}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="font-black text-[var(--text-primary)]">Version</dt>
                  <dd>{details.appVersion}</dd>
                </div>
              </dl>
            )}

            {submitState.status === "error" && (
              <p className="flex items-start gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm font-semibold text-red-500" role="alert">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {submitState.message}
              </p>
            )}

            {submitState.status === "success" && (
              <p className="flex items-start gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-600" role="status">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                Bug {submitState.reportNumber} was submitted.
              </p>
            )}

            <button type="submit" disabled={submitState.status === "submitting"} className="mesh-action mesh-action-primary w-full justify-center px-4 text-sm">
              <Send className="h-4 w-4" aria-hidden="true" />
              {submitState.status === "submitting" ? "Sending..." : "Send report"}
            </button>
          </form>
        </section>
      )}

      <button type="button" onClick={open ? () => setOpen(false) : openWidget} className="pointer-events-auto mesh-action mesh-action-secondary rounded-full px-4 text-sm shadow-[var(--shadow-md)]">
        <Bug className="h-4 w-4" aria-hidden="true" />
        Report a bug
      </button>
    </div>
  );
}
