"use client";

import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ShieldCheck, FileText, Video, MessageSquare, Activity, Scan } from "lucide-react";
import { SettingsCard, SettingsCardHeader } from "./settings-primitives";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export function SecurityHubTab() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Array<{ createdAt: string; expiresAt: string; isCurrent: boolean }>>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [contentOverview, setContentOverview] = useState({
    postsAndPhotos: 0,
    videos: 0,
    commentsAndReplies: 0,
  });

  const otherSessionCount = useMemo(
    () => sessions.filter((item) => !item.isCurrent).length,
    [sessions],
  );

  useEffect(() => {
    const run = async () => {
      try {
        const [sessionRes, overviewRes] = await Promise.all([
          fetch("/api/account/sessions", { cache: "no-store" }),
          fetch("/api/security-hub/overview", { cache: "no-store" }),
        ]);

        if (!sessionRes.ok) {
          setSessionMessage("Could not load active sessions right now.");
          return;
        }

        if (!overviewRes.ok) {
          setSessionMessage("Could not load some security details right now.");
        }

        const sessionPayload = await sessionRes.json().catch(() => ({}));
        setSessions(sessionPayload.sessions ?? []);

        if (overviewRes.ok) {
          const overviewPayload = await overviewRes.json().catch(() => ({}));
          setContentOverview(
            overviewPayload.content ?? {
              postsAndPhotos: 0,
              videos: 0,
              commentsAndReplies: 0,
            },
          );
        }
      } catch {
        setSessionMessage("Could not load active sessions right now.");
      } finally {
        setIsLoadingSessions(false);
      }
    };
    void run();
  }, []);

  const signOutOtherSessions = async () => {
    if (otherSessionCount === 0) {
      setSessionMessage("No other sessions are active.");
      return;
    }
    setIsSigningOut(true);
    setSessionMessage(null);
    try {
      const res = await fetch("/api/account/sessions", { method: "DELETE" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSessionMessage(payload.error || "Could not sign out other sessions.");
        setIsSigningOut(false);
        return;
      }
      setSessionMessage(`Signed out ${payload.deletedCount} other session${payload.deletedCount === 1 ? "" : "s"}.`);
      setSessions((prev) => prev.filter((item) => item.isCurrent));
    } catch {
      setSessionMessage("Could not sign out other sessions.");
    } finally {
      setIsSigningOut(false);
    }
  };

  const requestDataExport = async () => {
    setIsExporting(true);
    setExportMessage(null);
    try {
      const res = await fetch("/api/account/export", { method: "GET" });
      if (!res.ok) {
        setExportMessage("Could not generate data export right now.");
        setIsExporting(false);
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition");
      const filenameMatch = disposition?.match(/filename=\"?([^\";]+)\"?/i);
      const filename = filenameMatch?.[1] || "meshme-export.json";

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setExportMessage("Your data export is downloading.");
    } catch {
      setExportMessage("Could not generate data export right now.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="h-5 w-5" style={{ color: "var(--accent)" }} />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Security Hub</h2>
        </div>
        <p className="text-sm text-[var(--text-muted)]">
          Manage and remove your content across all connected platforms from one place.
        </p>
      </div>

      {/* Cross-platform content management */}
      <SettingsCard>
        <SettingsCardHeader
          title="Content Management"
          icon={<FileText className="h-4 w-4" style={{ color: "var(--accent)" }} />}
          description="Delete posts, comments, videos, or entire channels across your connected platforms directly from mesh.me."
        />
        <div className="space-y-3">
          {[
            { icon: FileText, label: "Posts & Photos", desc: "Review and delete posts across platforms", count: contentOverview.postsAndPhotos, href: "/content-hub?tab=posts" },
            { icon: Video, label: "Videos", desc: "Manage uploaded videos on YouTube, TikTok, etc.", count: contentOverview.videos, href: "/content-hub?tab=posts&postType=video" },
            { icon: MessageSquare, label: "Comments & Replies", desc: "Find and remove your comments anywhere", count: contentOverview.commentsAndReplies, href: "/content-hub?tab=control&action=deleteComment" },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              className="w-full flex items-center gap-3 p-3 rounded-xl glass-surface hover:border-[var(--glass-border)] transition-all text-left group"
              onClick={() => router.push(item.href)}
            >
              <div className="h-9 w-9 rounded-lg bg-[var(--accent-subtle)] flex items-center justify-center flex-shrink-0">
                <item.icon className="h-4 w-4" style={{ color: "var(--accent)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-[var(--text-primary)] block">{item.label}</span>
                <span className="text-xs text-[var(--text-muted)]">{item.desc}</span>
              </div>
              <span className="text-xs text-[var(--text-muted)]">{item.count}</span>
            </button>
          ))}
        </div>
      </SettingsCard>

      {/* Active sessions */}
      <SettingsCard>
        <SettingsCardHeader title="Active Sessions" icon={<Activity className="h-4 w-4" style={{ color: "var(--accent)" }} />} />
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 rounded-xl glass-surface">
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              <div>
                <span className="text-sm text-[var(--text-primary)] block">Current session</span>
                <span className="text-xs text-[var(--text-muted)]">This device &middot; Active now</span>
              </div>
            </div>
            <span className="text-xs text-emerald-400 font-medium">Current</span>
          </div>
          {!isLoadingSessions && otherSessionCount > 0 && (
            <p className="text-xs text-[var(--text-muted)] px-1">
              {otherSessionCount} other active session{otherSessionCount === 1 ? "" : "s"}.
            </p>
          )}
          {isLoadingSessions && <p className="text-xs text-[var(--text-muted)] px-1">Loading session status...</p>}
          {sessionMessage && <p className="text-xs text-[var(--text-muted)] px-1">{sessionMessage}</p>}
        </div>
        <Button variant="secondary" size="sm" className="mt-3 w-full" onClick={() => void signOutOtherSessions()} disabled={isSigningOut || isLoadingSessions}>
          {isSigningOut ? "Signing out..." : "Sign out all other sessions"}
        </Button>
      </SettingsCard>

      {/* Data export */}
      <SettingsCard>
        <SettingsCardHeader
          title="Data Export"
          icon={<Scan className="h-4 w-4" style={{ color: "var(--accent)" }} />}
          description="Download a complete copy of all your mesh.me data including posts, messages, and account info."
          className="mb-3"
        />
        <Button variant="secondary" size="sm" disabled={isExporting} onClick={() => void requestDataExport()}>
          {isExporting ? "Preparing export..." : "Download data export"}
        </Button>
        {exportMessage && <p className="mt-2 text-xs text-[var(--text-muted)]">{exportMessage}</p>}
      </SettingsCard>
    </motion.div>
  );
}
