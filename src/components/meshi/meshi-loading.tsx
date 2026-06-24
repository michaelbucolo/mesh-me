"use client";

import { motion } from "framer-motion";
import { MeshiMascot, type MeshiMood, type MeshiProp } from "./meshi-mascot";
import { useEffect, useMemo, useState } from "react";

// ── Simple loading (inline/fullscreen) ───────────────────────

interface MeshiLoadingProps {
  message?: string;
  fullScreen?: boolean;
  size?: number;
}

export function MeshiLoading({ message = "Loading", fullScreen = false, size = 48 }: MeshiLoadingProps) {
  const [dots, setDots] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "" : d + "."));
    }, 400);
    return () => clearInterval(interval);
  }, []);

  const content = (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center gap-3"
    >
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
      >
        <MeshiMascot size={size} mood="happy" prop="none" animate bouncy />
      </motion.div>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-sm font-medium text-[var(--mesh-text-muted,var(--text-muted))]"
      >
        {message}{dots}
      </motion.p>
    </motion.div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
        {content}
      </div>
    );
  }

  return <div className="flex items-center justify-center py-12">{content}</div>;
}

// ── Fun loading screen (used by route loading personalities) ─

interface MeshiFunLoadingScreenProps {
  title: string;
  subtitle?: string;
  className?: string;
  mode?: "default" | "mesh-building" | "message-writing" | "secure" | "search" | "social" | "creator";
  steps?: string[];
  progressLabel?: string;
}

const MODE_MESHI: Record<NonNullable<MeshiFunLoadingScreenProps["mode"]>, { mood: MeshiMood; prop: MeshiProp; tips: string[] }> = {
  default: {
    mood: "happy",
    prop: "none",
    tips: [
      "Synchronizing your mesh context",
      "Preparing your personalized workspace",
      "Validating fresh updates",
      "Optimizing your next view",
    ],
  },
  "mesh-building": {
    mood: "excited",
    prop: "compass",
    tips: [
      "Building connection pathways",
      "Mapping nodes with precision",
      "Balancing your network topology",
      "Validating graph integrity",
    ],
  },
  "message-writing": {
    mood: "love",
    prop: "envelope",
    tips: [
      "Organizing your conversation threads",
      "Indexing recent message history",
      "Preparing smart reply context",
      "Syncing your inbox status",
    ],
  },
  secure: {
    mood: "cool",
    prop: "shield",
    tips: [
      "Checking permissions securely",
      "Keeping the handoff privacy-first",
      "Preparing only what this page needs",
      "Keeping sensitive controls close",
    ],
  },
  search: {
    mood: "thinking",
    prop: "magnifying-glass",
    tips: [
      "Sorting the strongest matches first",
      "Keeping your search context clean",
      "Preparing results you can act on",
      "Checking people, posts, and shared spaces",
    ],
  },
  social: {
    mood: "excited",
    prop: "megaphone",
    tips: [
      "Lining up the people and posts you care about",
      "Keeping reactions and context together",
      "Preparing a smooth social handoff",
      "Syncing the latest visible activity",
    ],
  },
  creator: {
    mood: "happy",
    prop: "paintbrush",
    tips: [
      "Preparing creator tools without the clutter",
      "Staging drafts, signals, and controls",
      "Organizing the workspace around action",
      "Keeping publishing context ready",
    ],
  },
};

