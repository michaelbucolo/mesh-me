/**
 * React hook for iOS keyboard avoidance.
 * Tracks keyboard visibility and height so components can
 * adjust their layout when the software keyboard appears.
 */

"use client";

import { useState, useEffect } from "react";
import { onKeyboardChange } from "@/lib/native/keyboard";

export function useKeyboard() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    let cleanup: (() => void) | null = null;

    onKeyboardChange(
      (info) => {
        setKeyboardHeight(info.keyboardHeight);
        setIsKeyboardVisible(true);
      },
      () => {
        setKeyboardHeight(0);
        setIsKeyboardVisible(false);
      }
    ).then((fn) => {
      cleanup = fn;
    });

    return () => {
      cleanup?.();
    };
  }, []);

  return { keyboardHeight, isKeyboardVisible };
}
