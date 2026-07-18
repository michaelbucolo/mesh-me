"use client";

import * as Dialog from "@radix-ui/react-dialog";
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
}

export function Modal({ open, onClose, children, className, title, description }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[var(--bg-overlay)] backdrop-blur-sm data-[state=open]:animate-fade-in" />
        <Dialog.Content
          className={cn(
            "ds-glass-panel fixed left-1/2 top-1/2 z-50 grid max-h-[min(86dvh,42rem)] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-hidden text-[var(--text-primary)] shadow-[var(--ds-shadow-floating)] data-[state=open]:animate-smooth-reveal",
            className
          )}
        >
          <div className="flex min-h-14 items-start justify-between gap-3 border-b border-[var(--ds-border)] px-5 py-4">
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
              <Button variant="ghost" size="icon-sm" aria-label="Close dialog">
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </div>
          <div className="overflow-y-auto p-5 ds-scrollbar">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
