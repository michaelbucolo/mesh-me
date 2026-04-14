"use client";

import { motion } from "framer-motion";
import { MeshiMascot } from "./meshi-mascot";
import { useEffect, useState } from "react";
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

  return (
    <div className="flex items-center justify-center py-12">
      {content}
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
