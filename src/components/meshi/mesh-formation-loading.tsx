"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";
import { MeshiMascot } from "./meshi-mascot";
import { getMeshiPrefsStatic } from "@/hooks/use-meshi-preferences";

const STRAND_COUNT = 12;

/**
 * The handoff between the entry unlock animation and the mesh canvas.
 * A quiet, dark constellation that draws its strands inward toward the
 * user's own Meshi at the center — reading as one continuous morph into
 * the mesh rather than a separate, busy loading screen.
 */
export function MeshFormationLoading() {
  const prefs = useMemo(() => getMeshiPrefsStatic(), []);

  const strands = useMemo(
    () =>
      Array.from({ length: STRAND_COUNT }, (_, index) => {
        const angle = (index / STRAND_COUNT) * Math.PI * 2;
        const radius = 46;
        return {
          x: 50 + Math.cos(angle) * radius,
          y: 50 + Math.sin(angle) * radius,
          delay: index * 0.06,
        };
      }),
    [],
  );

  return (
    <div
      className="relative flex min-h-full min-w-0 flex-1 items-center justify-center overflow-hidden bg-[var(--bg-primary)]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Forming your mesh</span>

      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
      >
        {strands.map((strand, index) => (
          <g key={index}>
            <motion.line
              x1={strand.x}
              y1={strand.y}
              x2={50}
              y2={50}
              stroke="var(--accent)"
              strokeWidth={0.18}
              initial={{ opacity: 0, pathLength: 0 }}
              animate={{ opacity: [0, 0.5, 0.22], pathLength: 1 }}
              transition={{
                duration: 1.6,
                delay: strand.delay,
                repeat: Infinity,
                repeatType: "reverse",
                ease: "easeInOut",
              }}
            />
            <motion.circle
              cx={strand.x}
              cy={strand.y}
              r={0.7}
              fill="var(--accent)"
              initial={{ opacity: 0.15 }}
              animate={{ opacity: [0.15, 0.7, 0.15] }}
              transition={{
                duration: 1.8,
                delay: strand.delay,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </g>
        ))}
      </svg>

      <motion.div
        className="relative z-10"
        initial={{ opacity: 0, scale: 0.82 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        >
          <MeshiMascot
            size={104}
            mood="excited"
            color={prefs.color}
            hat={prefs.hat}
            hair={prefs.hair}
            accessory={prefs.accessory}
            eyeStyle={prefs.eye}
            badge={prefs.badge}
            outfit={prefs.outfit}
            animate
          />
        </motion.div>
      </motion.div>
    </div>
  );
}
