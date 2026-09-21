"use client";

import { useRef, useState, type ReactNode } from "react";
import { Info } from "lucide-react";
import { Modal } from "@/components/ui/modal";

export function ConversationDetails({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return <>
    <button ref={trigger} type="button" className="presence-details-trigger mesh-action mesh-action-secondary" aria-label="Conversation details" aria-haspopup="dialog" onClick={() => setOpen(true)}><Info size={18} aria-hidden="true" /></button>
    <Modal open={open} onClose={() => { setOpen(false); requestAnimationFrame(() => trigger.current?.focus()); }} title="Conversation details" description="People, shared media, and conversation information.">{children}</Modal>
  </>;
}
