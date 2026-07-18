"use client";

import { cn } from "@/lib/utils";
import { CheckCircle, AlertCircle, Info, X } from "lucide-react";
import { useState, createContext, useContext, useCallback } from "react";

interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

interface ToastContextType {
  addToast: (message: string, type?: "success" | "error" | "info") => void;
}

const ToastContext = createContext<ToastContextType>({ addToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback(
    (message: string, type: "success" | "error" | "info" = "success") => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const icons = {
    success: <CheckCircle className="h-4 w-4 text-emerald-300" />,
    error: <AlertCircle className="h-4 w-4 text-red-300" />,
    info: <Info className="h-4 w-4 text-[var(--accent)]" />,
  };

  const styles = {
    success: "border-[var(--ds-success-border)] bg-[var(--bg-elevated)] text-[var(--text-primary)]",
    error: "border-[var(--ds-danger-border)] bg-[var(--bg-elevated)] text-[var(--text-primary)]",
    info: "border-[var(--border-primary)] bg-[var(--bg-elevated)] text-[var(--text-primary)]",
  };

  const closeButtonStyles = {
    success: "text-emerald-300/80 hover:text-emerald-100",
    error: "text-red-300/80 hover:text-red-100",
    info: "text-[var(--text-muted)] hover:text-[var(--text-primary)]",
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-20 right-4 z-[60] flex flex-col gap-2 lg:bottom-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur-md animate-slide-up",
              styles[toast.type]
            )}
          >
            {icons[toast.type]}
            <span className="flex-1">{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className={cn(
                "ml-1 transition-colors",
                closeButtonStyles[toast.type]
              )}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
