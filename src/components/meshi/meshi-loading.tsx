"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

/**
 * Continuity loading states.
 * The global Meshi companion stays mounted at the root, so loading UI uses
 * neutral signals instead of rendering a second Meshi body.
 */

interface MeshiLoadingProps {
  message?: string;
  fullScreen?: boolean;
  size?: number;
}

const LOADING_TIPS = [
  "Meshi is synchronizing your mesh context",
  "Meshi is preparing your personalized workspace",
  "Meshi is validating fresh updates",
  "Meshi is optimizing your next view",
  "Meshi is aligning your live signals",
];

function MeshiContinuityPulse({ size = 48 }: { size?: number }) {
  return (
    <motion.div
      data-meshi-continuity-pulse="true"
      className="relative inline-flex items-center justify-center rounded-full"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <motion.span
        className="absolute inset-0 rounded-full border border-[var(--accent)]/35"
        animate={{ scale: [0.88, 1.18, 0.88], opacity: [0.75, 0.12, 0.75] }}
        transition={{ duration: 1.7, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.span
        className="absolute inset-[18%] rounded-full bg-[var(--accent)]/18"
        animate={{ scale: [1, 0.72, 1], opacity: [0.42, 0.78, 0.42] }}
        transition={{ duration: 1.7, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.span
        className="relative block rounded-full bg-[var(--accent)] shadow-[0_0_22px_var(--accent)]"
        style={{ width: Math.max(8, size * 0.18), height: Math.max(8, size * 0.18) }}
        animate={{ y: [0, -2, 0] }}
        transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
      />
    </motion.div>
  );
}

export function MeshiLoading({ message = "Loading...", fullScreen = false, size = 48 }: MeshiLoadingProps) {
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
        animate={{ y: [0, -8, 0], rotate: [0, 5, -5, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        <MeshiContinuityPulse size={size} />
      </motion.div>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-sm text-[var(--text-muted)] font-medium"
      >
        {message}
        {dots}
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

interface MeshiFunLoadingScreenProps {
  title: string;
  subtitle?: string;
  className?: string;
  mode?: "default" | "mesh-building" | "message-writing" | "secure" | "search" | "social" | "creator";
  steps?: string[];
  progressLabel?: string;
}

const LOADING_MODES: Record<
  NonNullable<MeshiFunLoadingScreenProps["mode"]>,
  {
    tips: string[];
  }
> = {
  default: {
    tips: LOADING_TIPS,
  },
  "mesh-building": {
    tips: [
      "Meshi is building connection pathways",
      "Meshi is mapping nodes with precision",
      "Meshi is balancing your network topology",
      "Meshi is validating graph integrity",
    ],
  },
  "message-writing": {
    tips: [
      "Meshi is organizing your conversation threads",
      "Meshi is indexing recent message history",
      "Meshi is preparing smart reply context",
      "Meshi is syncing your inbox status",
    ],
  },
  secure: {
    tips: [
      "Meshi is checking permissions without exposing private details",
      "Meshi is keeping the handoff privacy-first",
      "Meshi is preparing only what this page needs",
      "Meshi is keeping sensitive controls close",
    ],
  },
  search: {
    tips: [
      "Meshi is sorting the strongest matches first",
      "Meshi is keeping your search context clean",
      "Meshi is preparing results you can act on",
      "Meshi is checking people, posts, and shared spaces",
    ],
  },
  social: {
    tips: [
      "Meshi is lining up the people and posts you care about",
      "Meshi is keeping reactions and context together",
      "Meshi is preparing a smooth social handoff",
      "Meshi is syncing the latest visible activity",
    ],
  },
  creator: {
    tips: [
      "Meshi is preparing creator tools without the clutter",
      "Meshi is staging drafts, signals, and controls",
      "Meshi is organizing the workspace around action",
      "Meshi is keeping publishing context ready",
    ],
  },
};

export function MeshiFunLoadingScreen({
  title,
  subtitle = "Meshi is preparing this workspace.",
  className = "",
  mode = "default",
  steps,
  progressLabel = "Loaded",
}: MeshiFunLoadingScreenProps) {
  const [dots, setDots] = useState("");
  const [tipIndex, setTipIndex] = useState(0);
  const [activeStep, setActiveStep] = useState(0);
  const selectedMode = LOADING_MODES[mode];
  const loadingSteps = useMemo(
    () =>
      steps && steps.length > 0
        ? steps
        : [
            "Initializing",
            "Fetching records",
            "Hydrating interface",
            "Finalizing state",
          ],
    [steps],
  );

  useEffect(() => {
    const dotTimer = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "" : d + "."));
    }, 360);

    const tipTimer = setInterval(() => {
      setTipIndex((i) => (i + 1) % selectedMode.tips.length);
    }, 2200);

    const stepTimer = setInterval(() => {
      setActiveStep((i) => {
        if (i >= loadingSteps.length - 1) {
          return i;
        }
        return i + 1;
      });
    }, 900);

    return () => {
      clearInterval(dotTimer);
      clearInterval(tipTimer);
      clearInterval(stepTimer);
    };
  }, [loadingSteps.length, selectedMode.tips.length]);

  const progressPercent = ((activeStep + 1) / loadingSteps.length) * 100;

  return (
    <div className={`max-w-3xl mx-auto px-4 py-10 flex flex-col items-center text-center ${className}`}>
      <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-3 py-1 text-xs font-medium text-[var(--text-muted)] mb-5">
        <span>{title}</span>
        <span aria-hidden>-</span>
        <span>{progressLabel} {activeStep + 1}/{loadingSteps.length}</span>
      </div>

      <div className="rounded-2xl p-4 border border-[var(--border-primary)] bg-[var(--bg-secondary)] shadow-lg shadow-black/5 mb-4">
        <motion.div
          animate={{ y: [0, -8, 0], rotate: [0, 5, -5, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        >
          <MeshiContinuityPulse size={72} />
        </motion.div>
      </div>

      <h2 className="text-xl sm:text-2xl font-semibold text-[var(--text-primary)] mb-2">{title}</h2>
      <p className="text-sm text-[var(--text-muted)] mb-4">{subtitle}</p>

      <div className="w-full rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4 mb-4 text-left">
        <div className="mb-3 flex items-center justify-between text-xs text-[var(--text-muted)]">
          <span>Progress</span>
          <span>{Math.round(progressPercent)}%</span>
        </div>
        <div className="h-2 rounded-full bg-[var(--bg-primary)] overflow-hidden mb-4">
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
                <span
                  className={
                    isComplete || isActive ? "text-[var(--text-primary)] font-medium" : "text-[var(--text-muted)]"
                  }
                >
                  {step}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="text-sm font-medium text-[var(--text-secondary)] min-h-[1.5rem]">
        {selectedMode.tips[tipIndex]}
        {dots}
      </p>
    </div>
  );
}

/** Page transition loading overlay - keeps the single root Meshi as the only Meshi body. */
export function MeshiPageTransition({ isTransitioning }: { isTransitioning: boolean }) {
  if (!isTransitioning) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[90] pointer-events-none flex items-center justify-center"
    >
      <motion.div
        animate={{
          scale: [1, 1.12, 0.96, 1],
          opacity: [0.7, 1, 0.7],
        }}
        transition={{ duration: 0.8, ease: "easeInOut" }}
      >
        <MeshiContinuityPulse size={44} />
      </motion.div>
    </motion.div>
  );
}

/** Inline Meshi spinner for buttons/forms */
export function MeshiSpinner({ size = 20 }: { size?: number }) {
  return (
    <motion.div
      animate={{ rotate: [0, 10, -10, 0] }}
      transition={{ duration: 0.8, repeat: Infinity }}
      className="inline-flex"
    >
      <MeshiContinuityPulse size={size} />
    </motion.div>
  );
}
