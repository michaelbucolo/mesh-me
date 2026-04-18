"use client";

import { motion } from "framer-motion";
import { MeshiMascot, type MeshiMood, type MeshiProp } from "./meshi-mascot";
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
  "Meshi is untangling the mesh threads",
  "Meshi is gathering your latest sparks",
  "Meshi is polishing tiny pixels",
  "Meshi is speed-running the loading realm",
  "Meshi is syncing your vibe map",
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
}

export function MeshiFunLoadingScreen({ title, subtitle = "Tap Meshi for a surprise reaction.", className = "" }: MeshiFunLoadingScreenProps) {
  const { color, hat } = useMeshiPreferences();
  const [dots, setDots] = useState("");
  const [tipIndex, setTipIndex] = useState(0);
  const [moodIndex, setMoodIndex] = useState(0);
  const [propIndex, setPropIndex] = useState(0);
  const [boostCount, setBoostCount] = useState(0);

  useEffect(() => {
    const dotTimer = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "" : d + "."));
    }, 360);

    const tipTimer = setInterval(() => {
      setTipIndex((i) => (i + 1) % LOADING_TIPS.length);
    }, 2200);

    return () => {
      clearInterval(dotTimer);
      clearInterval(tipTimer);
    };
  }, []);

  const onMeshiTap = () => {
    setMoodIndex((i) => (i + 1) % PLAYFUL_MOODS.length);
    setPropIndex((i) => (i + 1) % PLAYFUL_PROPS.length);
    setBoostCount((count) => count + 1);
  };

  const hypeLabel = useMemo(() => {
    if (boostCount >= 12) return "🚀 Hypercharged";
    if (boostCount >= 7) return "⚡ Turbo loading";
    if (boostCount >= 3) return "✨ Extra spark";
    return "🌟 Normal sparkle";
  }, [boostCount]);

  return (
    <div className={`max-w-3xl mx-auto px-4 py-10 flex flex-col items-center text-center ${className}`}>
      <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-3 py-1 text-xs text-[var(--text-muted)] mb-5">
        <span>{hypeLabel}</span>
        <span aria-hidden>•</span>
        <span>Boost taps: {boostCount}</span>
      </div>

      <motion.button
        type="button"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.92, rotate: -6 }}
        onClick={onMeshiTap}
        className="rounded-3xl p-4 border border-[var(--border-primary)] bg-[var(--bg-secondary)] shadow-lg shadow-black/5 mb-4"
        aria-label="Interact with Meshi while loading"
      >
        <motion.div
          animate={{ y: [0, -8, 0], rotate: [0, 5, -5, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        >
          <MeshiMascot
            size={92}
            mood={PLAYFUL_MOODS[moodIndex]}
            color={color}
            hat={hat}
            prop={PLAYFUL_PROPS[propIndex]}
            showGlow
            animate
          />
        </motion.div>
      </motion.button>

      <h2 className="text-xl sm:text-2xl font-semibold text-[var(--text-primary)] mb-2">{title}</h2>
      <p className="text-sm text-[var(--text-muted)] mb-2">{subtitle}</p>
      <p className="text-sm font-medium text-[var(--text-secondary)] min-h-[1.5rem]">
        {LOADING_TIPS[tipIndex]}
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