export function MeshiFunLoadingScreen({
  title,
  subtitle = "Preparing this workspace.",
  className = "",
  mode = "default",
  steps,
  progressLabel = "Loaded",
}: MeshiFunLoadingScreenProps) {
  const [dots, setDots] = useState("");
  const [tipIndex, setTipIndex] = useState(0);
  const [activeStep, setActiveStep] = useState(0);
  const modeCfg = MODE_MESHI[mode];
  const loadingSteps = useMemo(
    () =>
      steps && steps.length > 0
        ? steps
        : ["Initializing", "Fetching records", "Hydrating interface", "Finalizing state"],
    [steps],
  );

  useEffect(() => {
    const dotTimer = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "" : d + "."));
    }, 360);
    const tipTimer = setInterval(() => {
      setTipIndex((i) => (i + 1) % modeCfg.tips.length);
    }, 2200);
    const stepTimer = setInterval(() => {
      setActiveStep((i) => (i >= loadingSteps.length - 1 ? i : i + 1));
    }, 900);
    return () => {
      clearInterval(dotTimer);
      clearInterval(tipTimer);
      clearInterval(stepTimer);
    };
  }, [loadingSteps.length, modeCfg.tips.length]);

  const progressPercent = ((activeStep + 1) / loadingSteps.length) * 100;

  return (
    <div className={`mx-auto flex max-w-3xl flex-col items-center px-4 py-10 text-center ${className}`}>
      <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-3 py-1 text-xs font-medium text-[var(--text-muted)]">
        <span>{title}</span>
        <span aria-hidden>-</span>
        <span>{progressLabel} {activeStep + 1}/{loadingSteps.length}</span>
      </div>

      {/* Meshi mascot as the loading indicator */}
      <div className="mb-4 rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4 shadow-lg shadow-black/5">
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        >
          <MeshiMascot size={72} mood={modeCfg.mood} prop={modeCfg.prop} animate bouncy />
        </motion.div>
      </div>

      <h2 className="mb-2 text-xl font-semibold text-[var(--text-primary)] sm:text-2xl">{title}</h2>
      <p className="mb-4 text-sm text-[var(--text-muted)]">{subtitle}</p>

      {/* Progress */}
      <div className="mb-4 w-full rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4 text-left">
        <div className="mb-3 flex items-center justify-between text-xs text-[var(--text-muted)]">
          <span>Progress</span>
          <span>{Math.round(progressPercent)}%</span>
        </div>
        <div className="mb-4 h-2 overflow-hidden rounded-full bg-[var(--bg-primary)]">
          <motion.div
            className="h-full bg-[var(--accent)]"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>

        <ul className="space-y-2">
          {loadingSteps.map((step, index) => {
            const isComplete = index < activeStep;
            const isActive = index === activeStep;
            return (
              <li key={step} className="flex items-center gap-2 text-sm">
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-xs ${
                    isComplete
                      ? "border-[var(--accent)] text-[var(--accent)]"
                      : isActive
                        ? "border-[var(--text-secondary)] text-[var(--text-secondary)]"
                        : "border-[var(--border-primary)] text-[var(--text-muted)]"
                  }`}
                >
                  {isComplete ? "OK" : index + 1}
                </span>
                <span className={isComplete || isActive ? "font-medium text-[var(--text-primary)]" : "text-[var(--text-muted)]"}>
                  {step}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="min-h-[1.5rem] text-sm font-medium text-[var(--text-secondary)]">
        {modeCfg.tips[tipIndex]}{dots}
      </p>
    </div>
  );
}

// ── Page transition overlay ──────────────────────────────────

export function MeshiPageTransition({ isTransitioning }: { isTransitioning: boolean }) {
  if (!isTransitioning) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pointer-events-none fixed inset-0 z-[90] flex items-center justify-center"
    >
      <motion.div
        animate={{ scale: [1, 1.12, 0.96, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 0.8, ease: "easeInOut" }}
      >
        <MeshiMascot size={44} mood="happy" animate bouncy />
      </motion.div>
    </motion.div>
  );
}

// ── Inline spinner ───────────────────────────────────────────

export function MeshiSpinner({ size = 20 }: { size?: number }) {
  return (
    <motion.div
      animate={{ rotate: [0, 10, -10, 0] }}
      transition={{ duration: 0.8, repeat: Infinity }}
      className="inline-flex"
    >
      <MeshiMascot size={size} mood="thinking" animate={false} />
    </motion.div>
  );
}
