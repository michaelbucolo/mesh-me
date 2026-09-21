"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Sparkles, MessageCircle, Compass, Palette, Ghost, ArrowRight, Hand } from "lucide-react";
import { PaperWait } from "@/components/loading/paper-wait";
import { UserMeshi } from "@/components/meshi/user-meshi";
import { useGhostMode, usePresencePrivacy } from "@/hooks/use-ghost-mode";
import { useRoomGestures } from "@/hooks/use-room-gestures";
import type { MeshiColor, MeshiHat } from "./meshi-mascot";

interface MeshiActionsMenuProps {
  meshiColor: MeshiColor;
  meshiHat: MeshiHat;
  activity: string;
  onClose: () => void;
  onAskMeshi: () => void;
  onSearchMesh: () => void;
  onOpenChat: () => void;
}

export function MeshiActionsMenu({ activity, onClose, onAskMeshi, onSearchMesh, onOpenChat }: MeshiActionsMenuProps) {
  const router = useRouter();
  const { ghost, pending, error, update } = useGhostMode();
  const { hideActivityStatus, shareWhere } = usePresencePrivacy();
  const roomGestures = useRoomGestures();
  const returnFocus = useRef<HTMLElement | null>(typeof document === "undefined" ? null : document.activeElement as HTMLElement);
  const navigate = (path: string) => { onClose(); router.push(path); };
  const visibility = ghost
    ? "Ghost Mode is on. Your live presence is hidden from other people."
    : hideActivityStatus
      ? "Your activity status is hidden. Your Meshi still reflects what you do on this device."
      : shareWhere
        ? "Your live presence and current public space can be visible to people you allow."
        : "Your activity status can be visible. Your browsing location is shared only in spaces you join.";

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/15" />
        <Dialog.Content
          data-meshi-owned="true"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (returnFocus.current?.isConnected) returnFocus.current.focus();
          }}
          className="presence-meshi-dashboard fixed bottom-[calc(var(--mobile-nav-h)+env(safe-area-inset-bottom)+1rem)] right-4 z-50 flex max-h-[min(75dvh,40rem)] w-[320px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl glass-dropdown shadow-2xl outline-none md:bottom-[76px]"
        >
          <div className="presence-meshi-identity flex shrink-0 items-center gap-3 border-b border-[var(--border-primary)] px-4 py-3">
            <div className={ghost ? "opacity-50" : undefined}><UserMeshi size={64} /></div>
            <div className="min-w-0 flex-1">
              <p className="presence-kicker">A little you</p><Dialog.Title className="text-xl font-semibold text-[var(--text-primary)]">Your Meshi</Dialog.Title>
              <Dialog.Description className="mt-0.5 text-xs text-[var(--text-muted)]">Your presence, your way.</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" aria-label="Close Meshi actions" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"><X aria-hidden="true" className="h-4 w-4" /></button>
            </Dialog.Close>
          </div>
          <div className="min-h-0 overflow-y-auto overscroll-contain p-4">
            <div className="presence-meshi-state rounded-xl bg-[var(--bg-secondary)] p-3">
              <p className="text-xs text-[var(--text-muted)]">On this device</p>
              <p className="mt-1 text-sm font-medium text-[var(--text-primary)]">{activity}</p>
              <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">{visibility}</p>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <Ghost aria-hidden="true" className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
              <div className="min-w-0 flex-1">
                <p id="meshi-ghost-label" className="text-sm font-medium text-[var(--text-primary)]">Ghost Mode</p>
                <p id="meshi-ghost-description" className="text-xs text-[var(--text-muted)]">Browse without live presence</p>
              </div>
              <button type="button" role="switch" aria-checked={ghost} aria-labelledby="meshi-ghost-label" aria-describedby="meshi-ghost-description" disabled={pending} onClick={() => { void update(error ? true : !ghost); }} className="flex h-11 w-12 shrink-0 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-wait">
                <span aria-hidden="true" className={`relative flex h-6 w-11 items-center rounded-full transition-colors ${ghost ? "bg-[var(--accent)]" : "bg-[var(--border-primary)]"}`}>
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm transition-transform motion-reduce:transition-none ${ghost ? "translate-x-[22px]" : "translate-x-0.5"}`}>{pending && <PaperWait size="sm" className="text-black" />}</span>
                </span>
              </button>
            </div>
            <div aria-live="polite" className="text-xs text-[var(--text-secondary)]">{pending && <p className="mt-2">Saving your presence preference…</p>}</div>
            {error && <div role="alert" className="mt-2 rounded-lg bg-[var(--bg-secondary)] p-3 text-xs text-[var(--text-primary)]"><p>{error}</p><button type="button" onClick={() => { void update(error ? true : !ghost); }} className="mt-1 min-h-11 font-semibold text-[var(--accent-text)]">Try again</button></div>}
            <div className="mt-3 flex items-start gap-3 border-t border-[var(--border-primary)] pt-3">
              <Hand aria-hidden="true" className="mt-3 h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
              <div className="min-w-0 flex-1 py-1.5">
                <p id="meshi-room-gestures-label" className="text-sm font-medium text-[var(--text-primary)]">Room gestures</p>
                <p id="meshi-room-gestures-description" className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">A small hello when people are here, a little expression when you settle nearby. On this device, while your presence is visible. Respects reduced motion.</p>
              </div>
              <button type="button" role="switch" aria-checked={roomGestures.enabled} aria-labelledby="meshi-room-gestures-label" aria-describedby="meshi-room-gestures-description" onClick={() => roomGestures.update(!roomGestures.enabled)} className="flex h-11 w-12 shrink-0 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]">
                <span aria-hidden="true" className={`relative flex h-6 w-11 items-center rounded-full transition-colors ${roomGestures.enabled ? "bg-[var(--accent)]" : "bg-[var(--border-primary)]"}`}><span className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform motion-reduce:transition-none ${roomGestures.enabled ? "translate-x-[22px]" : "translate-x-0.5"}`} /></span>
              </button>
            </div>
            <div className="presence-meshi-destinations mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => navigate("/mesh")} className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl bg-[var(--bg-secondary)] px-3 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"><Compass aria-hidden="true" className="h-5 w-5" />Your Mesh</button>
              <button type="button" onClick={() => navigate("/settings#meshi")} className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl bg-[var(--bg-secondary)] px-3 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"><Palette aria-hidden="true" className="h-5 w-5" />Customize</button>
            </div>
            <button type="button" onClick={() => navigate("/settings#privacy")} className="mt-2 flex min-h-11 w-full items-center justify-between rounded-lg px-1 text-xs text-[var(--text-secondary)]">Privacy controls<ArrowRight aria-hidden="true" className="h-3.5 w-3.5" /></button>
            <details className="mt-2 border-t border-[var(--border-primary)] pt-2">
              <summary className="min-h-11 cursor-pointer py-3 text-xs font-medium text-[var(--text-muted)]">Optional AI help</summary>
              <p className="pb-3 text-xs leading-relaxed text-[var(--text-secondary)]">{"Meshi's replies are generated by a third-party AI provider. What Meshi may send is governed by your Meshi memory rule in Privacy controls."}</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={onAskMeshi} className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--bg-secondary)] text-xs text-[var(--text-primary)]"><Sparkles aria-hidden="true" className="h-3.5 w-3.5" />Ask Meshi</button>
                <button type="button" onClick={onOpenChat} className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--bg-secondary)] text-xs text-[var(--text-primary)]"><MessageCircle aria-hidden="true" className="h-3.5 w-3.5" />Open chat</button>
              </div>
              <button type="button" onClick={onSearchMesh} className="mt-2 min-h-11 w-full rounded-lg text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]">Review Mesh context</button>
            </details>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
