"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, LucideIcon } from "lucide-react";

interface WelcomeBannerProps {
  /** Unique key for localStorage persistence */
  storageKey: string;
  icon: LucideIcon;
  title: string;
  description: string;
  tips?: string[];
  /** Accent color for the icon background */
  accentColor?: string;
  /** Optional CTA */
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function WelcomeBanner({
  storageKey,
  icon: Icon,
  title,
  description,
  tips,
  accentColor,
  action,
}: WelcomeBannerProps) {
  // Start dismissed (hidden) to match SSR, then check localStorage after mount
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(`welcome-dismissed-${storageKey}`);
    if (stored !== "true") queueMicrotask(() => setDismissed(false));
  }, [storageKey]);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(`welcome-dismissed-${storageKey}`, "true");
  };

  return (
    <AnimatePresence>
      {!dismissed && <motion.div
        initial={{ opacity: 0, y: -10, height: 0 }}
        animate={{ opacity: 1, y: 0, height: "auto" }}
        exit={{ opacity: 0, y: -10, height: 0 }}
        className="mb-6 overflow-hidden"
      >
        <div
          className="relative rounded-2xl p-4 md:p-5"
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border-primary)",
          }}
        >
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 p-1.5 rounded-lg transition-colors hover:bg-[var(--bg-tertiary)]"
            style={{ color: "var(--text-muted)" }}
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex gap-4 items-start">
            <div
              className="flex-shrink-0 h-10 w-10 rounded-xl flex items-center justify-center"
              style={{
                background: accentColor
                  ? `${accentColor}15`
                  : "var(--accent-subtle)",
                color: accentColor || "var(--accent)",
              }}
            >
              <Icon className="h-5 w-5" />
            </div>

            <div className="flex-1 min-w-0 pr-6">
              <h3
                className="text-sm font-semibold mb-1"
                style={{ color: "var(--text-primary)" }}
              >
                {title}
              </h3>
              <p
                className="text-xs leading-relaxed mb-2"
                style={{ color: "var(--text-tertiary)" }}
              >
                {description}
              </p>

              {tips && tips.length > 0 && (
                <ul className="space-y-1.5 mb-3">
                  {tips.map((tip, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-xs"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      <span
                        className="flex-shrink-0 mt-0.5 h-4 w-4 rounded-full flex items-center justify-center text-[9px] font-bold"
                        style={{
                          background: accentColor
                            ? `${accentColor}20`
                            : "var(--accent-muted)",
                          color: accentColor || "var(--accent)",
                        }}
                      >
                        {i + 1}
                      </span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex items-center gap-3">
                {action && (
                  <button
                    onClick={action.onClick}
                    className="text-xs font-medium transition-colors"
                    style={{ color: "var(--accent)" }}
                  >
                    {action.label}
                  </button>
                )}
                <button
                  onClick={handleDismiss}
                  className="text-xs transition-colors"
                  style={{ color: "var(--text-muted)" }}
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>}
    </AnimatePresence>
  );
}
