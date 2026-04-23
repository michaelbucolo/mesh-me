"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NotificationsTabProps {
  showSuccess: (msg: string) => void;
}

const STORAGE_KEY = "mesh:notification-preferences";

interface NotificationPreferences {
  followers: boolean;
  likes: boolean;
  comments: boolean;
  messages: boolean;
  community: boolean;
  smartSummary: boolean;
}

const defaultPreferences: NotificationPreferences = {
  followers: true,
  likes: true,
  comments: true,
  messages: true,
  community: true,
  smartSummary: true,
};

export function NotificationsTab({ showSuccess }: NotificationsTabProps) {
  const [preferences, setPreferences] = useState<NotificationPreferences>(() => {
    if (typeof window === "undefined") return defaultPreferences;

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultPreferences;
      const parsed = JSON.parse(raw) as Partial<NotificationPreferences>;
      return { ...defaultPreferences, ...parsed };
    } catch {
      return defaultPreferences;
    }
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  }, [preferences]);

  const items = useMemo(
    () => [
      { id: "followers", label: "New followers", desc: "When someone follows you" },
      { id: "likes", label: "Likes on your posts", desc: "When someone likes your content" },
      { id: "comments", label: "Comments & replies", desc: "When someone comments on your posts" },
      { id: "messages", label: "Direct messages", desc: "When you receive a new message" },
      { id: "community", label: "Community activity", desc: "Updates from your communities" },
    ] as const,
    []
  );

  const togglePreference = (key: keyof NotificationPreferences) => {
    setPreferences((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Notification preferences</h2>
      <p className="text-sm text-[var(--text-muted)] mb-6">
        Choose what alerts you receive. Preferences are saved on this device.
      </p>
      <div className="space-y-1">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between py-3 border-b border-[var(--border-primary)]">
            <div>
              <span className="text-sm text-[var(--text-primary)] block font-medium">{item.label}</span>
              <span className="text-xs text-[var(--text-muted)]">{item.desc}</span>
            </div>
            <button
              type="button"
              onClick={() => togglePreference(item.id)}
              className={`relative w-11 h-6 rounded-full transition-colors ${preferences[item.id] ? "bg-[var(--accent)]" : "bg-[var(--bg-hover)]"}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${preferences[item.id] ? "right-0.5" : "left-0.5"}`} />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl p-4 glass-surface">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-4 w-4" style={{ color: "var(--accent)" }} />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Smart Notifications</h3>
        </div>
        <p className="text-xs text-[var(--text-muted)] mb-3">
          Combine high-volume activity into concise digests instead of many separate alerts.
        </p>
        <div className="flex items-center justify-between">
          <span className="text-sm text-[var(--text-secondary)]">Enable smart summaries</span>
          <button
            type="button"
            onClick={() => togglePreference("smartSummary")}
            className={`relative w-11 h-6 rounded-full transition-colors ${preferences.smartSummary ? "bg-[var(--accent)]" : "bg-[var(--bg-hover)]"}`}
          >
            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${preferences.smartSummary ? "right-0.5" : "left-0.5"}`} />
          </button>
        </div>

        <Button
          variant="secondary"
          size="sm"
          className="mt-4"
          onClick={() => {
            setPreferences(defaultPreferences);
            showSuccess("Notification preferences reset to defaults");
          }}
        >
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          Reset to defaults
        </Button>
      </div>
    </motion.div>
  );
}
