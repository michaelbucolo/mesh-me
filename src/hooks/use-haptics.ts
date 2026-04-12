/**
 * React hook for native haptic feedback.
 * Returns stable callbacks that are safe to use in event handlers.
 * On web, all callbacks are silent no-ops.
 */

"use client";

import { useCallback } from "react";
import { impactFeedback, notificationFeedback, selectionFeedback } from "@/lib/native/haptics";

export function useHaptics() {
  const tapHaptic = useCallback(() => {
    impactFeedback("LIGHT");
  }, []);

  const pressHaptic = useCallback(() => {
    impactFeedback("MEDIUM");
  }, []);

  const heavyHaptic = useCallback(() => {
    impactFeedback("HEAVY");
  }, []);

  const successHaptic = useCallback(() => {
    notificationFeedback("SUCCESS");
  }, []);

  const warningHaptic = useCallback(() => {
    notificationFeedback("WARNING");
  }, []);

  const errorHaptic = useCallback(() => {
    notificationFeedback("ERROR");
  }, []);

  const selectionHaptic = useCallback(() => {
    selectionFeedback();
  }, []);

  return {
    tapHaptic,
    pressHaptic,
    heavyHaptic,
    successHaptic,
    warningHaptic,
    errorHaptic,
    selectionHaptic,
  };
}
