"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface TooltipProps {
  children: React.ReactNode;
  content: string;
  /** Position of the tooltip relative to the trigger */
  position?: "top" | "bottom" | "left" | "right";
  /** Delay before showing (ms) */
  delay?: number;
  /** Only show tooltip once (persisted via localStorage) */
  showOnce?: boolean;
  /** Unique key for localStorage persistence (required when showOnce is true) */
  storageKey?: string;
}

export function Tooltip({
  children,
  content,
  position = "top",
  delay = 300,
  showOnce = false,
  storageKey,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (showOnce && storageKey) {
      const seen = localStorage.getItem(`tooltip-${storageKey}`);
      if (seen === "true") setDismissed(true);
    }
  }, [showOnce, storageKey]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    if (dismissed) return;
    timeoutRef.current = setTimeout(() => setVisible(true), delay);
  };

  const hide = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setVisible(false);
    if (showOnce && storageKey) {
      setDismissed(true);
      localStorage.setItem(`tooltip-${storageKey}`, "true");
    }
  };

  const positionClasses: Record<string, string> = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  const motionOrigin: Record<string, { initial: Record<string, number>; animate: Record<string, number> }> = {
    top: { initial: { opacity: 0, y: 4 }, animate: { opacity: 1, y: 0 } },
    bottom: { initial: { opacity: 0, y: -4 }, animate: { opacity: 1, y: 0 } },
    left: { initial: { opacity: 0, x: 4 }, animate: { opacity: 1, x: 0 } },
    right: { initial: { opacity: 0, x: -4 }, animate: { opacity: 1, x: 0 } },
  };

  return (
    <div className="relative inline-flex" onMouseEnter={dismissed ? undefined : show} onMouseLeave={dismissed ? undefined : hide} onFocus={dismissed ? undefined : show} onBlur={dismissed ? undefined : hide}>
      {children}
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={motionOrigin[position].initial}
            animate={motionOrigin[position].animate}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className={`absolute z-50 ${positionClasses[position]} pointer-events-none`}
          >
            <div
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap shadow-lg"
              style={{
                background: "var(--bg-elevated)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-primary)",
              }}
            >
              {content}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
