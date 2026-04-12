/**
 * Pull-to-refresh component for iOS native feel.
 * Wraps page content and enables pull-down-to-refresh gesture
 * that triggers a full page reload or custom callback.
 */

"use client";

import { useCallback, useRef, useState } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { impactFeedback } from "@/lib/native/haptics";

interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh?: () => Promise<void>;
  threshold?: number;
  className?: string;
}

export function PullToRefresh({
  children,
  onRefresh,
  threshold = 80,
  className = "",
}: PullToRefreshProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const pullDistance = useMotionValue(0);
  const opacity = useTransform(pullDistance, [0, threshold], [0, 1]);
  const scale = useTransform(pullDistance, [0, threshold], [0.5, 1]);
  const rotate = useTransform(pullDistance, [0, threshold * 2], [0, 360]);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (isRefreshing) return;
      // Only activate when scrolled to top
      const scrollTop =
        document.documentElement.scrollTop || document.body.scrollTop;
      if (scrollTop <= 0) {
        startY.current = e.touches[0].clientY;
      }
    },
    [isRefreshing]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (isRefreshing || startY.current === 0) return;
      const currentY = e.touches[0].clientY;
      const diff = Math.max(0, currentY - startY.current);
      // Apply resistance — harder to pull the further you go
      const dampened = diff * 0.5;
      pullDistance.set(dampened);
    },
    [isRefreshing, pullDistance]
  );

  const handleTouchEnd = useCallback(async () => {
    if (isRefreshing) return;
    const distance = pullDistance.get();

    if (distance >= threshold) {
      setIsRefreshing(true);
      impactFeedback("MEDIUM");

      if (onRefresh) {
        await onRefresh();
      } else {
        window.location.reload();
      }
      setIsRefreshing(false);
    }

    pullDistance.set(0);
    startY.current = 0;
  }, [isRefreshing, onRefresh, pullDistance, threshold]);

  return (
    <div
      className={className}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <motion.div
        className="pointer-events-none flex items-center justify-center overflow-hidden"
        style={{
          height: pullDistance,
          opacity,
        }}
      >
        <motion.div
          style={{ scale, rotate: isRefreshing ? undefined : rotate }}
          className={isRefreshing ? "animate-spin" : ""}
        >
          <RefreshCw className="h-5 w-5 text-[var(--accent)]" />
        </motion.div>
      </motion.div>

      {children}
    </div>
  );
}
