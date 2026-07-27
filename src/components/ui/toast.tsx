"use client";

import { cn } from "@/lib/utils";
import { CheckCircle, AlertCircle, Info, X } from "lucide-react";
import { useState, createContext, useContext, useCallback } from "react";

interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
  exiting?: boolean;
}

interface ToastContextType {
  addToast: (message: string, type?: "success" | "error" | "info") => void;
}

const ToastContext = createContext<ToastContextType>({ addToast: () => {} });

const TOAST_LIFETIME = 4000;
const EXIT_DURATION = 240;

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Two-step removal so the exit animation can play before the node leaves the
  // DOM: flag it as leaving, then drop it once the slide-out has finished.
  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, EXIT_DURATION);
  }, []);

  const addToast = useCallback(
    (message: string, type: "success" | "error" | "info" = "success") => {
      const id = Math.random().toString(36).slice(2);
      // Cap the queue so a burst of toasts can't stack up the corner and cover
      // tap targets — keep the three most recent.
      setToasts((prev) => [...prev, { id, message, type }].slice(-3));
      setTimeout(() => dismiss(id), TOAST_LIFETIME);
    },
    [dismiss]
  );

  const icons = {
    success: <CheckCircle className="h-4 w-4 text-emerald-300" />,
    error: <AlertCircle className="h-4 w-4 text-red-300" />,
    info: <Info className="h-4 w-4 text-[var(--accent-text)]" />,
  };

  const styles = {
    success: "border-[var(--ds-success-border)] bg-[var(--bg-elevated)] text-[var(--text-primary)]",
    error: "border-[var(--ds-danger-border)] bg-[var(--bg-elevated)] text-[var(--text-primary)]",
    info: "border-[var(--border-primary)] bg-[var(--bg-elevated)] text-[var(--text-primary)]",
  };

  // The draining timer bar picks up the toast's accent so the countdown itself
  // reads as on-brand rather than a flat grey line.
  const timerColor = {
    success: "var(--ds-success)",
    error: "var(--ds-danger)",
    info: "var(--accent)",
  };

  const closeButtonStyles = {
    success: "text-emerald-300/80 hover:text-emerald-100",
    error: "text-red-300/80 hover:text-red-100",
    info: "text-[var(--text-muted)] hover:text-[var(--text-primary)]",
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div
        className="fixed bottom-20 right-4 z-[60] flex flex-col gap-2 lg:bottom-4"
        role="status"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.type === "error" ? "alert" : "status"}
            className={cn(
              "relative flex items-center gap-2.5 overflow-hidden rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur-md",
              toast.exiting ? "mesh-toast-out" : "mesh-toast-in",
              styles[toast.type]
            )}
          >
            {icons[toast.type]}
            <span className="flex-1">{toast.message}</span>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => dismiss(toast.id)}
              className={cn(
                "ml-1 transition-colors",
                closeButtonStyles[toast.type]
              )}
            >
              <X className="h-3.5 w-3.5" />
            </button>
            {/* Draining lifetime bar — an aurora-tinted countdown along the base. */}
            {!toast.exiting && (
              <span
                aria-hidden="true"
                className="mesh-toast-timer absolute inset-x-0 bottom-0 h-[2px] rounded-full"
                style={{
                  background: `linear-gradient(90deg, ${timerColor[toast.type]}, color-mix(in srgb, ${timerColor[toast.type]} 40%, var(--mesh-cyan)))`,
                  animationDuration: `${TOAST_LIFETIME}ms`,
                }}
              />
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
