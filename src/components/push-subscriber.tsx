"use client";

import { useEffect } from "react";

const SESSION_KEY = "mesh-push-synced";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

/**
 * Completes the promise the onboarding permission prompt made. Permission was
 * requested and then nothing ever subscribed, so "allow notifications" bought
 * a person exactly zero notifications. Once per session, in a browser where
 * permission is already granted: fetch the deployment's VAPID public key
 * (null = push not configured, do nothing), subscribe this browser if it
 * isn't already, and register the subscription under the CURRENT login — so
 * a shared device pushes to whoever is signed in, never a previous occupant.
 *
 * This component never ASKS for permission — that consent moment belongs to
 * onboarding, deliberately. It only finishes what a granted permission
 * started. Renders nothing.
 */
export function PushSubscriber() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // Storage unavailable — the upsert below is idempotent anyway.
    }

    void (async () => {
      try {
        const keyRes = await fetch("/api/push", { credentials: "same-origin" });
        const { key } = (await keyRes.json().catch(() => ({}))) as { key?: string | null };
        if (!key) return; // push not configured on this deployment

        const registration = await navigator.serviceWorker.ready;
        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(key),
          });
        }

        await fetch("/api/push", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(subscription.toJSON()),
        });
      } catch {
        // Push is a courtesy; a failure here must never surface.
      }
    })();
  }, []);

  return null;
}
