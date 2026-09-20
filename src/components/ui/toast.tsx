"use client";

import { cn } from "@/lib/utils";
import { CheckCircle, AlertCircle, Info, X } from "lucide-react";
import { useState, createContext, useContext, useCallback, useEffect, useMemo, useRef } from "react";

interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
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
  const [announcement, setAnnouncement] = useState<Pick<Toast, "id" | "message"> | null>(null);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, type: "success" | "error" | "info" = "success") => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { id, message, type }].slice(-3));
      // Errors announce through their alert. Informational updates use the
      // already-mounted polite region, including repeated message text.
      if (type !== "error") setAnnouncement({ id, message });
    },
    []
  );
  const contextValue = useMemo(() => ({ addToast }), [addToast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement && <span key={announcement.id}>{announcement.message}</span>}
      </div>
      <div className="pointer-events-none fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[60] flex flex-col gap-2 sm:left-auto sm:w-[min(24rem,calc(100vw-2rem))] md:bottom-5">
        {toasts.map((toast) => (
          <ToastMessage key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const toastAppearance = {
  success: { icon: CheckCircle, color: "var(--ds-success)", border: "border-[var(--ds-success-border)]" },
  error: { icon: AlertCircle, color: "var(--ds-danger)", border: "border-[var(--ds-danger-border)]" },
  info: { icon: Info, color: "var(--accent-text)", border: "border-[var(--border-primary)]" },
};

function ToastMessage({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const [exiting, setExiting] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pageHidden, setPageHidden] = useState(() => typeof document !== "undefined" && document.hidden);
  const lifetime = toast.type === "error" ? 6000 : TOAST_LIFETIME;
  const remaining = useRef(lifetime);
  const paused = hovered || focused || pageHidden;
  const { icon: Icon, color, border } = toastAppearance[toast.type];

  useEffect(() => {
    const onVisibilityChange = () => setPageHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  useEffect(() => {
    if (paused || exiting) return;
    const startedAt = Date.now();
    const timer = setTimeout(() => setExiting(true), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt));
    };
  }, [paused, exiting]);

  useEffect(() => {
    if (!exiting) return;
    const timer = setTimeout(() => onRemove(toast.id), EXIT_DURATION);
    return () => clearTimeout(timer);
  }, [exiting, onRemove, toast.id]);

  return (
    <div
      role={toast.type === "error" ? "alert" : undefined}
      aria-atomic={toast.type === "error" ? true : undefined}
      onPointerEnter={(event) => { if (event.pointerType === "mouse") setHovered(true); }}
      onPointerLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
      className={cn(
        "pointer-events-auto relative flex min-w-0 items-center gap-3 overflow-hidden rounded-xl border bg-[var(--bg-elevated)] px-4 py-3 text-sm text-[var(--text-primary)] shadow-[var(--shadow-float)]",
        exiting ? "mesh-toast-out" : "mesh-toast-in",
        border
      )}
    >
      <Icon aria-hidden="true" className="h-[18px] w-[18px] shrink-0" style={{ color }} />
      <span className="min-w-0 flex-1 break-words leading-5 [overflow-wrap:anywhere]">{toast.message}</span>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => setExiting(true)}
        className="ds-focus-ring -my-2 -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
      >
        <X aria-hidden="true" className="h-4 w-4" />
      </button>
      {!exiting && (
        <span
          aria-hidden="true"
          className="mesh-toast-timer absolute inset-x-0 bottom-0 h-[2px]"
          style={{ background: color, animationDuration: `${lifetime}ms`, animationPlayState: paused ? "paused" : "running" }}
        />
      )}
    </div>
  );
}
