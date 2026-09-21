"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { type RefObject, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  title?: string;
  description?: string;
  initialFocusRef?: RefObject<HTMLElement | null>;
  returnFocusRef?: RefObject<HTMLElement | null>;
}

export function Modal({ open, onClose, children, className, title, description, initialFocusRef, returnFocusRef }: ModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  // Mobile browsers can pan and shrink the visual viewport independently of
  // CSS's layout viewport. Keep the complete dialog above the software keyboard.
  useEffect(() => {
    if (!open) return;
    const viewport = window.visualViewport;
    let frame = 0;
    const measure = () => {
      const content = contentRef.current;
      if (!content) return;
      content.style.setProperty("--dialog-viewport-height", `${viewport?.height ?? window.innerHeight}px`);
      content.style.setProperty("--dialog-viewport-top", `${viewport?.offsetTop ?? 0}px`);
    };
    const scheduleMeasure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    scheduleMeasure();
    viewport?.addEventListener("resize", scheduleMeasure);
    viewport?.addEventListener("scroll", scheduleMeasure);
    window.addEventListener("resize", scheduleMeasure);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener("resize", scheduleMeasure);
      viewport?.removeEventListener("scroll", scheduleMeasure);
      window.removeEventListener("resize", scheduleMeasure);
    };
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[var(--bg-overlay)] backdrop-blur-sm data-[state=open]:animate-fade-in data-[state=closed]:animate-[fadeOut_0.16s_var(--mesh-ease-press)_both]" />
        <Dialog.Content
          ref={contentRef}
          {...(description ? {} : { "aria-describedby": undefined })}
          onCloseAutoFocus={(event) => {
            const target = returnFocusRef?.current;
            if (target?.isConnected && target.getClientRects().length > 0) {
              event.preventDefault();
              target.focus();
            }
          }}
          onOpenAutoFocus={(event) => {
            if (initialFocusRef?.current) {
              event.preventDefault();
              initialFocusRef.current.focus();
            }
          }}
          className={cn(
            "mesh-dialog ds-glass-panel fixed left-1/2 top-1/2 z-50 flex max-h-[min(86dvh,42rem)] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden text-[var(--text-primary)] shadow-[var(--ds-shadow-floating)] data-[state=open]:animate-smooth-reveal data-[state=closed]:animate-smooth-reveal-out",
            className
          )}
        >
          <div className="mesh-dialog-header flex min-h-14 shrink-0 items-start justify-between gap-3 border-b border-[var(--ds-border)] px-5 py-4">
            <div className="min-w-0">
              <Dialog.Title className={cn("text-base font-semibold leading-tight", !title && "sr-only")}>
                {title || "Dialog"}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <Button type="button" variant="ghost" size="icon-sm" className="-mr-2 -mt-2 shrink-0" aria-label="Close dialog">
                <X aria-hidden="true" className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </div>
          <div className="mesh-dialog-body min-h-0 overflow-y-auto overscroll-contain p-5 ds-scrollbar">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
