"use client";

import { motion } from "framer-motion";
import { MeshiMascot, type MeshiHat, type MeshiMood, type MeshiProp } from "./meshi-mascot";
import { useEffect, useMemo, useState } from "react";
import { useMeshiPreferences } from "@/hooks/use-meshi-preferences";

/**
 * Custom Meshi Loading Screen
 * Shows the user's personalized Meshi during loading states and page transitions.
 * Only shows the USER's custom Meshi — other users' Meshi only appears on their meshes.
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

const PLAYFUL_MOODS: MeshiMood[] = ["thinking", "excited", "giggle", "wink", "celebrating", "love"];
const PLAYFUL_PROPS: MeshiProp[] = ["none", "compass", "magnifying-glass", "heart", "clipboard"];

export function MeshiLoading({ message = "Loading...", fullScreen = false, size = 48 }: MeshiLoadingProps) {
  const { color, hat } = useMeshiPreferences();
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
        <MeshiMascot size={size} mood="thinking" color={color} hat={hat} showGlow animate />
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
  mode?: "default" | "mesh-building" | "message-writing";
  steps?: string[];
  progressLabel?: string;
}

const LOADING_MODES: Record<
  NonNullable<MeshiFunLoadingScreenProps["mode"]>,
  {
    tips: string[];
    moods: MeshiMood[];
    props: MeshiProp[];
    hatOverride?: MeshiHat;
  }
> = {
  default: {
    tips: LOADING_TIPS,
    moods: PLAYFUL_MOODS,
    props: PLAYFUL_PROPS,
  },
  "mesh-building": {
    tips: [
      "Meshi is building connection pathways",
      "Meshi is mapping nodes with precision",
      "Meshi is balancing your network topology",
      "Meshi is validating graph integrity",
    ],
    moods: ["thinking", "excited", "celebrating", "learning"],
    props: ["wrench", "clipboard", "compass"],
    hatOverride: "hardhat",
  },
  "message-writing": {
    tips: [
      "Meshi is organizing your conversation threads",
      "Meshi is indexing recent message history",
      "Meshi is preparing smart reply context",
      "Meshi is syncing your inbox status",
    ],
    moods: ["thinking", "love", "wink", "giggle"],
    props: ["notebook", "clipboard", "heart"],
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
  const { color, hat } = useMeshiPreferences();
  const [dots, setDots] = useState("");
  const [tipIndex, setTipIndex] = useState(0);
  const [moodIndex, setMoodIndex] = useState(0);
  const [propIndex, setPropIndex] = useState(0);
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

    const moodTimer = setInterval(() => {
      setMoodIndex((i) => (i + 1) % selectedMode.moods.length);
      setPropIndex((i) => (i + 1) % selectedMode.props.length);
    }, 2600);

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
      clearInterval(moodTimer);
      clearInterval(stepTimer);
    };
  }, [loadingSteps.length, selectedMode.moods.length, selectedMode.props.length, selectedMode.tips.length]);

  const progressPercent = ((activeStep + 1) / loadingSteps.length) * 100;

  return (
    <div className={`max-w-3xl mx-auto px-4 py-10 flex flex-col items-center text-center ${className}`}>
      <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-3 py-1 text-xs font-medium text-[var(--text-muted)] mb-5">
        <span>{title}</span>
        <span aria-hidden>•</span>
        <span>{progressLabel} {activeStep + 1}/{loadingSteps.length}</span>
      </div>

      <div className="rounded-3xl p-4 border border-[var(--border-primary)] bg-[var(--bg-secondary)] shadow-lg shadow-black/5 mb-4">
        <motion.div
          animate={{ y: [0, -8, 0], rotate: [0, 5, -5, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        >
          <MeshiMascot
            size={92}
            mood={selectedMode.moods[moodIndex]}
            color={color}
            hat={selectedMode.hatOverride || hat}
            prop={selectedMode.props[propIndex]}
            showGlow
            animate
          />
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
                  {isComplete ? "✓" : index + 1}
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

/** Page transition loading overlay — shows custom Meshi bouncing */
export function MeshiPageTransition({ isTransitioning }: { isTransitioning: boolean }) {
  const { color, hat } = useMeshiPreferences();

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
          x: [0, 100, -80, 60, -40, 0],
          y: [0, -40, 20, -60, 30, 0],
          scale: [1, 1.1, 0.9, 1.1, 0.95, 1],
        }}
        transition={{ duration: 0.8, ease: "easeInOut" }}
      >
        <MeshiMascot size={48} mood="excited" color={color} hat={hat} showGlow />
      </motion.div>
    </motion.div>
  );
}

/** Inline Meshi spinner for buttons/forms */
export function MeshiSpinner({ size = 20 }: { size?: number }) {
  const { color } = useMeshiPreferences();

  return (
    <motion.div
      animate={{ rotate: [0, 10, -10, 0] }}
      transition={{ duration: 0.8, repeat: Infinity }}
      className="inline-flex"
    >
      <MeshiMascot size={size} mood="thinking" color={color} hat="none" showGlow={false} animate={false} />
    </motion.div>
  );
}
