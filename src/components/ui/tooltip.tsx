"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface TooltipProps {
  children: React.ReactNode;
  content: string;
  position?: "top" | "bottom" | "left" | "right";
  delay?: number;
  showOnce?: boolean;
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
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    if (!showOnce || !storageKey) return false;
    return localStorage.getItem(`tooltip-${storageKey}`) === "true";
  });
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    if (dismissed) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setVisible(true), delay);
  };

  const hide = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (showOnce && storageKey && visible) {
      setDismissed(true);
      localStorage.setItem(`tooltip-${storageKey}`, "true");
    }
    setVisible(false);
  };

  const positionClasses: Record<string, string> = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  const motionOrigin: Record<
    string,
    { initial: Record<string, number>; animate: Record<string, number> }
  > = {
    top: { initial: { opacity: 0, y: 4 }, animate: { opacity: 1, y: 0 } },
    bottom: { initial: { opacity: 0, y: -4 }, animate: { opacity: 1, y: 0 } },
    left: { initial: { opacity: 0, x: 4 }, animate: { opacity: 1, x: 0 } },
    right: { initial: { opacity: 0, x: -4 }, animate: { opacity: 1, x: 0 } },
  };

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={dismissed ? undefined : show}
      onMouseLeave={dismissed ? undefined : hide}
      onFocus={dismissed ? undefined : show}
      onBlur={dismissed ? undefined : hide}
    >
      {children}
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={motionOrigin[position].initial}
            animate={motionOrigin[position].animate}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className={`absolute z-50 ${positionClasses[position]} pointer-events-none`}
          >
            <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-primary)] shadow-lg whitespace-nowrap">
              {content}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
