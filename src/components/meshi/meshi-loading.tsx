"use client";

import { motion } from "framer-motion";
import { MeshiMascot } from "./meshi-mascot";
import { MeshiLoader, type MeshiLoaderMode } from "./meshi-loader";
import { useEffect, useState } from "react";

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

// ── Fun loading screen ───────────────────────────────────────
// Kept as a thin compatibility wrapper: all loading now renders the unified
// constellation-weave loader (no bars, no step checklists).

interface MeshiFunLoadingScreenProps {
  title: string;
  subtitle?: string;
  className?: string;
  mode?: MeshiLoaderMode;
  steps?: string[];
  progressLabel?: string;
}

export function MeshiFunLoadingScreen({
  title,
  subtitle,
  className = "",
  mode = "default",
}: MeshiFunLoadingScreenProps) {
  return <MeshiLoader title={title} subtitle={subtitle} mode={mode} className={className} />;
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
